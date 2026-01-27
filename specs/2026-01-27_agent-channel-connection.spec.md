# Conexión de Agentes IA a Canales Reales (Chatwoot)

**Fecha**: 2026-01-27  
**Prioridad**: CRÍTICA  
**Issue**: Los agentes no responden a mensajes entrantes en canales reales (Instagram, Facebook, WhatsApp)  
**Estado Actual**: Chat de Prueba funciona, canales reales no

---

## 1. Contexto y Objetivos

### Problema
Los agentes IA están correctamente configurados en el Dashboard (activados, con canales asignados, herramientas y modelo seleccionado). El **Chat de Prueba** interno funciona perfectamente, pero los agentes **NO responden** a mensajes entrantes desde canales reales conectados vía Chatwoot (Instagram, Facebook, WhatsApp).

**Síntomas observados**:
- ✅ Agente activado (`is_active = true`)
- ✅ Wizard muestra configuración correcta (canales, herramientas, modelo)
- ✅ Chat de Prueba responde correctamente
- 🔴 Mensajes desde Instagram/Facebook/WhatsApp no generan respuestas del agente
- 🔴 No hay evidencia en logs de que el motor de IA se esté ejecutando

### Solución
Implementar el flujo completo de conexión entre el webhook de Chatwoot y el motor de IA (`execute_agent_v3_logic`), asegurando que:
1. Los mensajes entrantes se reciban correctamente en el webhook.
2. El Atomic Buffer se ejecute y dispare el procesamiento.
3. El motor de IA se active con las credenciales correctas del tenant.
4. La respuesta generada se envíe de vuelta al canal correcto vía Chatwoot.

### KPIs
- **Tasa de respuesta**: 100% de mensajes entrantes deben generar una respuesta del agente (o un log de error).
- **Latencia**: Respuesta dentro de 20 segundos (16s buffer + 4s procesamiento).
- **Precisión de canal**: 0% de mensajes enviados al canal incorrecto.

---

## 2. Esquemas de Datos

### Entradas (Webhook Chatwoot)

**Payload del webhook** (`POST /admin/chatwoot/webhook`):
```typescript
interface ChatwootWebhookPayload {
  event: "message_created";
  message_type: "incoming" | "outgoing";
  content: string;
  private: boolean;
  conversation: {
    id: number;
    channel: string; // "Channel::FacebookPage", "Channel::Instagram", etc.
    meta: {
      sender: {
        id: number;
        name: string;
        thumbnail?: string;
      };
    };
  };
  sender: {
    id: number;
    name: string;
    thumbnail?: string;
  };
  account: {
    id: number;
  };
}
```

### Salidas (Respuesta del Agente)

**Mensaje enviado a Chatwoot**:
```typescript
interface ChatwootMessageResponse {
  conversation_id: number;
  account_id: number;
  content: string;
  message_type: "outgoing";
  private: false;
}
```

### Persistencia

**Tabla afectada**: `agents`
- **Columna crítica**: `channels` (JSONB) - Debe contener `["instagram", "facebook", "whatsapp"]`
- **Validación**: Asegurar que el campo NO esté vacío `[]` o `null`

**Tabla afectada**: `chat_conversations`
- **Columnas críticas**:
  - `external_chatwoot_id` (INTEGER) - ID de conversación en Chatwoot
  - `external_account_id` (INTEGER) - ID de cuenta en Chatwoot
  - `channel` (VARCHAR) - Canal normalizado ("instagram", "facebook", "whatsapp")
  - `meta` (JSONB) - Debe contener `customer_name`, `customer_avatar`, `chatwoot_conversation_id`

**Tabla afectada**: `credentials`
- **Credenciales requeridas por tenant**:
  - `CHATWOOT_API_TOKEN` (categoría: `chatwoot`)
  - `CHATWOOT_BASE_URL` (categoría: `chatwoot`)
  - `CHATWOOT_ACCOUNT_ID` (categoría: `chatwoot`)
  - `OPENAI_API_KEY` (categoría: `openai`)

---

## 3. Lógica de Negocio (Invariantes)

### Regla 1: Activación del Agente
```
SI mensaje.message_type == "incoming" 
Y mensaje.private == false
Y agente.is_active == true
Y mensaje.channel IN agente.channels
ENTONCES disparar execute_agent_v3_logic()
```

### Regla 2: Atomic Buffer
```
SI mensaje entrante recibido
ENTONCES agregar a Redis buffer (key: "buffer:{identifier}")
Y establecer timer de 16 segundos (key: "timer:{identifier}")
Y SI no existe tarea activa (key: "active_task:{identifier}")
  ENTONCES crear background_task(process_buffer_task)
```

### Regla 3: Validación de Credenciales
```
SI tenant NO tiene OPENAI_API_KEY
ENTONCES loggear error "Credencial OpenAI faltante para tenant {tenant_id}"
Y NO ejecutar motor de IA
Y retornar 200 OK (para no romper webhook)
```

