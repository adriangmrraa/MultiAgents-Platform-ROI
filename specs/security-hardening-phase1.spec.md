# SPEC: Security Hardening Phase 1 - Production Ready

## 1. Objetivos de Negocio

Endurecer Platform AI Solutions para producción segura siguiendo OWASP Top 10 y mejores prácticas 2025/2026 para SaaS multi-tenant con procesamiento de pagos.

**Meta**: Obtener评分 de seguridad A+ en auditoría, proteger datos de usuarios y evitar fugas de credenciales.

---

## 2. Contexto Técnico

### Stack Actual
- **Backend**: FastAPI (Python 3.10+)
- **Database**: PostgreSQL 14 + Supabase (vectors)
- **Cache**: Redis
- **Payments**: Stripe + MercadoPago
- **Channels**: WhatsApp Business (Meta), Instagram, TiendaNube
- **Deployment**: Docker Compose + EasyPanel

### Problemas Identificados
1. **10+ secrets hardcodeados** en código fuente (riesgo crítico)
2. **XOR encryption** insegura para credenciales (fácil de crackear)
3. **Webhooks sin verificación** en Stripe y MercadoPago (ataque MITM)
4. **Endpoint /billing/change-plan vulnerable** (escalación de privilegios)
5. **30+ endpoints admin** con token en frontend público
6. **CORS reflection** vulnerable a ataques XSS
7. **.env committeado** en git (4751c00)
8. **Dockerfiles corriendo como root** (privilege escalation)

---

## 3. Requisitos Funcionales

### RF-001: Remover Secrets Hardcodeados
- **Estado actual**: Secrets en texto plano en main.py, admin_routes.py, credentials.py
- **Requerimiento**: Mover TODOS a environment variables con validación
- **Archivos afectados**: 10+ archivos Python

### RF-002: Migrar XOR → Fernet
- **Estado actual**: `crypt_with_key()` usa XOR
- **Requerimiento**: Usar Fernet (AES 128) con migración dual-read
- **Call sites**: 30+ ubicaciones

### RF-003: Stripe Webhook Mandatory
- **Estado actual**: Handler acepta cualquier request
- **Requerimiento**: Verificar签名 con `STRIPE_WEBHOOK_SECRET`, fail-closed

### RF-004: MercadoPago Webhook Verify
- **Estado actual**: `MP_WEBHOOK_SECRET` declarado pero NUNCA USADO
- **Requerimiento**: Implementar HMAC-SHA256 verification

### RF-005: Proteger /billing/change-plan
- **Estado actual**: Cualquier usuario puede cambiar plan
- **Requerimiento**: Validar sort_order, upgrades solo via webhook/admin

### RF-006: Remover Admin Token Frontend
- **Estado actual**: ~30 endpoints protegidos solo por token público
- **Requerimiento**: Implementar autenticación real (JWT/sessions)

### RF-007: Fix Reflective CORS
- **Estado actual**: `Access-Control-Allow-Origin: *` en responses
- **Requerimiento**: Validar origen contra whitelist, helper reutilizable

### RF-008: Git Audit + .gitignore
- **Estado actual**: .env en commit 4751c00, .gitignore incompleto
- **Requerimiento**: Auditar historial, agregar 40+ patterns

### RF-009: Non-root Dockerfiles
- **Estado actual**: 7 Dockerfiles corriendo como root
- **Requerimiento**: USER no-root, оптимизировать tamaño

---

## 4. Casos de Prueba (Gherkin)

### CP-001: Secret Validation
```gherkin
Given la aplicación inicia en producción
When SECRET_KEY no está configurado o es "changeme"
Then iniciar con HTTP 500 y mensaje de error claro
```

### CP-002: Fernet Migration
```gherkin
Given credenciales encriptadas con XOR en DB
When el sistema las intenta descifrar
Then detectar prefix "FERNET:" vs "XOR:" y usar el decoder correcto
```

### CP-003: Stripe Webhook
```gherkin
Given webhook POST a /api/v1/billing/stripe/webhook
When signature no coincide con STRIPE_WEBHOOK_SECRET
Then retornar HTTP 401 y no procesar evento
```

### CP-004: CORS Validation
```gherkin
Given request desde "evil.com"
When请求到达 /api/v1/*
Then no incluir Access-Control-Allow-Origin (rechazar)
```

---

## 5. Stack Tecnológico

- **Python**: 3.11+ (requerido para Fernet)
- **Cryptography**: `cryptography>=41.0.0` (Fernet)
- **Pydantic Settings**: `pydantic-settings>=2.0.0`
- **Testing**: `pytest`, `pytest-asyncio`
- **Security**: `bandit`, `safety` (dependency scanning)

---

## 6. Criterios de Aceptación

### CA-001: Secrets
- [ ] Ningún secret hardcodeado en código fuente
- [ ] `require_secret()` helper disponible y usado
- [ ] Tests verifican que falta de secret falla startup

### CA-002: Encryption
- [ ] Fernet activo para nuevas credenciales
- [ ] Migración dual-read funcional
- [ ] Script de migración idempotente ejecutable

### CA-003: Webhooks
- [ ] Stripe rechaza requests sin firma válida
- [ ] MercadoPago verifica HMAC-SHA256
- [ ] Fail-closed: sin verificación = HTTP 503

### CA-004: Billing
- [ ] /billing/change-plan valida sort_order
- [ ] Solo webhook o admin pueden upgrades

### CA-005: Admin Auth
- [ ] Endpoints usan get_current_super_admin()
- [ ] Token de frontend removido completamente

### CA-006: CORS
- [ ] Origen validado contra whitelist
- [ ] No hay wildcard en respuestas

### CA-007: Git
- [ ] .gitignore con 40+ patterns
- [ ] .env no existe en working directory
- [ ] Git audit completado (sin secrets reales o rotados)

### CA-008: Docker
- [ ] Todos los Dockerfiles usan USER no-root
- [ ] Imágenes optimizadas (<300MB donde sea posible)

---

## 7. Orden de Implementación

```
1. RF-008 (Git audit) — GATE BLOQUEANTE
2. RF-001 (Remove hardcoded secrets) — BASE
3. RF-002 (Fernet) — DEPENDE de RF-001
4. RF-003 + RF-004 (Webhooks) — PARALELO
5. RF-005 (Change-plan) — INDEPENDIENTE
6. RF-006 (Admin token) — COMPLEJO (2 fases)
7. RF-007 (CORS) — INDEPENDIENTE
8. RF-009 (Dockerfiles) — ÚLTIMO
```

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Break during migration | Media | Crítico | Dual-read, rollback plan |
| Payment failure | Baja | Crítico | Dual-auth temporarily |
| Service downtime | Baja | Alto | Zero-downtime deploy steps |

---

## 9. Estimación

- **Story Points**: 34 puntos
- **Sprint**: 3 sprints (1 semana c/u)
- **Dependencies**: RF-001 → RF-002
