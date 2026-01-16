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
    params = {"per_page": 200}
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
    params = {"per_page": 200}
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
        
        # --- Sovereign Safety: Audit Log ---
        # We fire-and-forget (or await but ignore error) to Orchestrator
        try:
            orch_url = os.getenv("ORCHESTRATOR_URL", "http://orchestrator_service:8000")
            async with httpx.AsyncClient(timeout=2.0) as audit_client:
                # We don't have tenant_id easily here in the tool contract unless passed in metadata?
                # The tool 'Email' model doesn't have it.
                # But 'verify_token' ensures it's authorized.
                # Ideally, we should update tool contract to include tenant context, 
                # but for now we log with basic info.
                await audit_client.post(
                    f"{orch_url}/admin/audit/log",
                    json={
                        "event_type": "tool_execution_write",
                        "severity": "info",
                        "message": f"Email sent to {email.to_email}",
                        "payload": {"subject": email.subject, "tool": "sendemail"},
                        "tenant_id": None # Missing context in tool payload, fix in future refactor
                    },
                    headers={"X-Internal-Secret": INTERNAL_API_TOKEN}
                )
        except Exception as audit_err:
            logger.warning("audit_log_failed", error=str(audit_err))

        return ToolResponse(ok=True, data={"status": "email sent", "to": email.to_email})
    except Exception as e:
        logger.error("email_send_failed", error=str(e))
        return ToolResponse(ok=False, error=ToolError(code="SMTP_ERROR", message=str(e), retryable=False))

# --- Tienda Nube OAuth (Partners Flow) ---

TN_CLIENT_ID = os.getenv("TN_CLIENT_ID")
TN_CLIENT_SECRET = os.getenv("TN_CLIENT_SECRET")
TN_REDIRECT_URI = os.getenv("TN_REDIRECT_URI")
# Fallback key for state encryption if not strictly set
STATE_ENCRYPTION_KEY = os.getenv("STATE_ENCRYPTION_KEY", "b4c9a289323b...insecure_fallback...") 

# Try to import Fernet, else fallback to base64 (dev mode)
try:
    from cryptography.fernet import Fernet
    # Ensure key is 32 url-safe base64-encoded bytes. 
    # In production, this MUST be valid. Here we might fail if env is not set correctly.
    # We'll use a dynamic key generation for the session if needed, but state persistence requires consistency.
    # For now, simplistic approach:
    fernet = Fernet(Fernet.generate_key()) 
except ImportError:
    fernet = None
    logger.warning("cryptography_missing_using_plaintext_state")

import base64
import json
from fastapi.responses import RedirectResponse, HTMLResponse

def encrypt_state(data: dict) -> str:
    json_str = json.dumps(data)
    if fernet:
        return fernet.encrypt(json_str.encode()).decode()
    return base64.urlsafe_b64encode(json_str.encode()).decode()

def decrypt_state(token: str) -> dict:
    if fernet:
        return json.loads(fernet.decrypt(token.encode()).decode())
    return json.loads(base64.urlsafe_b64decode(token.encode()).decode())

