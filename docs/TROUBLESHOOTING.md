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
*   **Causa**: Intentar enviar un mensaje vía Chatwoot sin el token configurado (`None`).
*   **Solución**: 
    1. Asegúrate de que el inquilino tenga la credencial `CHATWOOT_API_TOKEN` en la bóveda, o que el servicio tenga `CHATWOOT_BOT_TOKEN` en el `.env`.
    2. El sistema v6.1 ahora incluye un fallback a string vacío para evitar este crash, pero el mensaje no se enviará sin un token válido.

### Error: `Model not found (gpt-4o-mini)` o similar
*   **Causa**: El `ModelRegistry` no está actualizado o hay un error de tipeo en el campo `model_version`.
*   **Solución**: Verifica que el modelo exista en `app/core/models.py`. Si usas `gpt-4o-mini` (Estándar v6.1), asegúrate de que el tenant tenga acceso a dicho modelo.

## 9. Errores de Integración Multicanal

### Error: `404 Not Found` al enviar manual desde el panel
*   **Causa**: El ID de conversación o el ID de cuenta de Chatwoot son incorrectos o el `CHATWOOT_BASE_URL` no es el adecuado para el inquilino.
*   **Diagnóstico**: Revisa los logs de `chatwoot_delivery_attempt`. Si el `account_id` es `"1"` y el inquilino es externo, es probable que falte la credencial `CHATWOOT_ACCOUNT_ID`.
*   **Solución**: 
    1. Asegúrate de que la tabla `chat_conversations` tenga poblada la columna `external_chatwoot_id` y `external_account_id`.
    2. A partir de v6.1, el Orchestrator auto-descubre y persiste estos IDs desde el primer mensaje entrante.
    3. Verifica las credenciales `CHATWOOT_ACCOUNT_ID` y `CHATWOOT_BASE_URL` en la tabla `credentials` para el `tenant_id` correspondiente.

### Error: `TypeError: error() got an unexpected keyword argument`
*   **Causa**: Uso de argumentos de palabra clave no soportados por el logger estándar de Python (ej. `url=...`, `account_id=...`).
*   **Solución**: Usa f-strings para incluir la información directamente en el mensaje del log: `logger.error(f"Mensaje | URL: {url}")`.

## 10. Errores de Sincronización Humana
*   **Síntoma**: El bot responde aunque yo esté hablando por Chatwoot.
*   **Causa**: El "Eco" del mensaje humano no está llegando al Orchestrator.
*   **Solución**: Verifica que el `whatsapp_service` (o el gateway correspondiente) tenga acceso al Orchestrator y esté configurado para reenviar eventos `outgoing`. Revisa que `is_echo` se marque como `True` en los logs del Orchestrator.

---

## 11. Errores Específicos v6.2 (Identity & Credentials)

### Error: "Conversación con mi nombre" en el Dashboard
*   **Síntoma**: Aparece un chat con tu nombre (ej: Adrian Gamarra) en lugar del cliente.
*   **Causa**: Versiones anteriores a v6.2 usaban al remitente del mensaje (agente) como identidad de la conversación.
*   **Solución**: La v6.2 corrige esto automáticamente. Si ves un chat con tu nombre, simplemente envía un nuevo mensaje desde Chatwoot y el sistema actualizará la identidad al cliente real.

### Error: Campos de credenciales aparecen como "********"
*   **Síntoma**: No puedes editar API Tokens o Base URLs en el Dashboard.
*   **Causa**: Las credenciales están encriptadas y el endpoint no las decriptaba para el frontend.
*   **Solución v6.2**: El sistema ahora decripta automáticamente las categorías sensibles (`CHATWOOT`, `WHATSAPP`, `OPENAI`) antes de enviarlas al Dashboard.

### Error: `401 Unauthorized` entre microservicios
*   **Síntoma**: WhatsApp Service o Tienda Nube Service no pueden comunicarse con el Orchestrator.
*   **Causa**: Mismatch en el header de seguridad o token interno incorrecto.
*   **Solución**: 
    1. Verifica que el header sea `X-Internal-Token` (v6.2 estándar).
    2. Asegúrate de que `INTERNAL_API_TOKEN` sea idéntico en todos los servicios.

### Error: Media Proxy (Imágenes/Audios no cargan)
*   **Síntoma**: Los archivos multimedia no se visualizan en el chat.
*   **Causa**: El endpoint `get_media` no tenía aislamiento de inquilinos.
*   **Solución v6.2**: 
    1. `get_media` ahora requiere `tenant_id`.
    2. Verifica que la credencial `YCLOUD_API_KEY` exista en la tabla `credentials` para ese tenant.

---

## 12. Agentes No Responden en Canales Reales (Issue Activo - Enero 2026)

### 🔴 Síntoma: El agente funciona en Chat de Prueba pero no responde en Instagram/Facebook/WhatsApp

**Contexto**:
- El agente está **activado** (`is_active = true`).
- El Wizard muestra configuración correcta (canales, herramientas, modelo).
- El **Chat de Prueba** interno funciona perfectamente.
- Los mensajes entrantes desde canales reales NO generan respuestas del agente.

