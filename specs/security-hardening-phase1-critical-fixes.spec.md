# SPEC: Security Hardening Phase 1 - Critical Fixes

## 1. Objetivos de Negocio

Completar los items críticos que quedaron pendientes del Security Hardening Phase 1 para lograr评分 de seguridad A+ en producción.

---

## 2. Contexto

### Issues Críticos Pendientes

1. **RF-001 Parcial**: 18 occurrences de secrets hardcodeados aún en código:
   - `orchestrator_service/main.py`: `ENCRYPTION_KEY = "agente-js-secret-key-2024"` (línea 111)
   - `orchestrator_service/admin_routes.py`: `"7876867976967967967463422222456467776967967585795679"` (línea 1305)
   - `whatsapp_service/main.py`: `INTERNAL_SECRET_KEY or "internal-secret"` (6 occurrences, líneas 49, 60, 111, 563, 646, 665, 802)
   - `agent_service/main.py`: `ADMIN_TOKEN = "admin-secret-99"` (línea 463)
   - `meta_service/core/client.py`: `"internal-secret"` (línea 15)
   - Tests: valores hardcodeados

2. **RF-004 Parcial**: MercadoPago webhook NO verifica HMAC-SHA256:
   - `MP_WEBHOOK_SECRET` declarado en línea 31 de billing_routes.py
   - NUNCA se usa para verificación de firma
   - Solo hace fetch-back a MP API con `MP_ACCESS_TOKEN`

3. **RF-006 Parcial**: Tokens legacy aún en código:
   - Después de deploy, hay que remover el token legacy del frontend
   - Dual-auth implementado pero no activado

---

## 3. Requisitos Funcionales

### RF-001-FIX: Completar Remoción de Hardcoded Secrets

- **Problema**: 18 occurrences de valores por defecto aún en código
- **Requerimiento**: Reemplazar TODOS con lookups a env vars o `require_secret()`
- **Archivos a modificar**:
  - `orchestrator_service/main.py`: línea 111
  - `orchestrator_service/admin_routes.py`: línea 1305
  - `whatsapp_service/main.py`: líneas 49, 60, 111, 563, 646, 665, 802
  - `agent_service/main.py`: línea 463
  - `meta_service/core/client.py`: línea 15

### RF-004-FIX: Implementar HMAC-SHA256 para MercadoPago

- **Problema**: MP_WEBHOOK_SECRET nunca se usa
- **Requerimiento**: Verificar firma HMAC-SHA256 del webhook
- **Mecanismo de MP**: 
  - MP firma el request con `X-MP-Signature` header
  - Usar `hmac.new(secret, body, hashlib.sha256)`
- **Archivo**: `orchestrator_service/app/routes/billing_routes.py`

### RF-006-FIX: Cleanup Tokens Legacy

- **Problema**: Tokens hardcodeados aún en código para backward compatibility
- **Requerimiento**: Remover después de deploy exitoso
- **Nota**: Esto es un cleanup task, no implementación nueva

---

## 4. Casos de Prueba

### CP-FIX-1: Secret Validation
```gherkin
Given código en producción
When se ejecuta sin env vars requeridas
Then fallar con error claro indicando qué variable falta
```

### CP-FIX-2: MP Webhook Verification
```gherkin
Given webhook POST a /api/v1/billing/webhook/mercadopago
When firma HMAC no coincide con MP_WEBHOOK_SECRET
Then retornar HTTP 401 y no procesar evento
```

### CP-FIX-3: Legacy Token Cleanup
```gherkin
Given deploy exitoso de RF-006
When pasan 24-48 horas
Then remover token legacy del código fuente
```

---

## 5. Criterios de Aceptación

- [ ] 0 secrets hardcodeados en código fuente (grep retorna 0)
- [ ] MP_WEBHOOK_SECRET verifica HMAC-SHA256
- [ ] Fail-closed para MP webhook: sin secret = 503, firma inválida = 401
- [ ] Tokens legacy comentados/removidos

---

## 6. Stack Tecnológico

- Python 3.11+
- hmac, hashlib (stdlib)
- os.getenv para configuration

---

## 7. Estimación

- **Story Points**: 5 puntos
- **Tiempo estimado**: 2-3 horas
- **Dependencies**: Ninguna (issues independientes)
