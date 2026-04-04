# Cleanup Tokens Legacy - Checklist

## Objetivo
Eliminar los fallbacks de tokens legacy (`internal-secret`, `secret`, valores hardcodeados) después de verificar que el deploy funciona correctamente y que todos los servicios están usando `INTERNAL_SECRET_KEY` o `INTERNAL_API_TOKEN` desde variables de entorno.

## Cuándo ejecutar
Después de confirmar que:
- [ ] Todos los servicios tienen configuradas las variables `INTERNAL_SECRET_KEY` o `INTERNAL_API_TOKEN` en sus entornos.
- [ ] Las comunicaciones inter-servicios funcionan correctamente (health checks, webhooks, sync).
- [ ] No hay errores de autenticación en los logs.

## Archivos y líneas a modificar

### whatsapp_service/main.py

| Línea | Código original (con fallback) | Acción |
|-------|--------------------------------|--------|
| ~57   | `"X-Internal-Token": INTERNAL_SECRET_KEY or "internal-secret"` | Reemplazar por `"X-Internal-Token": INTERNAL_SECRET_KEY` (eliminar `or "internal-secret"`) |
| ~75   | `or "internal-secret"` (dentro del bloque except) | Eliminar `or "internal-secret"`, dejar solo `INTERNAL_SECRET_KEY` |
| ~744  | `if secret != (INTERNAL_SECRET_KEY or "internal-secret"):` | Reemplazar por `if secret != INTERNAL_SECRET_KEY:` |
| ~827  | `"X-Internal-Token": INTERNAL_SECRET_KEY or "internal-secret",` | Reemplazar por `"X-Internal-Token": INTERNAL_SECRET_KEY,` |
| ~849  | `if token != (INTERNAL_SECRET_KEY or "internal-secret"):` (relay_message) | Reemplazar por `if token != INTERNAL_SECRET_KEY:` |
| ~1047 | `if token != (INTERNAL_SECRET_KEY or "internal-secret"):` (send_message) | Reemplazar por `if token != INTERNAL_SECRET_KEY:` |

**Nota:** Los números de línea pueden variar después de otros cambios. Buscar por el patrón `or "internal-secret"`.

### orchestrator_service/admin_routes.py

| Línea | Código original (con fallback) | Acción |
|-------|--------------------------------|--------|
| ~4094 | `"X-Internal-Token": INTERNAL_API_TOKEN or "internal-secret",` | Reemplazar por `"X-Internal-Token": INTERNAL_API_TOKEN,` |
| ~4121 | `"X-Internal-Token": INTERNAL_API_TOKEN or "internal-secret",` | Reemplazar por `"X-Internal-Token": INTERNAL_API_TOKEN,` |

**Nota:** Verificar también si hay otros fallbacks de `INTERNAL_SECRET_KEY` con valores por defecto (ej. `os.getenv("INTERNAL_SECRET_KEY", "secret")`). Actualmente no se encontraron.

## Pasos de limpieza

1. **Preparación**: Asegurar que las variables de entorno estén definidas en todos los servicios:
   - `INTERNAL_SECRET_KEY` (preferido)
   - `INTERNAL_API_TOKEN` (alternativa)

2. **Ejecutar pruebas de integración** para verificar que la autenticación inter-servicios funciona sin los fallbacks.

3. **Realizar los cambios** en los archivos listados, eliminando los fallbacks.

4. **Desplegar** los servicios modificados (puede ser un hotfix o parte del próximo release).

5. **Monitorear** logs durante 24 horas para detectar cualquier error de autenticación.

6. **Validar** que no haya regresiones en funcionalidades críticas (webhooks, relay, sync).

## Rollback
Si después de eliminar los fallbacks aparecen errores de autenticación, revertir los cambios y investigar qué servicio no tiene configurada la variable correspondiente.

## Responsable
Equipo de DevOps / Ingeniería de Plataforma.

---

*Última actualización: 2026-04-02*