# Estado del Proyecto Nexus v6.2 (Enero 2026)

Este documento registra el estado actual de desarrollo, issues conocidos y próximos pasos del proyecto Platform AI Solutions.

---

## 📊 Resumen Ejecutivo

| Componente | Estado | Última Verificación |
|:-----------|:-------|:-------------------|
| **Chatwoot Integration** | ✅ Operativo | 27/01/2026 01:30 |
| **Meta OAuth** | ⚠️ Pendiente Validación | 27/01/2026 01:30 |
| **Agentes IA** | 🔴 No Responden | 27/01/2026 01:30 |
| **Dashboard UI** | ✅ Funcional | 27/01/2026 01:30 |
| **RAG System** | ✅ Operativo | 27/01/2026 01:30 |
| **Tienda Nube** | ✅ Operativo | 27/01/2026 01:30 |

---

## ✅ Componentes Operativos

### 1. Chatwoot Integration (v6.2)

**Estado**: Completamente funcional como canal bidireccional.

**Funcionalidades verificadas**:
- ✅ Recepción de mensajes vía webhook unificado (`/admin/chatwoot/webhook`)
- ✅ Envío de mensajes a Chatwoot (Instagram, Facebook, WebChat)
- ✅ Corrección de identidad: no más conversaciones duplicadas con nombre del agente
- ✅ Atomic Buffer: debounce de 16 segundos funcionando
- ✅ Human Handoff: detección de Ecos y bloqueo de 24h
- ✅ Persistencia de metadatos: `customer_name`, `customer_avatar` en DB

**Canales soportados**:
- Instagram Direct (vía Chatwoot)
- Facebook Messenger (vía Chatwoot)
- WebChat (widget nativo de Chatwoot)

**Archivos clave**:
- `orchestrator_service/admin_routes.py` (líneas 4764-4990)
- `docs/CHATWOOT_GUIDE.md`

---

### 2. Dashboard UI

**Estado**: Funcional con todas las vistas principales.

**Vistas operativas**:
- ✅ Login/Registro
- ✅ Chat (conversaciones en tiempo real)
- ✅ Agentes (creación, edición, wizard)
- ✅ Settings (credenciales, integraciones)
- ✅ RAG (upload, delete, collections)

---

### 3. RAG System

**Estado**: Operativo con Supabase/pgvector.

**Funcionalidades**:
- ✅ Upload de documentos (PDF, DOCX, TXT)
- ✅ Eliminación robusta (fail-safe deletion)
- ✅ Colecciones aisladas por tenant
- ✅ Búsqueda vectorial funcionando

---

### 4. Tienda Nube Integration

**Estado**: OAuth funcionando, sincronización de catálogo operativa.

---

## ⚠️ Componentes Pendientes de Validación

### Meta OAuth Integration

**Estado**: Implementación completa, pero sin confirmación de persistencia.

**Issue conocido**:
- El popup de OAuth se cierra correctamente tras la autorización.
- **Incertidumbre**: No se ha verificado si las credenciales se guardan en la tabla `credentials` tras el cierre.

**Acción requerida**:
1. Ejecutar query de verificación:
   ```sql
   SELECT name, category, scope, tenant_id, created_at, value
   FROM credentials 
   WHERE category = 'meta' OR name LIKE '%META%' OR name LIKE '%FACEBOOK%'
   ORDER BY created_at DESC;
   ```
2. Si existen registros, desencriptar con `decrypt_password()` para validar.
3. Si NO existen, revisar el endpoint `/admin/meta/connect` para confirmar que el guardado se ejecuta.

**Archivos a revisar**:
- `frontend_react/src/views/MetaSettings.tsx`
- `orchestrator_service/admin_routes.py` (endpoint `/admin/meta/connect`)

---

## 🔴 Issues Críticos

### 1. Agentes No Responden en Canales Reales

**Prioridad**: ALTA

**Descripción**:
Los agentes están correctamente configurados (activados, con canales asignados, herramientas y modelo seleccionado). El **Chat de Prueba** interno funciona perfectamente, pero los agentes NO responden a mensajes entrantes desde canales reales (Instagram, Facebook, WhatsApp vía Chatwoot).

