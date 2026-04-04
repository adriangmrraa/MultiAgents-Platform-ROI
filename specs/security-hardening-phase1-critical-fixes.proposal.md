# PROPOSAL: Security Hardening Phase 1 - Critical Fixes

## Summary
Completar los 3 issues críticos pendientes del Security Hardening Phase 1 para lograr implementación completa y producción segura.

---

## Scope

### In Scope
- RF-001-FIX: Completar remoción de 18 secrets hardcodeados
- RF-004-FIX: Implementar HMAC-SHA256 verification para MercadoPago
- RF-006-FIX: Cleanup de tokens legacy

### Out of Scope
- Cambios en el schema de base de datos
- Cambios en el frontend

---

## Approach

### Metodología
**Ejecución Secuencial** (tasks pequeñas, independientes)

### Distribución de Agentes

| Agent | Task | Archivos Clave |
|-------|------|----------------|
| Agent 1 | RF-001-FIX: Hardcoded secrets | main.py (orchestrator, whatsapp, agent), admin_routes.py, meta_service/core/client.py |
| Agent 2 | RF-004-FIX: MP HMAC verification | billing_routes.py |
| Agent 3 | RF-006-FIX: Legacy token cleanup | Código comentariado, preparación para cleanup |

---

## Implementation Plan

### Agent 1: RF-001-FIX (2 horas)

1. **Reemplazar valores hardcodeados**:
   
   ```python
   # ANTES (main.py línea 111)
   ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "agente-js-secret-key-2024")
   
   # DESPUÉS
   ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")  # Fallback a require_secret en prod
   ```

2. **Archivos específicos**:
   - `orchestrator_service/main.py` - ENCRYPTION_KEY
   - `orchestrator_service/admin_routes.py` - INTERNAL_SECRET
   - `whatsapp_service/main.py` - 6 occurrences de "internal-secret"
   - `agent_service/main.py` - ADMIN_TOKEN default
   - `meta_service/core/client.py` - internal_secret default
   - `tests/` - opcional, son de test

3. **Verificación**:
   ```bash
   grep -r "agente-js-secret-key\|7876867976\|internal-secret\|admin-secret-99" --include="*.py" .
   ```
   Debe retornar 0 resultados (excluyendo tests)

### Agent 2: RF-004-FIX (1 hora)

1. **Implementar HMAC verification**:
   ```python
   import hmac
   import hashlib
   
   def verify_mercadopago_signature(payload: bytes, signature: str, secret: str) -> bool:
       """Verify HMAC-SHA256 signature from MercadoPago webhook."""
       expected = hmac.new(
           secret.encode(),
           payload,
           hashlib.sha256
       ).hexdigest()
       return hmac.compare_digest(expected, signature)
   ```

2. **Modificar webhook handler**:
   - Obtener `MP_WEBHOOK_SECRET` de env var
   - Obtener header `X-MP-Signature` o similar de MP
   - Verificar antes de procesar
   - Fail-closed: sin secret = 503, firma inválida = 401

3. **Referencia**: https://www.mercadopago.com.ar/developers/es/guides/notifications/webhooks

### Agent 3: RF-006-FIX (30 min)

1. **Cleanup tokens legacy**:
   - Comentar o marcar los tokens para cleanup post-deploy
   - Crear checklist para remover después de 24-48h

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Secrets hardcodeados | 0 |
| MP webhook verification | HMAC-SHA256 implementado |
| Fail-closed behavior | 100% |

---

## Risk Assessment

### Low
- **Break legacy systems**: Algunos servicios pueden usar tokens hardcodeados
  - **Mitigation**: Verificar que todos usan env vars antes de remover

---

## Timeline

| Task | Tiempo | Entregable |
|------|--------|-------------|
| RF-001-FIX | 2h | 0 hardcoded secrets |
| RF-004-FIX | 1h | MP HMAC verificado |
| RF-006-FIX | 30min | Cleanup ready |

**Total: 3.5 horas**

---

## Open Questions

1. ¿Hay servicios externos que dependan de los tokens hardcoded actuales?
2. ¿Cuál es el proceso de rotación de credenciales en producción?