**Diagnóstico paso a paso**:

#### 1. Verificar recepción de webhooks
Revisa los logs del Orchestrator para confirmar que los mensajes están llegando:
```bash
# En el contenedor del orchestrator_service
tail -f /var/log/orchestrator.log | grep "chatwoot_webhook"
```

**Qué buscar**: Líneas como `WEBHOOK DEBUG: Raw Channel='instagram'` o `message_created event received`.

#### 2. Validar tenant_id y credenciales
Ejecuta esta query para confirmar la alineación:
```sql
SELECT 
    a.id AS agent_id,
    a.name AS agent_name,
    a.tenant_id,
    a.channels,
    a.is_active,
    c.name AS credential_name,
    c.category
FROM agents a
LEFT JOIN credentials c ON a.tenant_id = c.tenant_id
WHERE a.is_active = true AND c.category IN ('chatwoot', 'openai')
ORDER BY a.tenant_id;
```

**Qué buscar**: Confirma que cada agente activo tiene credenciales de `chatwoot` y `openai` en su `tenant_id`.

#### 3. Verificar campo `channels` en agentes
```sql
SELECT id, name, channels 
FROM agents 
WHERE is_active = true;
```

**Formato esperado**: `["instagram", "facebook", "whatsapp"]` (JSON array).
**Error común**: Si el campo está vacío `[]` o es `null`, el agente no se activará para ningún canal.

#### 4. Confirmar ejecución del Atomic Buffer
Agrega logging temporal en `admin_routes.py` (línea ~4975):
```python
logger.info(f"🔥 BUFFER TASK TRIGGERED | identifier={identifier} | tenant={tenant_id}")
```

Envía un mensaje de prueba y busca este log. Si no aparece, el `process_buffer_task` no se está ejecutando.

#### 5. Revisar el motor de IA
Verifica que `execute_agent_v3_logic` en `main.py` esté recibiendo el contexto correcto:
```python
# Línea ~2040 en main.py
logger.info(f"🤖 AI ENGINE STARTED | from={from_num} | tenant={t_id} | conv={c_id}")
```

**Causas comunes de fallo**:
- **Credencial OpenAI faltante o inválida**: El motor se detiene silenciosamente.
- **Modelo no disponible**: Si el agente usa `gpt-4o` y el tenant no tiene acceso, falla sin error visible.
- **Timeout de Redis**: Si el buffer expira antes de procesarse.

---

**Solución temporal (Bypass del Buffer)**:
Si necesitas probar sin el Atomic Buffer, comenta las líneas 4974-4985 en `admin_routes.py` y llama directamente a:
```python
async for _ in execute_agent_v3_logic(identifier, tenant_id, conversation_id, str(uuid.uuid4()), data, customer_map.get("name"), nexus_channel):
    pass
```

**⚠️ Advertencia**: Esto eliminará el debounce inteligente y puede causar respuestas fragmentadas.

---

## 14. Errores de Frontend - TypeError: i.map is not a function (v6.2)

### Error: `TypeError: i.map is not a function` en página de Agentes
*   **Síntoma**: La página `/admin/agents` muestra "Nexus System Failure" con error en consola del navegador.
*   **Causa**: El endpoint del backend devuelve un objeto `{"key": [...]}` en lugar de un array `[...]` directamente.
*   **Diagnóstico**: 
    1. Verificar en Network tab del navegador la respuesta de `/admin/agents` o `/admin/tenants`
    2. Si la respuesta es `{"tenants": [...]}` en lugar de `[...]`, el frontend no puede hacer `.map()`
    3. El componente React espera un array pero recibe un objeto

*   **Solución v6.2**:
    ```python
    # INCORRECTO (causa el error)
    @router.get("/tenants")
    async def list_tenants():
        results = [...]
        return {"tenants": results}  # ❌ Objeto
    
    # CORRECTO (v6.2)
    @router.get("/tenants")
    async def list_tenants():
        results = [...]
        return results  # ✅ Array directo
    ```

*   **Endpoints afectados** (verificar que devuelvan arrays):
    - `GET /admin/agents` → Debe devolver `[{...}, {...}]`
    - `GET /admin/tenants` → Debe devolver `[{...}, {...}]`
    - `GET /admin/tools` → Debe devolver `[{...}, {...}]`
    - `GET /admin/knowledge/list` → Debe devolver `[{...}, {...}]`

*   **Verificación rápida**:
    ```bash
    # Probar endpoint directamente
    curl -H "Authorization: Bearer TOKEN" https://api.tudominio.com/admin/agents
    
    # Debe devolver:
    [{...}, {...}]  # ✅ Correcto
    
    # NO debe devolver:
    {"agents": [{...}]}  # ❌ Incorrecto
    ```

*   **Fix adicional**: Si el error persiste después de corregir el backend:
    1. Hacer hard refresh en el navegador: `Ctrl + Shift + R` (Windows/Linux) o `Cmd + Shift + R` (Mac)
    2. Limpiar caché del navegador
    3. Rebuild del frontend si es necesario: `npm run build`

---

**© 2026 Platform AI Solutions - Sovereign Troubleshooting Division**