**Síntomas**:
- ✅ Agente activado (`is_active = true`)
- ✅ Wizard muestra configuración correcta
- ✅ Chat de Prueba funciona
- 🔴 Mensajes desde Instagram/Facebook no generan respuestas

**Hipótesis de causa**:
1. **Desalineación de tenant_id**: El webhook recibe mensajes pero no encuentra el agente correcto.
2. **Campo `channels` vacío o mal formateado**: El agente no se activa para el canal específico.
3. **Atomic Buffer no ejecutándose**: El `process_buffer_task` no se dispara tras el debounce.
4. **Motor de IA fallando silenciosamente**: Credencial OpenAI inválida o modelo no disponible.

**Diagnóstico paso a paso**:

#### Paso 1: Verificar recepción de webhooks
```bash
# En el contenedor orchestrator_service
tail -f /var/log/orchestrator.log | grep "chatwoot_webhook"
```
**Qué buscar**: Logs como `WEBHOOK DEBUG: Raw Channel='instagram'` o `message_created event received`.

#### Paso 2: Validar tenant_id y credenciales
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

#### Paso 3: Verificar formato del campo `channels`
```sql
SELECT id, name, channels 
FROM agents 
WHERE is_active = true;
```
**Formato esperado**: `["instagram", "facebook", "whatsapp"]` (JSON array).

#### Paso 4: Agregar logging temporal
En `admin_routes.py` (línea ~4975):
```python
logger.info(f"🔥 BUFFER TASK TRIGGERED | identifier={identifier} | tenant={tenant_id}")
```

En `main.py` (línea ~2040):
```python
logger.info(f"🤖 AI ENGINE STARTED | from={from_num} | tenant={t_id} | conv={c_id}")
```

#### Paso 5: Bypass temporal del buffer (solo para testing)
Comentar líneas 4974-4985 en `admin_routes.py` y llamar directamente:
```python
async for _ in execute_agent_v3_logic(identifier, tenant_id, conversation_id, str(uuid.uuid4()), data, customer_map.get("name"), nexus_channel):
    pass
```

**Archivos afectados**:
- `orchestrator_service/admin_routes.py` (webhook receiver)
- `orchestrator_service/main.py` (motor de IA)
- Tabla `agents` (configuración)
- Tabla `credentials` (API keys)

---

## 📋 Próximos Pasos

### Inmediatos (Hoy)
1. ✅ Documentar estado actual del proyecto
2. ⏳ Ejecutar queries de diagnóstico para Meta OAuth
3. ⏳ Habilitar logging detallado en webhook de Chatwoot
4. ⏳ Enviar mensaje de prueba desde Instagram y capturar payload completo

### Corto Plazo (Esta Semana)
1. Resolver issue de agentes no respondiendo
2. Validar persistencia de credenciales Meta
3. Implementar tests automatizados para el flujo de mensajería
4. Documentar protocolo de debugging para futuros issues

### Medio Plazo (Este Mes)
1. Completar integración Meta Direct (sin Chatwoot como intermediario)
2. Implementar WhatsApp Cloud API (Meta WABA)
3. Mejorar sistema de logging centralizado
4. Crear dashboard de monitoreo en tiempo real

---

## 📝 Notas de Desarrollo

### Cambios Recientes (v6.2)
- **27/01/2026**: Corrección de identidad en Chatwoot (customer_map vs contact_map)
- **27/01/2026**: Implementación de Atomic Buffer (16s debounce)
- **27/01/2026**: Detección automática de Human Handoff
- **27/01/2026**: Restauración de Internal Credentials API (`/admin/internal/credentials/{name}`)
- **27/01/2026**: Estandarización de header de seguridad (`X-Internal-Token`)

### Lecciones Aprendidas
1. **Documentación es crítica**: La pérdida de información en docs causó confusión. Implementamos Smart Doc Keeper.
2. **Logging detallado salva vidas**: Sin logs, el debugging de webhooks es imposible.
3. **Testing en producción es inevitable**: Algunos issues solo aparecen con canales reales (Instagram, Facebook).

---

**Última actualización**: 27 de Enero, 2026 - 01:30 AM (UTC-3)
**Responsable**: Adrian Gamarra
**Versión del Sistema**: Nexus v6.2 (Sovereign Engine)
