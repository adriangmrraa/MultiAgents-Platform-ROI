# PROPOSAL: Security Hardening Phase 2 - Production Advanced

## Summary
Implementar capa de seguridad avanzada siguiendo OWASP Top 10 2025/2026 para producción.

---

## Scope

### In Scope
- RF-201: Enhanced Rate Limiting (Redis-based, per-tenant)
- RF-202: Security Headers (HSTS, CSP, X-Frame-Options)
- RF-203: Input Sanitization (XSS prevention)
- RF-204: Comprehensive Audit Logging
- RF-205: Account Security Enhancement
- RF-206: API Security Layer

### Out of Scope
- Frontend security (solo backend)
- 2FA implementation completa (estructura base nomás)
- External penetration testing

---

## Approach

### Metodología
**Ejecución Secuencial con Parallels**

Algunas tareas pueden并行:

| Phase | Tasks | Parallel |
|-------|-------|----------|
| 1 | RF-201, RF-202 | ✅ |
| 2 | RF-203, RF-204 | ✅ |
| 3 | RF-205, RF-206 | ✅ |

### Distribución de Agentes

| Agent | Spec | Dependencies | Archivos Clave |
|-------|------|--------------|----------------|
| Agent 1 | RF-201: Rate Limiting | Ninguna | main.py, middleware/ |
| Agent 2 | RF-202: Security Headers | Ninguna | main.py, middleware/ |
| Agent 3 | RF-203: Input Sanitization | Ninguna | routes/*, utils/ |
| Agent 4 | RF-204: Audit Logging | Ninguna | audit_routes.py, middleware/ |
| Agent 5 | RF-205: Account Security | Ninguna | auth_routes.py, deps.py |
| Agent 6 | RF-206: API Security | Ninguna | main.py, routes/ |

---

## Implementation Plan

### Sprint 1: Core Protection (RF-201, RF-202)

#### Agent 1: RF-201 Rate Limiting (4h)
1. **Setup slowapi**:
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   
   limiter = Limiter(key_func=get_remote_address)
   ```

2. **Configurar límites**:
   - Auth endpoints: 10/min
   - API general: 60/min
   - Admin: 120/min
   - Webhooks: sin límite

3. **Por tenant limits**:
   - Redis-based counter
   - Plan-based limits (pro vs enterprise)

#### Agent 2: RF-202 Security Headers (2h)
1. **Crear middleware**:
   ```python
   @app.middleware("http")
   async def add_security_headers(request, call_next):
       response = await call_next(request)
       response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
       response.headers["Content-Security-Policy"] = "default-src 'self'"
       response.headers["X-Frame-Options"] = "DENY"
       response.headers["X-Content-Type-Options"] = "nosniff"
       response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
       return response
   ```

2. **CSP por entorno**: Dev allows eval, production blocks

### Sprint 2: Validation & Logging (RF-203, RF-204)

#### Agent 3: RF-203 Input Sanitization (3h)
1. **HTML escaping**:
   ```python
   import html
   
   def sanitize_html(value: str) -> str:
       return html.escape(value)
   ```

2. **Apply en outputs** de endpoints críticos

#### Agent 4: RF-204 Audit Logging (4h)
1. **Crear tabla audit_logs** si no existe
2. **Middleware de audit**:
   ```python
   async def audit_log(request, user_id, action, details):
       await db.execute("""
           INSERT INTO audit_logs (user_id, tenant_id, action, ip_address, user_agent, details)
           VALUES ($1, $2, $3, $4, $5, $6)
       """, user_id, tenant_id, action, ip, user_agent, json.dumps(details))
   ```

3. **Eventos a logger**:
   - auth.login, auth.login_failed
   - auth.logout
   - billing.plan_changed
   - admin.*
   - tenant.created, tenant.deleted

### Sprint 3: Account & API (RF-205, RF-206)

#### Agent 5: RF-205 Account Security (3h)
1. **Failed login tracking**:
   ```python
   # Redis key: "failed_login:{email}"
   # Increment on failure, reset on success
   # Lockout after 5 failures with exponential backoff
   ```

2. **Password policy**:
   - Min 8 chars
   - 1 uppercase, 1 lowercase, 1 number
   - No common passwords

#### Agent 6: RF-206 API Security (2h)
1. **Request size limits**:
   ```python
   app.router.default_response_class = JSONResponse
   @app.middleware("http")
   async def check_request_size(request, call_next):
       if request.headers.get("content-length", 0) > 1_000_000:
           raise HTTPException(413, "Payload too large")
   ```

2. **Timeouts**: 30s default

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Rate limiting | 100% endpoints covered |
| Security headers | 6 headers applied |
| Input sanitization | XSS prevention active |
| Audit events | 10+ eventos registrados |
| Account lockout | 5 attempts → lockout |
| API limits | 1MB max, 30s timeout |

---

## Risk Assessment

### Medium
- **Performance**: Rate limiting con Redis puede añadir latency
  - **Mitigation**: Redis connection pooling, async

### Low
- **CSP breaking production**:policy muy restrictiva
  - **Mitigation**: Start permissive, tighten gradually

---

## Timeline

| Sprint | Deliverables | Tiempo |
|--------|--------------|--------|
| 1 | RF-201, RF-202 | 6h |
| 2 | RF-203, RF-204 | 7h |
| 3 | RF-205, RF-206 | 5h |

**Total: 18 horas (~3 días)**

---

## Open Questions

1. ¿Hay requisito de compliance específico (SOC2, ISO27001)?
2. ¿Logs de auditoría deben persistirse a largo plazo (S3, etc)?
3. ¿Qué rate limits específicos por plan?
