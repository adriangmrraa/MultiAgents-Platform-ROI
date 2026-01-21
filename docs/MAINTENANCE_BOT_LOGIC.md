# 🤖 Protocolo de Operaciones: El "Bot de Mantenimiento"

Este documento explica la arquitectura del **Sistema de Mantenimiento Soberano**, una capa lógica diseñada para gestionar la base de datos sin interacción manual SQL. Su objetivo es mantener la integridad, seguridad y sincronización del sistema de manera automatizada.

## 🎯 Filosofía: "No SQL = No Risk"

La premisa es simple: **Nadie toca la base de datos en producción**.
Todas las operaciones destructivas, de limpieza o configuración se realizan a través de una API segura («The Bot API») que valida roles, audita acciones y previene errores humanos catastróficos.

---

## 🛠️ Capacidades del Bot

### 1. El "Soft Delete" (Archivado Seguro)
En lugar de borrar registros y perder historia, el bot marca las entidades como `ARCHIVED`.
- **Endpoint**: `DELETE /admin/tenants/{id}`
- **Lógica**: Cambia `status = 'ARCHIVED'` y desactiva el acceso, pero mantiene los datos para auditoría o restauración futura.
- **Ventaja**: Permite "deshacer" errores fatales de eliminación.

### 2. Sincronización de Credenciales (The Vault Handler)
El bot actúa como intermediario seguro entre servicios externos (Meta, Tienda Nube) y la base de datos.
- **Flujo**:
    1.  El servicio externo recibe las credenciales OAuth (tokens).
    2.  Llama internamente a `/admin/credentials/internal-sync`.
    3.  El bot **encripta** los tokens sensibles antes de guardarlos.
    4.  El bot **verifica** la estructura de los datos (JSON) antes de insertarlos.
- **Ventaja**: Garantiza que nunca se guarden tokens en texto plano por error humano.

### 3. El Cirujano de Esquema (`Schema Surgeon`)
Al inicio del servicio (`startup`), el bot verifica que la base de datos tenga la estructura correcta para la versión del código desplegada.
- **Acción**: Si faltan tablas o columnas críticas (ej: `audit_logs`), las crea automáticamente.
- **Ubicación**: `main.py` -> `lifespan` event.
- **Ventaja**: Despliegues "Zero-Touch". No necesitas correr scripts SQL manuales al actualizar el sistema.

---

## 🚀 Guía de Replicación para Nuevos Proyectos

Para implementar este "Bot de Mantenimiento" en tu próximo proyecto (con otra IA o Framework), sigue estos principios de diseño:

### A. Capa de Administración (API Routes)
Crea un archivo `admin_routes.py` protegido por un token maestro (`SUPER_ADMIN_TOKEN` o similar).
*   **No expongas SQL directo**: Crea funciones como `archive_user(id)`, `rotate_credentials(id)`.
*   **Manejo de Errores**: El bot debe capturar excepciones y loguearlas antes de fallar (Self-Healing leve).

### B. Inyección de Dependencias
Usa un patrón de middleware para que cada acción del bot verifique:
1.  **Identidad**: ¿Quién llama al bot? (Admin Token).
2.  **Integridad**: ¿El ID existe? ¿Está activo?

```python
# Ejemplo Conceptual
@router.delete("/resource/{id}")
async def maintenance_delete(id: int):
    # 1. Verificar existencia
    if not await exists(id): raise 404
    # 2. Soft Delete
    await db.execute("UPDATE resource SET status='DELETED' WHERE id=$1", id)
    # 3. Log de Auditoría
    await audit_log.info(f"Recurso {id} eliminado por Mantenimiento")
```

### C. El "Internal Secret" (Handshake)
Para que tus microservicios (ej: un servicio de Scraping) hablen con el Bot de Mantenimiento:
*   Define un `INTERNAL_SECRET_KEY` en ambos sistemas.
*   El Bot solo acepta peticiones que traigan este header: `X-Internal-Secret: <KEY>`.

---

## 📋 Checklist de Implementación

1.  [ ] **Endpoint de Salud (`/health`)**: El bot debe reportar si la DB está viva.
2.  [ ] **Soft Delete**: Nunca uses `DELETE FROM` en tablas maestras.
3.  [ ] **Logs de Auditoría**: Cada acción del bot debe dejar rastro en una tabla `audit_logs`.
4.  [ ] **Backup Automático (Opcional)**: El bot puede disparar un `pg_dump` antes de operaciones críticas.
