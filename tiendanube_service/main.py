import os
import requests
import httpx
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from enum import Enum
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TIENDANUBE_API_KEY = os.getenv("TIENDANUBE_API_KEY")
# ...
TIENDANUBE_USER_AGENT = os.getenv("TIENDANUBE_USER_AGENT", "Nexus-MultiTenant-Service (Nexus v3)")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN") or os.getenv("INTERNAL_SECRET_KEY")

# Removed hardcoded TIENDANUBE_STORE_ID

import structlog
import time
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from fastapi import Request

# Initialize structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Metrics
REQUESTS = Counter("http_requests_total", "Total Request Count", ["service", "endpoint", "method", "status"])
LATENCY = Histogram("http_request_latency_seconds", "Request Latency", ["service", "endpoint"])

SERVICE_NAME = "tiendanube_service"
app = FastAPI(title="Tienda Nube Tool Service", version="1.0.0")

@app.middleware("http")
async def add_metrics_and_logs(request: Request, call_next):
    start_time = time.time()
    correlation_id = request.headers.get("X-Correlation-Id") or request.headers.get("traceparent")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    status_code = response.status_code
    endpoint = request.url.path
    method = request.method
    
    # Update Metrics
    REQUESTS.labels(service=SERVICE_NAME, endpoint=endpoint, method=method, status=status_code).inc()
    LATENCY.labels(service=SERVICE_NAME, endpoint=endpoint).observe(process_time)
    
    # Log
    log = logger.bind(
        service=SERVICE_NAME,
        timestamp=time.time(),
        level="info" if status_code < 400 else "error",
        correlation_id=correlation_id,
        latency_ms=round(process_time * 1000, 2),
        status_code=status_code,
        method=method,
        endpoint=endpoint
    )
    if status_code >= 400:
        log.error("request_failed")
    else:
        log.info("request_completed")
        
    return response

@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/ready")
def ready():
    """Readiness probe."""
    if not TIENDANUBE_API_KEY:
         raise HTTPException(status_code=503, detail="Configuration missing")
    return {"status": "ok"}
    
@app.get("/")
def read_root():
    return {"service": "tiendanube_service", "version": "1.0.2", "status": "active"}

@app.get("/health")
@app.get("/admin/health")
def health():
    return {"status": "ok", "service": "tiendanube_service"}

# ... existing code ...

# Shared Contract Models (Redefined here to avoid build context complexity if shared not mounted, 
# although ideally we should import from shared.models if available)
class ToolError(BaseModel):

    code: str
    message: str
    retryable: bool
    details: Optional[Dict[str, Any]] = None

class ToolResponse(BaseModel):
    ok: bool
    data: Optional[Any] = None
    error: Optional[ToolError] = None
    meta: Optional[Dict[str, Any]] = None

# Request Models
class ProductSearch(BaseModel):
    store_id: str
    access_token: str
    q: str = Field(..., description="Search query for products.")

class ProductCategorySearch(BaseModel):
    store_id: str
    access_token: str
    category: str = Field(..., description="Product category.")
    keyword: str = Field(..., description="Keyword to refine the search.")

class OrderSearch(BaseModel):
    store_id: str
    access_token: str
    q: str = Field(..., description="Search query for orders (usually order number).")

class Email(BaseModel):
    to_email: str
    subject: str
    text: str
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

async def verify_token(x_internal_token: str = Header(None, alias="X-Internal-Secret")):
    """Security Handshake (Protocol Omega)"""
    if not INTERNAL_API_TOKEN:
        logger.error("security_config_missing", detail="INTERNAL_API_TOKEN is not set")
        raise HTTPException(status_code=500, detail="Security configuration missing on server")
    
    if x_internal_token != INTERNAL_API_TOKEN:
        logger.warning("security_violation", provided=x_internal_token[:5] + "...")
        raise HTTPException(status_code=401, detail="Invalid Internal Token")

def get_tn_headers(access_token: str) -> Dict[str, str]:
    """Centralized Tienda Nube Header logic."""
    return {
        "Authentication": f"bearer {access_token}",
        "User-Agent": TIENDANUBE_USER_AGENT,
        "Content-Type": "application/json",
    }

