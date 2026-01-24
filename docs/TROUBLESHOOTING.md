# Guía de Solución de Problemas (Troubleshooting)

Este documento recopila los errores más comunes encontrados durante el despliegue del ecosistema Nexus y sus soluciones probadas.

## 1. Errores de Conexión a Base de Datos

### Error: `Connection timed out` o `Operation timed out`
*   **Causa**: El servicio `orchestrator` no puede llegar al servicio `db`. Puede ser por el firewall de EasyPanel o por intentar usar un nombre de host que no se resuelve.
*   **Solución**: 
    1. Asegúrate de que las variables `POSTGRES_DSN` y `SUPABASE_DB_URL` tengan agregado `?sslmode=disable` al final si estás en una red interna.
    2. Reemplaza el nombre de host (ej. `db`) por la IP interna real del contenedor (obtenida con `hostname -i` dentro del servicio de base de datos).

### Error: `Ident authentication failed` o `Password authentication failed`
*   **Causa**: La contraseña en la URL de conexión no coincide con la configurada en el servicio de DB.
*   **Solución**: Verifica que estés usando la variable `POSTGRES_PASSWORD` en tus cadenas de conexión. No confundas la contraseña de la base de datos de "aplicación" con la de la "consola de Supabase" si usas servicios externos.

## 2. Errores de Esquema (RAG / Vectores)

### Error: `invalid input syntax for type bigint` o `AttributeError: 'NoneType' object has no attribute 'execute'`
*   **Causa**: La tabla `documents` se creó incorrectamente con IDs numéricos (`BIGINT`) en lugar de `UUID`, o el script de auto-migración falló.
*   **Solución**: 
    1. Ejecuta el script de rescate: [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) directamente en la consola SQL de tu base de datos.
    2. Este script borrará y recreará la tabla con el formato correcto de UUID que espera LangChain.

## 3. Errores de Frontend (CORS)

### Error: `Failed to fetch` o `CORS Error` en la consola del navegador
*   **Causa**: El Backend está rechazando las peticiones del Frontend porque el origen no está en la lista blanca.
*   **Solución**: 
    1. Verifica la variable de entorno `ALLOWED_ORIGINS` en el servicio `orchestrator`.
    2. Debe contener la URL de tu frontend EXACTA, sin barra al final (ej. `https://mi-frontend.easypanel.host`).
    3. Si el error persiste, revisa si el Backend ha reiniciado correctamente después de cambiar la variable.

## 4. Servicio "Not Reachable" (EasyPanel)

### Problema: Se ve el logo de EasyPanel o "Service is not reachable"
*   **Causa**: El contenedor del Backend ha crasheado durante el arranque o está en un bucle de reinicio.
*   **Solución**: 
    1. Revisa los logs del servicio `orchestrator`.
    2. Si ves errores relacionados con `init_db()` o `AttributeError: Database object has no attribute execute`, asegúrate de estar usando la versión `main` del código (Nexus v6.0).
    3. Verifica que la base de datos esté aceptando conexiones antes de que el backend intente inicializar.

## 5. Errores de Arquitectura (Nexus v6.0)

### Error: `ImportError: cannot import name 'Base'` o `cannot import name 'get_db'`
*   **Causa**: Dependencias circulares. `main.py` importa `models`, que importa `db`, que a su vez importaba `models` (Ciclo de la Muerte).
*   **Solución**:
    1. **Arquitectura Limpia**: `db.py` debe ser "puro" (solo define engine, session, Base). **NUNCA** debe importar modelos.
    2. **Inyección Inversa**: Los modelos deben importar `Base` desde `db.py`.
    3. **Router Deps**: Asegúrate de que `app/api/deps.py` exporte correctamente las funciones que `app/api/templates.py` intenta importar.
6. Errores de Base de Datos Híbrida (RAG)

### Error: "Ghost Delete" (0 rows affected)
*   **Causa**: El código intenta borrar vectores conectándose a la DB Local (`db.pool`) donde no existe la tabla `documents`.
*   **Solución**: El sistema debe usar una **Conexión Dual**. HTTP/REST para Supabase (Vectores) y SQL Local para Metadatos.

### Error: `asyncpg.exceptions.ConnectionTimeoutError` (60s)
*   **Causa**: El firewall de EasyPanel/Docker bloquea el tráfico saliente por el puerto 5432 hacia Supabase.
*   **Solución**: Cambiar el protocolo de borrado a **HTTP REST API** (`httpx`) por el puerto 443.

### Error: `UndefinedColumnError: column "file_path" does not exist`
*   **Causa**: Schema Drift. La tabla `rag_documents` ha evolucionado y ya no tiene rutas físicas en algunas versiones.
*   **Solución**: Simplificar la query de selección `DELETE` para pedir solo `id` y `filename`.

### Error: `TypeError: Object of type UUID is not JSON serializable`
*   **Causa**: Redis intenta serializar un objeto `uuid.UUID` crudo en el mensaje de broadcast.
*   **Solución**: Castear explícitamente a string: `str(doc_id)` antes de enviar.

## 7. Errores de Integridad de Datos (Critical v6.0)

### Error: `operator does not exist: integer = uuid` 
*   **Causa**: Intento de ejecutar un `DELETE/UPDATE` en la tabla `agents` (o cualquier tabla con `tenant_id` entero) pasando un UUID (el ID de sesión del usuario) como criterio de filtro.
*   **Diagnóstico**: El código asume erróneamente que `current_user.tenant_id` es un UUID válido para la columna de la DB, cuando en realidad es un Integer.
*   **Solución Incorrecta**: Intentar castear el UUID a Int (`int(uuid_str)`) causará `ValueError`.
*   **Solución Correcta (Protocolo Estricto)**: 
    Debes resolver el ID numérico consultando la tabla `users` (Fuente de la Verdad):
    ```python
    # Lookup seguro usando el UUID del usuario (que sí es UUID en la DB)
    user_row = await db.pool.fetchrow("SELECT tenant_id FROM users WHERE id = $1", current_user.id)
    tenant_int = user_row['tenant_id'] # Integer
    # Ejecutar la query usando el Integer resuelto
    ```

## 8. Errores de Simulación y Modelos (v6.0)

### Error: `TypeError: Header value must be str or bytes, not NoneType`
*   **Causa**: Intentar simular un agente o enviar un mensaje sin tener la API Key del proveedor (OpenAI/Google) configurada en la bóveda de credenciales del tenant (valor `None`).
*   **Solución**: 
    1. Asegúrate de que el inquilino tenga una clave válida en `Credentials`.
    2. El sistema v6.0 ahora incluye un filtro de headers nulos, pero la falta de la llave impedirá la respuesta de la IA.

### Error: `Model not found (gpt-5-mini)` o similar
*   **Causa**: El `ModelRegistry` no está actualizado a los estándares de Enero 2026 o hay un error de tipeo en el campo `model_version`.
*   **Solución**: 
    1. Verifica que el modelo exista en `app/core/models.py`.
    2. Reinicia el orquestador para recargar el registro oficial.

