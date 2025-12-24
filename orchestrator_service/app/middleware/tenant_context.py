from contextvars import ContextVar
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

from app.schemas.tenant import TenantInternal
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant
from sqlalchemy import select

# Global Thread-Safe Context
tenant_context: ContextVar[Optional[TenantInternal]] = ContextVar("tenant_context", default=None)

class TenantIdentificationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Reset Context
        token = tenant_context.set(None)
        
        try:
            # 2. Try Header Identification (API REST)
            # Webhook logic is complex (body stream) so we might handle it in a Dependency instead
            # But if X-Tenant-ID is present, we honor it.
            tenant_id_header = request.headers.get("X-Tenant-ID")
            
            if tenant_id_header and tenant_id_header.isdigit():
                async with AsyncSessionLocal() as session:
                    stmt = select(Tenant).where(Tenant.id == int(tenant_id_header))
                    result = await session.execute(stmt)
                    tenant_orm = result.scalar_one_or_none()
                    
                    if tenant_orm and tenant_orm.is_active:
                        # Convert ORM to Pydantic Internal Schema
                        # This includes secrets which we need for the logic layer
                        tenant_data = TenantInternal.model_validate(tenant_orm)
                        tenant_context.set(tenant_data)
            
            # 3. Security Enforcement (Nexus Protocol)
            # Allow public endpoints (Health, Docs, OpenAPI, Webhooks)
            path = request.url.path
            public_paths = ["/health", "/docs", "/openapi.json", "/webhook", "/favicon.ico"]
            
            if any(path.startswith(p) for p in public_paths):
                response = await call_next(request)
                return response
            
            # For protected routes, ensure Tenant Context is set
            if not tenant_context.get():
                return Response(content="Unauthorized: Missing or Invalid X-Tenant-ID for Nexus Protocol", status_code=401)
            
            response = await call_next(request)
            return response
            
        finally:
            # 4. Cleanup
            tenant_context.reset(token)
