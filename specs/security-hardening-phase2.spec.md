# SPEC: Security Hardening Phase 2 - Production Advanced

## 1. Objetivos de Negocio

Implementar capa de seguridad avanzada para producción siguiendo OWASP Top 10 2025/2026, protegiendo contra ataques sofisticados y asegurando compliance.

---

## 2. Contexto Técnico

### Stack Actual
- FastAPI (Python 3.11+)
- PostgreSQL 14 + Supabase
- Redis (cache + sessions)
- JWT authentication

### Gap Analysis (vs OWASP Top 10 2025)
1. **Rate Limiting** - Básico existente, necesita hardening
2. **Security Headers** - Faltan CSP, HSTS, X-Frame-Options
3. **Input Validation** - Pydantic básico, sin sanitización avanzada
4. **Audit Logging** - Parcial, no cubre todos los eventos críticos
5. **SQL Injection** - SQLAlchemy con parámetros, verificar coverage
6. **XXS Protection** - Falta Content-Security-Policy
7. **Account Lockout** - Parcial existe, needs enhancement

---

## 3. Requisitos Funcionales

### RF-201: Enhanced Rate Limiting
- **Estado actual**: Rate limiting básico en algunos endpoints
- **Requerimiento**: Rate limiting por tenant, por IP, con bypass para webhooks
- **Features**:
  - Sliding window algorithm
  - Different limits por endpoint tier
  - Redis-based distributed rate limiting
  - Admin bypass para internal services
  - User-configurable limits per plan

### RF-202: Security Headers
- **Estado actual**: Solo CORS configurado
- **Requerimiento**: Headers de seguridad completos
- **Headers a agregar**:
  - `Strict-Transport-Security` (HSTS)
  - `Content-Security-Policy` (CSP)
  - `X-Frame-Options` (clickjacking)
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`

### RF-203: Input Sanitization
- **Estado actual**: Pydantic validation básico
- **Requerimiento**: Sanitización de inputs para prevenir XSS e injection
- **Features**:
  - HTML escaping para outputs
  - SQL injection prevention (ya hecho con ORM, verificar)
  - Path traversal protection
  - Command injection prevention

### RF-204: Comprehensive Audit Logging
- **Estado actual**: Algunos logs dispersos
- **Requerimiento**: Audit trail completo para compliance
- **Events a logger**:
  - Login/logout (success + failure)
  - Password changes
  - Plan changes
  - Admin actions
  - Data exports
  - API key creation/deletion
  - Tenant creation/deletion

### RF-205: Account Security Enhancement
- **Estado actual**: Lockout básico existe
- **Requerimiento**: Hardening de account security
- **Features**:
  - Exponential backoff para failed logins
  - Password strength enforcement
  - 2FA preparation (structure para futuro)
  - Session management mejorada

### RF-206: API Security Layer
- **Estado actual**: Endpoints expuestos
- **Requerimiento**:hardening de API
- **Features**:
  - Request size limits
  - Timeout configuration
  - API versioning
  - Deprecation handling

---

## 4. Casos de Prueba

### CP-201: Rate Limit Exceeded
```gherkin
Given usuario hace más de 60 requests en 1 minuto
When excede el rate limit
Then retornar HTTP 429 con Retry-After header
```

### CP-202: Security Headers
```gherkin
Given request GET a /api/v1/*
When response es retornada
Then incluir Strict-Transport-Security, Content-Security-Policy, X-Frame-Options
```

### CP-203: XSS Prevention
```gherkin
Given usuario envía <script>alert('xss')</script> en input
When el valor es renderizado en UI
Then el script tag está sanitizado/escaped
```

### CP-204: Audit Log
```gherkin
Given admin cambia plan de tenant
When la acción es ejecutada
Then registrar en audit_logs table: who, what, when, from_where
```

---

## 5. Criterios de Aceptación

### CA-201: Rate Limiting
- [ ] 60 req/min para usuarios regulares
- [ ] 10 req/min para autenticación endpoints
- [ ] Different limits por plan (pro vs enterprise)
- [ ] Redis-based (funciona en cluster)

### CA-202: Security Headers
- [ ] HSTS con max-age de 1 año
- [ ] CSP que permite solo recursos necesarios
- [ ] X-Frame-Options: DENY o SAMEORIGIN

### CA-203: Input Sanitization
- [ ] Outputs sanitizados en endpoints públicos
- [ ] No raw SQL concatenations

### CA-204: Audit Logging
- [ ] Todos los eventos críticos registrados
- [ ] Logs incluyen: timestamp, user_id, tenant_id, IP, action, details

### CA-205: Account Security
- [ ] Max 5 failed attempts antes de lockout
- [ ] Lockout con exponential backoff
- [ ] Password: min 8 chars, 1 upper, 1 lower, 1 number

### CA-206: API Security
- [ ] Max request size: 1MB para JSON
- [ ] Timeout: 30s para long-running operations

---

## 6. Stack Tecnológico

- Python 3.11+
- `slowapi` (rate limiting)
- `structlog` (structured logging)
- Redis (distributed rate limiting)
- SQLAlchemy 2.0 (parameterized queries)

---

## 7. Estimación

- **Story Points**: 21 puntos
- **Sprint**: 2 sprints
- **Dependencies**: Phase 1 completada