### Regla 4: Mapeo de Canal
```
SI conversation.channel contiene "Instagram"
ENTONCES nexus_channel = "instagram"

SI conversation.channel contiene "Facebook"
ENTONCES nexus_channel = "facebook"

SI conversation.channel contiene "Whatsapp"
ENTONCES nexus_channel = "whatsapp"
```

### RESTRICCIÓN: Soberanía
- Cada tenant SOLO puede acceder a sus propias conversaciones y credenciales.
- El `tenant_id` se resuelve desde la tabla `credentials` usando el `access_token` del webhook.
- NUNCA usar credenciales globales para procesar mensajes de tenants.

---

## 4. Stack y Restricciones

### Tecnología
- **Backend**: FastAPI (Python 3.11+)
- **Base de Datos**: PostgreSQL 15+
- **Cache**: Redis 7+
- **IA**: OpenAI API (gpt-4o-mini, gpt-4o)
- **Logging**: structlog

### Archivos a modificar
1. **`orchestrator_service/admin_routes.py`**:
   - Línea ~4975: Agregar logging detallado en `process_buffer_task` trigger
   - Línea ~4800: Validar que `msg_type == "incoming"` antes de procesar

2. **`orchestrator_service/main.py`**:
   - Línea ~2040: Agregar logging al inicio de `execute_agent_v3_logic`
   - Línea ~2100: Validar que el agente tenga el canal en su lista de `channels`

### Restricciones
- **Performance**: El buffer de 16 segundos es OBLIGATORIO para evitar respuestas fragmentadas.
- **Seguridad**: NUNCA loggear el contenido completo de mensajes (GDPR/privacidad).
- **Soberanía**: Validar `tenant_id` en CADA query a la base de datos.

---

## 5. Criterios de Aceptación (Gherkin)

### Escenario 1: Mensaje entrante desde Instagram
```gherkin
DADO que un cliente envía "Hola" desde Instagram vía Chatwoot
Y el agente está activado con canal "instagram" en su configuración
Y el tenant tiene credenciales válidas de OpenAI y Chatwoot
CUANDO el webhook recibe el evento "message_created"
ENTONCES el sistema debe:
  - Identificar al cliente correcto (NO al agente Adrian)
  - Agregar el mensaje al buffer de Redis
  - Esperar 16 segundos
  - Ejecutar execute_agent_v3_logic con el contexto correcto
  - Generar una respuesta usando el modelo configurado
  - Enviar la respuesta a Chatwoot
  - La respuesta debe aparecer en la conversación de Instagram del cliente
```

### Escenario 2: Agente sin canal configurado
```gherkin
DADO que un mensaje llega desde Facebook
Y el agente está activado PERO su campo "channels" está vacío []
CUANDO el webhook procesa el mensaje
ENTONCES el sistema debe:
  - Loggear "Agente no tiene canal 'facebook' configurado"
  - NO ejecutar el motor de IA
  - Retornar 200 OK al webhook
```

### Escenario 3: Credencial OpenAI faltante
```gherkin
DADO que un mensaje entrante llega
Y el tenant NO tiene OPENAI_API_KEY en la tabla credentials
CUANDO el buffer intenta procesar el mensaje
ENTONCES el sistema debe:
  - Loggear "Credencial OpenAI faltante para tenant {tenant_id}"
  - NO intentar llamar a la API de OpenAI
  - Retornar sin error (fail-safe)
```

### Escenario 4: Human Handoff activo
```gherkin
DADO que un agente humano respondió manualmente hace 2 horas
Y el sistema detectó el "Eco" y activó el bloqueo de 24h
CUANDO llega un nuevo mensaje del cliente
ENTONCES el sistema debe:
  - Verificar que paused_until > NOW()
  - NO ejecutar el motor de IA
  - Loggear "Conversación en Human Handoff Lock"
```

### Escenario 5: Chat de Prueba vs Canal Real
```gherkin
DADO que el Chat de Prueba funciona correctamente
Y los canales reales NO funcionan
CUANDO comparo ambos flujos
ENTONCES debo identificar:
  - ¿El webhook está recibiendo mensajes? (verificar logs)
  - ¿El tenant_id se resuelve correctamente?
  - ¿El campo "channels" del agente incluye el canal correcto?
  - ¿El process_buffer_task se está ejecutando?
```

---

## 6. Plan de Diagnóstico (Pre-Implementación)

Antes de modificar código, ejecutar estos pasos de diagnóstico:

### Paso 1: Verificar recepción de webhooks
```bash
# En el contenedor orchestrator_service
tail -f /var/log/orchestrator.log | grep "chatwoot_webhook"
```
**Esperado**: Logs como `WEBHOOK DEBUG: Raw Channel='instagram'`

