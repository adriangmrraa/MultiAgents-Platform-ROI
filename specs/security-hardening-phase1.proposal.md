# PROPOSAL: Security Hardening Phase 1 - Implementation Plan

## Summary
Implementar las 9 mejoras de seguridad críticas identificadas en el audit previo para hacer Platform AI Solutions production-ready.

---

## Scope

### In Scope
- 9 requerimientos de seguridad (RF-001 a RF-009)
- Código Python en orchestrator_service, agent_service, whatsapp_service, meta_service, tiendanube_service
- 7 Dockerfiles
- Git configuration (.gitignore)

### Out of Scope
- Frontend React (salvo RF-006 admin token removal)
- Database schema changes (no hay migración de modelos, solo de encryption)
- Third-party integrations nuevas

---

## Approach

### Metodología
**Parallel Execution con Dependencies Respected**

Los 9 specs se implementan en paralelo EXCEPTO las dependencias:
- RF-001 debe completar ANTES de RF-002
- RF-008 (git audit) es gate bloqueante — debe ir primero

### Distribución de Agentes

| Agent | Spec | Dependencies | Archivos Clave |
|-------|------|--------------|----------------|
| Agent 1 | RF-001: Remove hardcoded secrets | Ninguna | main.py, config.py, credentials.py, todos los routes |
| Agent 2 | RF-002: XOR → Fernet | RF-001 | credentials.py, utils.py, 30+ call sites |
| Agent 3 | RF-003: Stripe webhook | Ninguna | billing_routes.py |
| Agent 4 | RF-004: MercadoPago webhook | Ninguna | billing_routes.py |
| Agent 5 | RF-005: Protect change-plan | Ninguna | billing_routes.py |
| Agent 6 | RF-006: Remove admin token | Ninguna | admin_routes.py, frontend routes |
| Agent 7 | RF-007: Fix CORS | Ninguna | main.py, CORS middleware |
| Agent 8 | RF-008: Git audit + ignore | **PRIMERO** | .gitignore, git history |
| Agent 9 | RF-009: Non-root Dockerfiles | Ninguna | Dockerfile* (7 archivos) |

### Deployment Strategy
**Zero-Downtime con Dual-Auth**

Para RF-006 (admin token removal):
- **Fase 1**: Dual-auth (token legacy + JWT)
- **Fase 2**: Remover token legacy después de 24-48h

Para RF-002 (Fernet migration):
- **Dual-read**: Detectar formato y usar decoder apropiado
- **Migration script**: Batch async para re-encriptar

---

## Implementation Plan

### Sprint 1: Foundation (RF-008, RF-001)
1. **RF-008**: Git audit + .gitignore (2h)
   - Verificar si .env contenido real o placeholders
   - Si reales → incident response + rotation
   - Si placeholders → fix rápido
   - Crear .gitignore con 40+ patterns

2. **RF-001**: Remove hardcoded secrets (6h)
   - Identificar los 10 archivos con secrets
   - Crear helper `require_secret(env_var, fallback?)` en config.py
   - Reemplazar hardcoded values con env var lookups
   - Agregar validators para production-only secrets

### Sprint 2: Core Security (RF-002, RF-003, RF-004)
3. **RF-002**: XOR → Fernet (8h)
   - Implementar Fernet encryption en credentials.py
   - Dual-read: detectar "FERNET:" vs "XOR:" prefix
   - Crear script de migración idempotente
   - Update 30+ call sites

4. **RF-003**: Stripe webhook mandatory (3h)
   - Agregar signature verification
   - Fail-closed: HTTP 401 si falla
   - 8 unit tests

5. **RF-004**: MercadoPago webhook verify (3h)
   - Conectar MP_WEBHOOK_SECRET (ya declarado, nunca usado)
   - Implementar HMAC-SHA256 verification
   - Fail-closed: HTTP 503 si no hay secret

### Sprint 3: Advanced (RF-005, RF-006, RF-007, RF-009)
6. **RF-005**: Protect /billing/change-plan (2h)
   - Agregar guard por sort_order
   - Upgrades solo webhook/admin
   - Downgrades permitidos

7. **RF-006**: Remove admin token frontend (6h)
   - Fase 1: Dual-auth con get_current_super_admin()
   - Fase 2: Cleanup después de deploy
   - 30+ endpoints a revisar

8. **RF-007**: Fix reflective CORS (3h)
   - Crear helper `_validated_cors_origin()`
   - Update 3 locations
   - Compartir CORS_ALLOWED_ORIGINS env var

9. **RF-009**: Non-root Dockerfiles (2h)
   - 7 Dockerfiles: agregar USER
   - Optimizar tamaño (python:3.11-slim)
   - Bonus: orchestrator ~1GB → ~200MB

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Secrets en código | 0 |
| Encryption | Fernet (AES-128) |
| Webhooks verificados | 100% |
| Admin endpoints con auth real | 100% |
| CORS validation | Whitelist only |
| Dockerfiles non-root | 100% |
| Git .env leaks | 0 (audit completado) |

---

## Risk Assessment

### High
- **Migration break**: Credenciales ilegibles después de migración
  - **Mitigation**: Dual-read, testing exhaustivo, rollback plan

### Medium
- **Payment interruption**: Error durante implementación de billing
  - **Mitigation**: Dual-auth temporal, feature flags

### Low
- **Performance regression**: Fernet más lento que XOR
  - **Mitigation**: Benchmarking, caching si necesario

---

## Requirements

- Python 3.11+ (Fernet requirement)
- `cryptography>=41.0.0`
- `pydantic-settings>=2.0.0`
- Acceso a secrets de producción ( rotación post-implementación)
- Backup de DB antes de migración de encryption

---

## Timeline

| Week | Sprint | Deliverables |
|------|--------|--------------|
| 1 | Foundation | RF-008, RF-001 completados |
| 2 | Core | RF-002, RF-003, RF-004 completados |
| 3 | Advanced | RF-005-009 completados |

**Total: 3 semanas**

---

## Open Questions

1. ¿Hay acceso a secrets de producción para testing?
2. ¿Cuánto tiempo puede estar en dual-auth (RF-006)?
3. ¿Hay presupuesto para security audit externo post-implementación?