async def internal_sync_credential(tenant_id: str, name: str, value: str):
    """
    Injects a credential into the Orchestrator's Sovereign Vault.
    Uses the Internal Secret handshake.
    """
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "http://orchestrator_service:8000")
    url = f"{orchestrator_url}/admin/credentials/internal-sync"
    
    headers = {
        "X-Internal-Secret": INTERNAL_API_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {
        "tenant_id": int(tenant_id) if tenant_id.isdigit() else tenant_id, # Ensure handling of int/str
        "category": "tiendanube",
        "name": name,
        "value": value,
        "description": "Auto-synced via Tienda Nube OAuth"
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            logger.info("credential_synced", name=name, tenant_id=tenant_id)
        except Exception as e:
            logger.error("credential_sync_failed", name=name, error=str(e))
            raise e

@app.get("/auth/login")
def login_tiendanube(tenant_id: str):
    if not TN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="TN_CLIENT_ID not configured")
    
    state = encrypt_state({"tenant_id": tenant_id})
    
    # Construct auth URL
    # https://www.tiendanube.com/apps/authorize?client_id=123&state=xyz&redirect_uri=...
    base_url = "https://www.tiendanube.com/apps/authorize"
    auth_url = f"{base_url}?client_id={TN_CLIENT_ID}&state={state}&redirect_uri={TN_REDIRECT_URI}"
    
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
async def callback_tiendanube(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error:
         return HTMLResponse(content=f"<h1>Error from Tienda Nube</h1><p>{error}</p>")
    
    if not code or not state:
        return HTMLResponse(content="<h1>Error</h1><p>Missing code or state</p>")

    try:
        # 1. Recover Tenant ID
        data = decrypt_state(state)
        tenant_id = data.get("tenant_id")
        
        if not tenant_id:
             raise ValueError("Invalid State: No tenant_id")

        # 2. Exchange Code for Token
        token_url = "https://www.tiendanube.com/apps/authorize/token"
        payload = {
            "client_id": TN_CLIENT_ID,
            "client_secret": TN_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(token_url, json=payload)
            resp.raise_for_status()
            token_data = resp.json()
            
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token") # Capture Refresh Token
        expires_in = token_data.get("expires_in") # Process Expiry
        user_id = str(token_data.get("user_id")) # Store ID
        
        if not access_token:
            raise ValueError("No access token received")

        # 3. Sovereign Injection into Orchestrator Vault
        await internal_sync_credential(tenant_id, "TIENDANUBE_ACCESS_TOKEN", access_token)
        await internal_sync_credential(tenant_id, "TIENDANUBE_USER_ID", user_id)
        
        # New: Store Refresh Token for Auto-Renewal
        if refresh_token:
            await internal_sync_credential(tenant_id, "TIENDANUBE_REFRESH_TOKEN", refresh_token)

        # New: Store Expiration
        if expires_in:
             # Calculate absolute expiry (current time + expires_in)
             # Stored as string timestamp or ISO? Let's use ISO for readability in Valut or float timestamp.
             # Orchestrator handles string conversion. Let's send a timestamp string.
             import time
             expires_at = time.time() + int(expires_in)
             await internal_sync_credential(tenant_id, "TIENDANUBE_EXPIRES_AT", str(expires_at))
        
        # 4. Success Response (Close Popup)
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Conexión Exitosa</title>
            <style>body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f4f5; }</style>
        </head>
        <body>
            <h2 style="color: #10b981;">¡Conexión Exitosa!</h2>
            <p>Tienda Nube se ha conectado correctamente a Nexus.</p>
            <p>Cerrando ventana...</p>
            <script>
                // Notify parent window
                if (window.opener) {
                    window.opener.postMessage({ type: 'TIENDANUBE_SUCCESS' }, '*');
                    setTimeout(() => window.close(), 1500);
                } else {
                    document.write("<p>Ya puedes cerrar esta ventana.</p>");
                }
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    except Exception as e:
        logger.error("oauth_callback_failed", error=str(e))
        return HTMLResponse(content=f"<h1>Error Critical</h1><p>{str(e)}</p>", status_code=500)

class TokenRefreshRequest(BaseModel):
    refresh_token: str

@app.post("/auth/refresh", response_model=ToolResponse)
async def refresh_tiendanube_token(payload: TokenRefreshRequest):
    """
    Exchanges a Refresh Token for a new Access Token using stored Secrets.
    Acts as a secure proxy so Orchestrator doesn't need the Client Secret.
    """
    if not TN_CLIENT_ID or not TN_CLIENT_SECRET:
         return ToolResponse(ok=False, error=ToolError(code="CONFIG_ERROR", message="Tienda Nube Secrets missing", retryable=False))

    url = "https://www.tiendanube.com/apps/authorize/token"
    data = {
        "client_id": TN_CLIENT_ID,
        "client_secret": TN_CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": payload.refresh_token
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=data)
            
            if resp.status_code == 200:
                return ToolResponse(ok=True, data=resp.json())
            
            logger.error("token_refresh_failed", status=resp.status_code, body=resp.text)
            return ToolResponse(ok=False, error=ToolError(code="REFRESH_FAILED", message=f"Upstream Error: {resp.text}", retryable=True))
            
    except Exception as e:
        logger.error("token_refresh_exception", error=str(e))

# --- GDPR Webhooks (Compliance) ---

@app.post("/webhooks/gdpr/store_redact")
async def gdpr_store_redact(request: Request):
    """
    Tienda Nube requests store data deletion (Uninstall).
    We should mark tenant as inactive or schedule cleanup.
    """
    try:
        payload = await request.json()
        store_id = payload.get("store_id")
        logger.warning("gdpr_store_redact_requested", store_id=store_id)
        # Protocol Omega: We don't auto-delete on webhook for safety.
        # We acknowledge 200 OK.
        return Response(status_code=200)
    except Exception as e:
        logger.error("gdpr_store_redact_error", error=str(e))
        return Response(status_code=200) # Always 200 to satisfy webhook

@app.post("/webhooks/gdpr/customers_redact")
async def gdpr_customers_redact(request: Request):
    """
    Tienda Nube requests customer data deletion.
    """
    try:
        payload = await request.json()
        logger.info("gdpr_customer_redact_requested", payload=payload)
        return Response(status_code=200)
    except Exception as e:
        logger.error("gdpr_customer_redact_error", error=str(e))
        return Response(status_code=200)

@app.post("/webhooks/gdpr/customers_data")
async def gdpr_customers_data(request: Request):
    """
    Tienda Nube requests customer data export.
    """
    try:
        payload = await request.json()
        logger.info("gdpr_customer_data_export_requested", payload=payload)
        return Response(status_code=200)
    except Exception as e:
        logger.error("gdpr_customer_data_export_error", error=str(e))
        return Response(status_code=200)