async def handle_tn_response(response: httpx.Response) -> ToolResponse:
    """Standardized Upstream Handler."""
    if response.status_code == 200:
        return ToolResponse(ok=True, data=response.json())
    
    status_code = response.status_code
    if status_code == 429:
        err = ToolError(code="TN_RATE_LIMIT", message="Rate limit exceeded", retryable=True)
    elif status_code in [401, 403]:
        err = ToolError(code="TN_UNAUTHORIZED", message="Unauthorized upstream", retryable=False)
    elif status_code >= 500:
        err = ToolError(code="UPSTREAM_UNAVAILABLE", message="Tienda Nube down", retryable=True)
    else:
        err = ToolError(code="TN_ERROR", message=f"Upstream returned {status_code}", retryable=False)
    
    return ToolResponse(ok=False, error=err)

@app.post("/tools/productsq", response_model=ToolResponse)
async def productsq(search: ProductSearch, token: str = Depends(verify_token)):
    url = f"https://api.tiendanube.com/v1/{search.store_id}/products"
    params = {"q": search.q, "per_page": 20}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=get_tn_headers(search.access_token), params=params)
            return await handle_tn_response(resp)
    except Exception as e:
        logger.error("productsq_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="INTERNAL_ERROR", message=str(e), retryable=False))

@app.post("/tools/productsq_category", response_model=ToolResponse)
async def productsq_category(search: ProductCategorySearch, token: str = Depends(verify_token)):
    url = f"https://api.tiendanube.com/v1/{search.store_id}/products"
    query = f"{search.category} {search.keyword}"
    params = {"q": query, "per_page": 20}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=get_tn_headers(search.access_token), params=params)
            return await handle_tn_response(resp)
    except Exception as e:
        logger.error("productsq_category_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="INTERNAL_ERROR", message=str(e), retryable=False))

class GenericTenantRequest(BaseModel):
    store_id: str
    access_token: str

@app.post("/tools/productsall", response_model=ToolResponse)
async def productsall(req: GenericTenantRequest, token: str = Depends(verify_token)):
    url = f"https://api.tiendanube.com/v1/{req.store_id}/products"
    params = {"per_page": 25}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=get_tn_headers(req.access_token), params=params)
            return await handle_tn_response(resp)
    except Exception as e:
        logger.error("productsall_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="INTERNAL_ERROR", message=str(e), retryable=False))

@app.post("/tools/cupones_list", response_model=ToolResponse)
async def cupones_list(req: GenericTenantRequest, token: str = Depends(verify_token)):
    url = f"https://api.tiendanube.com/v1/{req.store_id}/coupons"
    params = {"per_page": 25}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=get_tn_headers(req.access_token), params=params)
            return await handle_tn_response(resp)
    except Exception as e:
        logger.error("cupones_list_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="INTERNAL_ERROR", message=str(e), retryable=False))

@app.post("/tools/orders", response_model=ToolResponse)
async def orders(search: OrderSearch, token: str = Depends(verify_token)):
    url = f"https://api.tiendanube.com/v1/{search.store_id}/orders"
    params = {"q": search.q}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=get_tn_headers(search.access_token), params=params)
            return await handle_tn_response(resp)
    except Exception as e:
        logger.error("orders_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="INTERNAL_ERROR", message=str(e), retryable=False))

@app.post("/tools/sendemail", response_model=ToolResponse)
async def sendemail(email: Email, token: str = Depends(verify_token)):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    try:
        # Prio 1: Use provided SMTP config from request
        host = email.smtp_host or os.getenv("SMTP_HOST")
        port = email.smtp_port or int(os.getenv("SMTP_PORT", "587"))
        user = email.smtp_user or os.getenv("SMTP_USER")
        password = email.smtp_password or os.getenv("SMTP_PASS")

        if not all([host, port, user, password]):
            return ToolResponse(ok=False, error=ToolError(code="SMTP_CONFIG_MISSING", message="SMTP configuration is incomplete", retryable=False))

        msg = MIMEMultipart()
        msg['From'] = user
        msg['To'] = email.to_email
        msg['Subject'] = email.subject
        msg.attach(MIMEText(email.text, 'plain'))

        # Standard SMTP is sync, but we wrap it to not block too much 
        # Ideally use aiosmtplib but keeping it simple for now
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)

        logger.info("email_sent_successfully", to=email.to_email)
        return ToolResponse(ok=True, data={"status": "email sent", "to": email.to_email})
    except Exception as e:
        logger.error("email_send_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="SMTP_ERROR", message=str(e), retryable=False))

if __name__ == "__main__":
    import uvicorn
    # Protocol Omega: Enforce Port 8003
    port = int(os.getenv("PORT", "8003"))
    logger.info("starting_tiendanube_service_omega", port=port)
    uvicorn.run(app, host="0.0.0.0", port=port)