### Paso 2: Validar configuración de agentes
```sql
SELECT id, name, channels, is_active, tenant_id 
FROM agents 
WHERE is_active = true;
```
**Esperado**: `channels` debe ser `["instagram", "facebook", "whatsapp"]` (no vacío)

### Paso 3: Validar credenciales del tenant
```sql
SELECT 
    a.id AS agent_id,
    a.name AS agent_name,
    a.tenant_id,
    c.name AS credential_name,
    c.category
FROM agents a
LEFT JOIN credentials c ON a.tenant_id = c.tenant_id
WHERE a.is_active = true AND c.category IN ('chatwoot', 'openai')
ORDER BY a.tenant_id;
```
**Esperado**: Cada agente debe tener al menos 4 credenciales (CHATWOOT_API_TOKEN, CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, OPENAI_API_KEY)

### Paso 4: Agregar logging temporal
En `admin_routes.py` (línea ~4975):
```python
logger.info(f"🔥 BUFFER TASK TRIGGERED | identifier={identifier} | tenant={tenant_id} | channel={nexus_channel}")
```

En `main.py` (línea ~2040):
```python
logger.info(f"🤖 AI ENGINE STARTED | from={from_num} | tenant={t_id} | conv={c_id} | channel={ch_source}")
```

---

## 7. Implementación Propuesta

### Cambio 1: Validación de canal en el agente
**Archivo**: `orchestrator_service/main.py`  
**Línea**: ~2100  
**Acción**: Antes de ejecutar el motor de IA, validar que el agente tenga el canal en su configuración.

```python
# Obtener agente
agent_row = await db.pool.fetchrow(
    "SELECT id, channels FROM agents WHERE tenant_id = $1 AND is_active = true LIMIT 1",
    t_id
)

if not agent_row:
    logger.warning(f"No active agent found for tenant {t_id}")
    return

# Validar canal
agent_channels = agent_row['channels'] or []
if ch_source not in agent_channels:
    logger.warning(f"Agent does not have channel '{ch_source}' configured | agent_id={agent_row['id']} | channels={agent_channels}")
    return
```

### Cambio 2: Logging detallado en buffer trigger
**Archivo**: `orchestrator_service/admin_routes.py`  
**Línea**: ~4975  
**Acción**: Agregar log para confirmar que el buffer task se dispara.

```python
logger.info(f"🔥 BUFFER TASK TRIGGERED | identifier={identifier} | tenant={tenant_id} | channel={nexus_channel} | customer={customer_map.get('name')}")
```

### Cambio 3: Validación de credenciales antes de IA
**Archivo**: `orchestrator_service/main.py`  
**Línea**: ~2050  
**Acción**: Verificar que exista OPENAI_API_KEY antes de llamar a la API.

```python
from utils import get_tenant_credential

openai_key = await get_tenant_credential(t_id, "openai", "OPENAI_API_KEY")
if not openai_key:
    logger.error(f"OPENAI_API_KEY missing for tenant {t_id}")
    return
```

---

## 8. Verificación Post-Implementación

### Test 1: Enviar mensaje desde Instagram
1. Enviar "Hola" desde una cuenta de Instagram conectada a Chatwoot.
2. Verificar logs del Orchestrator:
   - `WEBHOOK DEBUG: Raw Channel='instagram'`
   - `🔥 BUFFER TASK TRIGGERED`
   - `🤖 AI ENGINE STARTED`
3. Confirmar que la respuesta aparece en Instagram.

### Test 2: Agente sin canal configurado
1. Remover "instagram" del campo `channels` del agente.
2. Enviar mensaje desde Instagram.
3. Verificar log: `Agent does not have channel 'instagram' configured`
4. Confirmar que NO se ejecuta el motor de IA.

### Test 3: Credencial faltante
1. Eliminar `OPENAI_API_KEY` de la tabla `credentials` para el tenant.
2. Enviar mensaje.
3. Verificar log: `OPENAI_API_KEY missing for tenant {tenant_id}`
4. Confirmar que NO se llama a OpenAI API.

---

## 9. Rollback Plan

Si la implementación causa problemas:

1. **Bypass del Atomic Buffer** (temporal):
   ```python
   # Comentar líneas 4974-4985 en admin_routes.py
   # Llamar directamente a execute_agent_v3_logic
   async for _ in execute_agent_v3_logic(identifier, tenant_id, conversation_id, str(uuid.uuid4()), data, customer_map.get("name"), nexus_channel):
       pass
   ```

2. **Revertir cambios**:
   ```bash
   git revert <commit_hash>
   ```

3. **Logs de emergencia**:
   - Habilitar `DEBUG` level en structlog
   - Capturar payload completo del webhook (solo en staging)

---

**Próximos pasos**: Ejecutar el plan de diagnóstico (Sección 6) antes de implementar cambios.
