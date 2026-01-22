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
    2. Si ves errores relacionados con `init_db()` o `AttributeError: Database object has no attribute execute`, asegúrate de estar usando la versión `fix11` del código (Nexus v5.9).
    3. Verifica que la base de datos esté aceptando conexiones antes de que el backend intente inicializar.
