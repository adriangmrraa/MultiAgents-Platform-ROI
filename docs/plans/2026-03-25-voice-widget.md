# PLAN TÉCNICO: Voice Widget — Asistente de Voz para Tiendas Nube

## Fecha: 2026-03-25
## Specs de referencia:
- `specs/2026-03-25_voice-widget-spec-1-backend.spec.md`
- `specs/2026-03-25_voice-widget-spec-2-frontend.spec.md`
- `specs/2026-03-25_voice-widget-spec-3-embeddable-sdk.spec.md`

---

## NOTA ARQUITECTÓNICA

Este plan sigue los patrones del código **REAL** del proyecto (schemas inline en routes, queries con `db.pool.fetch*`, sin service layer separado) por consistencia con `admin_routes.py`, `Agents.tsx`, `Channels.tsx`, etc. El workflow `new_feature.md` describe una arquitectura ideal (DDD: schemas/ + services/ + endpoints/) que el proyecto no implementa actualmente. Si en el futuro se refactoriza a ese patrón, estas rutas se migrarían también.

---

## ANÁLISIS DE IMPACTO (Pre-implementación — workflow new_feature paso 1)

### Base de Datos
- [x] Tabla nueva: `voice_widget_configs` (modelo en `app/models/`)
- [x] Tabla nueva: `voice_usage_records` (tracking de consumo)
- [ ] No requiere vectores/RAG

### Credenciales
- [x] Nueva categoría: `nvidia` (NGC API Key por tenant, scope: tenant)
- [x] Usa categoría existente: `openai`
- [ ] No requiere nuevos OAuth flows

### Servicios Afectados
- [x] `orchestrator_service`: CRUD + WebSocket + endpoints públicos + billing voice
- [x] `frontend_react`: Nueva página `/voice-widget` + sidebar nav item
- [x] `Redis`: Sessions efímeras + IP blocking por abuso + rate limiting
- [ ] `agent_service`: No directamente (se usa NexusEngine via orchestrator)
- [ ] `whatsapp_service`: No afectado (solo el número del tenant se usa para CTA de abuso)
- [ ] `meta_service`: No afectado
- [ ] `tiendanube_service`: No afectado

### Multi-Tenancy
- [x] Todas las queries filtran por `tenant_id`
- [x] `widget_token` no expone `tenant_id` al público
- [x] Validación: `agent_id` debe pertenecer al tenant
- [x] Credential scope: `tenant` para NGC_API_KEY (cada tenant pone su propia key)
- [x] Plan/billing scoped por tenant (minutos de voz medidos individualmente)
- [x] Endpoint público no retorna `system_prompt`, `tenant_id`, ni API keys

---

## RESUMEN EJECUTIVO

4 fases de implementación, 23 tareas atómicas. Cada fase es desplegable de forma independiente.

| Fase | Entregable | Tareas |
|------|-----------|--------|
| **Fase 1** | Backend CRUD + tabla + endpoints | T1–T6 |
| **Fase 2** | Frontend config page + sidebar + preview | T7–T13 |
| **Fase 3** | SDK embebible (botón visual, sin audio) | T14–T16 |
| **Fase 4** | Audio funcional: OpenAI Realtime + NVIDIA Riva | T17–T22 |
| **Cierre** | Sovereign Audit de seguridad multi-tenant | T23 |

---

## FASE 1: BACKEND — Data Layer + CRUD + Billing

### T1: Modelo SQLAlchemy `VoiceWidgetConfig`
**Archivo a crear**: `orchestrator_service/app/models/voice_widget.py`
**Archivo a modificar**: `orchestrator_service/app/models/__init__.py`

```python
# voice_widget.py — SQLAlchemy model
class VoiceWidgetConfig(Base, TimestampMixin):
    __tablename__ = "voice_widget_configs"
    id, tenant_id (FK tenants), agent_id (FK agents),
    widget_name, brand_color, button_size, button_position, button_icon,
    avatar_url, welcome_message,
    voice_provider, voice_model, stt_provider, stt_model, language,
    voice_pipeline, realtime_provider,
    system_prompt_override, temperature_override, max_call_duration,
    api_key_mode,  # 'platform' | 'byok'
    widget_token (unique, 64 chars),
    is_active

class VoiceUsageRecord(Base, TimestampMixin):
    __tablename__ = "voice_usage_records"
    id, tenant_id, widget_id, session_id, duration_seconds,
    api_key_mode, provider, visitor_ip, abuse_detected
```

**Pasos**:
1. Crear `voice_widget.py` con ambos modelos
2. Registrar en `__init__.py`: agregar `from app.models.voice_widget import VoiceWidgetConfig, VoiceUsageRecord`
3. Agregar import en `orchestrator_service/main.py` línea ~1342 (junto a los otros model imports antes de `create_all`)

**Verificación**: `python -c "from app.models.voice_widget import VoiceWidgetConfig, VoiceUsageRecord; print('OK')"`

---

### T2: Migration SQL (Maintenance Robot)
**Archivo a modificar**: `orchestrator_service/main.py` — dentro de `migration_steps` list

Agregar al final de `migration_steps`:

```sql
CREATE TABLE IF NOT EXISTS voice_widget_configs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    widget_name VARCHAR(100) DEFAULT 'Asistente de Voz',
    brand_color VARCHAR(7) DEFAULT '#8B5CF6',
    button_size VARCHAR(10) DEFAULT 'md',
    button_position VARCHAR(20) DEFAULT 'bottom-right',
    button_icon VARCHAR(20) DEFAULT 'phone',
    avatar_url TEXT DEFAULT NULL,
    welcome_message TEXT DEFAULT '¡Hola! Toca para hablar conmigo.',
    voice_provider VARCHAR(50) DEFAULT 'openai',
    voice_model VARCHAR(100) DEFAULT 'alloy',
    stt_provider VARCHAR(50) DEFAULT 'openai',
    stt_model VARCHAR(100) DEFAULT 'whisper-1',
    language VARCHAR(10) DEFAULT 'es',
    voice_pipeline VARCHAR(20) DEFAULT 'realtime',
    realtime_provider VARCHAR(50) DEFAULT 'openai',
    system_prompt_override TEXT DEFAULT NULL,
    temperature_override FLOAT DEFAULT NULL,
    max_call_duration INTEGER DEFAULT 300,
    api_key_mode VARCHAR(10) DEFAULT 'platform',
    widget_token VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_usage_records (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    widget_id INTEGER REFERENCES voice_widget_configs(id),
    session_id VARCHAR(64) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    api_key_mode VARCHAR(10) DEFAULT 'platform',
    provider VARCHAR(50),
    visitor_ip VARCHAR(45),
    abuse_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Verificación**: Startup del orchestrator sin errores. Tablas visibles en DB.

---

### T3: Pydantic schemas
**Archivo a crear dentro de**: `orchestrator_service/app/routes/voice_widget_routes.py` (inline, como hacen las demás rutas)

```python
class VoiceWidgetCreate(BaseModel):
    agent_id: int
    widget_name: str = "Asistente de Voz"
    brand_color: str = "#8B5CF6"
    button_size: str = "md"
    button_position: str = "bottom-right"
    button_icon: str = "phone"
    avatar_url: Optional[str] = None
    welcome_message: str = "¡Hola! Toca para hablar conmigo."
    voice_provider: str = "openai"
    voice_model: str = "alloy"
    stt_provider: str = "openai"
    stt_model: str = "whisper-1"
    language: str = "es"
    voice_pipeline: str = "realtime"
    realtime_provider: str = "openai"
    system_prompt_override: Optional[str] = None
    temperature_override: Optional[float] = None
    max_call_duration: int = 300
    api_key_mode: str = "platform"
    is_active: bool = True
```

---

### T4: Endpoints CRUD admin
**Archivo a crear**: `orchestrator_service/app/routes/voice_widget_routes.py`
**Archivo a modificar**: `orchestrator_service/main.py` — agregar `include_router`

Router: `APIRouter(prefix="/admin/voice-widget", tags=["voice-widget"])`

Endpoints:
1. `GET /admin/voice-widget/config` — Lista widgets del tenant (scoped por `current_user.tenant_id`)
2. `POST /admin/voice-widget/config` — Crear widget
   - Validar: `agent_id` pertenece al tenant
   - Validar: plan es Pro o Enterprise (query a subscriptions)
   - Generar `widget_token = uuid4().hex + uuid4().hex[:32]` (64 chars)
   - Setear `allowed_domains` automáticamente desde `tenants.store_website`
3. `PUT /admin/voice-widget/config/{config_id}` — Update (validar tenant ownership)
4. `DELETE /admin/voice-widget/config/{config_id}` — Delete (validar tenant ownership)
5. `GET /admin/voice-widget/config/{config_id}` — Get single

**Patrón a seguir**: Igual que `admin_routes.py` líneas 5228-5580 (CRUD de agents). Usa `db.pool.fetch*`, `get_current_user`, `verify_admin_token`.

**Registro en main.py** (~línea 1534):
```python
from app.routes.voice_widget_routes import router as voice_widget_router
app.include_router(voice_widget_router)
```

**Verificación**: `curl GET /admin/voice-widget/config -H "Authorization: Bearer ..."` → `[]`

---

### T5: Endpoint providers dinámicos
**Archivo**: `orchestrator_service/app/routes/voice_widget_routes.py` (mismo archivo)

`GET /admin/voice-widget/providers`
- Query `credentials` del tenant para ver qué API keys tiene
- Category mapping: `openai` → OpenAI, `nvidia` → NVIDIA Riva, `elevenlabs` → ElevenLabs, `deepgram` → Deepgram
- Retornar `{ realtime_providers, tts_providers, stt_providers, voices }`

**Verificación**: `curl GET /admin/voice-widget/providers` → JSON con providers disponibles

---

### T6: Endpoint de uso de minutos + guard de plan
**Archivo**: `orchestrator_service/app/routes/voice_widget_routes.py` (mismo archivo)

`GET /admin/voice-widget/usage`
- Query `voice_usage_records` del tenant en el período actual (current_period_start..end)
- Solo contar registros donde `api_key_mode = 'platform'`
- Cruzar con plan del tenant para obtener `voice_minutes_included`:
  - Pro: 60 min, Enterprise: 300 min
- Retornar: `{ plan, voice_minutes_included, voice_minutes_used, voice_minutes_remaining, api_key_mode, billing_period_end }`

**Constantes** (en el mismo archivo o en config):
```python
VOICE_MINUTES_BY_PLAN = {
    "pro": 60,
    "enterprise": 300,
}
VOICE_ADDON_PRICE = {
    "pro": 19,       # USD/mes
    "enterprise": 39, # USD/mes
}
VOICE_OVERAGE_RATE = {
    "pro": 0.35,      # USD/min
    "enterprise": 0.25,
}
```

**Verificación**: `curl GET /admin/voice-widget/usage` → JSON con consumo

---

## FASE 2: FRONTEND — Página de Configuración

### T7: Crear `VoiceWidget.tsx` — estructura base
**Archivo a crear**: `frontend_react/src/views/VoiceWidget.tsx`

Estructura:
```
VoiceWidget.tsx
├── Plan Guard (overlay si plan=free)
├── Usage Bar (mini-dashboard de minutos)
├── Widget List (grid de widgets existentes + "Crear Nuevo")
├── Widget Editor (formulario cuando seleccionas uno)
│   ├── Section 1: Selector de Agente
│   ├── Section 2: Pipeline de Voz + Provider
│   ├── Section 3: Personalización Visual
│   ├── Section 4: Override de Agente (colapsable)
│   ├── Section 5: Modo Billing (Platform vs BYOK)
│   └── Botones: Guardar / Desactivar / Eliminar
├── Preview en Vivo (columna derecha)
└── Snippet de Código (debajo del preview)
```

**Patrón visual**: Seguir `WebSettings.tsx` exactamente:
- Header gradient `from-violet-600/20 to-indigo-600/20`
- Cards `glass` + `border-white/5`
- Inputs `bg-white/5 border-white/10`
- Labels `text-xs font-bold text-slate-400`

**Hook**: `useApi` para todas las llamadas
**State**: Interfaz `VoiceWidgetPageState` de la spec

**Verificación**: La página renderiza sin errores en `/voice-widget`

---

### T8: Ruta + Sidebar
**Archivo a modificar**: `frontend_react/src/App.tsx`

Agregar en imports (~línea 25):
```typescript
import { VoiceWidget } from './views/VoiceWidget';
```

Agregar ruta (~línea 137, después de `/channels`):
```typescript
<Route path="/voice-widget" element={<VoiceWidget />} />
```

**Archivo a modificar**: `frontend_react/src/components/Sidebar.tsx`

Agregar import `Phone` de lucide-react (línea 3).

Agregar NavItem en desktop nav (~línea 81, después de Canales):
```tsx
<NavItem to="/voice-widget" icon={<Phone size={20} />} label="Voice Widget" desc="Asistente de voz para tu tienda" />
```

Agregar en mobile nav (~línea 116):
```tsx
<NavItem to="/voice-widget" icon={<Phone size={20} />} label="Voice" />
```

**Verificación**: Navegar a `/voice-widget` desde sidebar. Visible en mobile y desktop.

---

### T9: Section 1 — Selector de Agente
**Dentro de**: `VoiceWidget.tsx`

- `GET /admin/agents` → filtrar `is_active: true`
- Dropdown con nombre del agente
- Al seleccionar: mostrar card info (modelo, tools, canales)
- Mostrar debajo: "Widget se mostrará en: {agente.store_website}" (heredado de tenant)
- Si no hay agentes: CTA "Crea un agente primero" → link `/agents`

**Verificación**: Dropdown muestra agentes activos. Card info se actualiza al seleccionar.

---

### T10: Section 2 — Pipeline de Voz + Provider
**Dentro de**: `VoiceWidget.tsx`

- Fetch `GET /admin/voice-widget/providers` al montar
- Toggle visual (2 cards): Realtime (badge "Recomendado") / Cascaded (badge "Avanzado")
- Si Realtime:
  - Card selector: OpenAI / NVIDIA Riva (deshabilitado si no tiene key, con tooltip + link `/credentials`)
  - Dropdown de voces (dinámico según provider)
  - Select idioma: es, en, pt
  - Input duración máx (60-600s)
- Si Cascaded:
  - Dropdown TTS provider + modelo voz
  - Dropdown STT provider
  - Idioma + duración

**Verificación**: Al cambiar provider, las voces se actualizan. Providers sin key aparecen disabled.

---

### T11: Section 3-4 — Personalización Visual + Override
**Dentro de**: `VoiceWidget.tsx`

Section 3 (Visual):
- Color picker + text input hex
- Radio group: tamaño (sm/md/lg)
- Radio group: posición (bottom-right/bottom-left)
- Radio group visual: icono (phone/mic/headset)
- Input avatar URL
- Input welcome_message

Section 4 (Override — colapsable con chevron):
- Textarea system_prompt_override
- Range slider temperatura 0.0-1.0

**Verificación**: Todos los campos se reflejan en el formData. Colapsable funciona.

---

### T12: Section 5 — Billing Mode + Preview + Snippet
**Dentro de**: `VoiceWidget.tsx`

Billing Mode:
- 2 cards toggle: "API de Future (X min/mes)" vs "Mi propia API Key (ilimitado)"
- Si BYOK + NVIDIA: textarea NGC API Key
- Si BYOK + OpenAI: nota "Se usará tu OpenAI API Key de Credenciales"

Preview (columna derecha):
- Mockup web genérica (igual que WebSettings.tsx líneas 210-234)
- Botón flotante con brand_color, button_size, button_position, button_icon
- Burbuja welcome_message
- Actualización en tiempo real

Snippet:
- Template con widget_token (o "Guarda primero" si es nuevo)
- Botón Copiar con feedback

**Verificación**: Preview se actualiza al cambiar color/posición/icono. Copiar funciona.

---

### T13: Widget List + CRUD integration
**Dentro de**: `VoiceWidget.tsx`

- Al montar: `GET /admin/voice-widget/config` → widgets[]
- Grid/lista de cards con: nombre, agente, estado (badge verde/rojo), color preview
- Botón "+ Nuevo Widget" abre formulario vacío
- Clic en widget existente → carga formData
- Guardar → POST (si nuevo) o PUT (si editando)
- Eliminar → DELETE con confirmación modal
- Toggle activar/desactivar

Usage bar arriba:
- `GET /admin/voice-widget/usage` → barra de progreso

**Verificación**: CRUD completo funcional. Crear, editar, eliminar, toggle activo.

---

## FASE 3: SDK EMBEBIBLE (Visual MVP)

### T14: Crear `voice-widget-sdk.js` — botón visual
**Archivo a crear**: `orchestrator_service/static/voice-widget-sdk.js`

SDK vanilla JS (~200 líneas para MVP visual):
```javascript
(function() {
  const script = document.currentScript;
  const token = script.dataset.token;
  const API = script.src.replace('/static/voice-widget-sdk.js', '');

  // 1. Fetch config
  fetch(`${API}/public/voice-widget/${token}`)
    .then(r => r.json())
    .then(config => renderWidget(config))
    .catch(() => {}); // silently fail if widget disabled

  function renderWidget(config) {
    // 2. Create Shadow DOM container
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });

    // 3. Inject styles + button HTML
    // States: idle, connecting, active, error, blocked, minutes_exhausted
    // ...
  }
})();
```

**Patrón**: Shadow DOM para encapsulación total. Zero dependencies. < 30KB gzipped.

**Verificación**: `<script src=".../voice-widget-sdk.js" data-token="test123">` renderiza botón flotante.

---

### T15: Endpoint público de config
**Archivo a modificar**: `orchestrator_service/app/routes/voice_widget_routes.py`

`GET /public/voice-widget/{widget_token}` — SIN auth
- Query por widget_token
- Si no existe o is_active=false → 404
- Retornar config sanitizada (sin tenant_id, system_prompt, tokens)
- Incluir `whatsapp_number` del tenant (para CTA de abuso)

**Archivo a modificar**: `orchestrator_service/main.py`
- Montar static files: `app.mount("/static", StaticFiles(directory="static"), name="static")`

**Agregar `/public/` a EXEMPT_PREFIXES** en `subscription_guard.py` (~línea 51):
```python
EXEMPT_PREFIXES = (
    "/platform/",
    "/billing/",
    "/webhook/",
    "/auth/",
    "/admin/",
    "/public/",  # Voice Widget SDK public endpoints
)
```

**Verificación**: `curl /public/voice-widget/{token}` → JSON sin datos sensibles

---

### T16: Snippet dinámico en frontend
**Archivo a modificar**: `frontend_react/src/views/VoiceWidget.tsx`

Generar snippet con URL real del orchestrator:
```html
<script>
  (function(d,t) {
    var s=d.createElement(t);
    s.src="${API_BASE}/static/voice-widget-sdk.js";
    s.defer=true;s.async=true;
    s.dataset.token="${widget_token}";
    d.head.appendChild(s);
  })(document,"script");
</script>
```

Donde `API_BASE` se resuelve al dominio público del orchestrator.

**Verificación**: Snippet copiado funciona al pegarlo en un HTML de prueba.

---

## FASE 4: AUDIO FUNCIONAL

### T17: Endpoint crear sesión
**Archivo a modificar**: `orchestrator_service/app/routes/voice_widget_routes.py`

`POST /public/voice-widget/{widget_token}/session`
- Validar widget activo
- Verificar IP no bloqueada: `redis_client.get(f"voice_blocked:{token}:{ip}")`
- Si `api_key_mode == "platform"`: verificar minutos restantes del tenant
- Resolver agent → cargar system_prompt, enabled_tools
- Resolver API key: si BYOK → credentials del tenant, si platform → key global
- Crear session en Redis con TTL:
  ```python
  session_data = {
      "widget_id", "agent_id", "tenant_id",
      "voice_model", "realtime_provider",
      "system_prompt", "tools",
      "api_key", "api_key_mode",
      "max_duration", "whatsapp_number",
      "visitor_ip"
  }
  redis: voice_session:{session_id} = json(session_data), TTL=max_duration+60
  ```
- Retornar: `{ session_id, ws_url }`
- **Rate limit**: 10/min por IP (usar Redis counter)

**Verificación**: `curl POST /public/voice-widget/{token}/session` → `{ session_id, ws_url }`

---

### T18: WebSocket handler — router
**Archivo a crear**: `orchestrator_service/app/routes/voice_widget_ws.py`

```python
@app.websocket("/public/voice-widget/ws/{session_id}")
async def voice_websocket(websocket: WebSocket, session_id: str):
    session = await redis_client.get(f"voice_session:{session_id}")
    if not session: return websocket.close(4001)

    config = json.loads(session)
    await websocket.accept()

    # Track start time
    start_time = time.time()

    try:
        provider = config['realtime_provider']
        if provider == 'openai':
            await handle_openai_realtime(websocket, config)
        elif provider == 'nvidia':
            await handle_nvidia_riva(websocket, config)
    finally:
        # Record usage
        duration = int(time.time() - start_time)
        await record_voice_usage(config, duration)
```

**Registrar en main.py**: importar y el decorador WebSocket se registra directamente en `app`.

**Verificación**: WebSocket conecta y acepta con session_id válido.

---

### T19: OpenAI Realtime bridge
**Dentro de**: `orchestrator_service/app/routes/voice_widget_ws.py`

```python
async def handle_openai_realtime(websocket, config):
    import websockets
    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "OpenAI-Beta": "realtime=v1"
    }
    async with websockets.connect(url, extra_headers=headers) as openai_ws:
        # Send session config (system prompt + tools)
        await openai_ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "instructions": config['system_prompt'],
                "voice": config['voice_model'],
                "tools": convert_tools_to_openai_format(config['tools']),
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16"
            }
        }))

        # Bidirectional bridge with abuse detection
        # Monitor response for [ABUSE_DETECTED] flag
        ...
```

**Función auxiliar**: `convert_tools_to_openai_format(tools)` — convierte las tools del NexusEngine al formato `{ type: "function", name, description, parameters }` de OpenAI.

**Verificación**: Audio fluye bidireccional. El agente responde por voz.

---

### T20: NVIDIA Riva NIM bridge
**Dentro de**: `orchestrator_service/app/routes/voice_widget_ws.py`

```python
async def handle_nvidia_riva(websocket, config):
    # Connect to Riva ASR + TTS via WebSocket
    # ASR: ws://endpoint/v1/realtime?intent=transcription
    # TTS: ws://endpoint/v1/realtime?intent=synthesize

    # Pipeline: mic → ASR → NexusEngine → TTS → speaker
    # Uses NexusEngine.process() directly — same tools work natively
    ...
```

**Importar NexusEngine**: `from app.core.engine import NexusEngine`

**Key advantage**: No necesita `convert_tools_to_openai_format` — las tools pasan directo por NexusEngine.

**Verificación**: Audio fluye. El agente usa NexusEngine + tools reales. Responde en español.

---

### T21: SDK — captura de audio + WebSocket client
**Archivo a modificar**: `orchestrator_service/static/voice-widget-sdk.js`

Agregar al SDK:
1. `navigator.mediaDevices.getUserMedia({ audio: true })` al clic
2. `AudioContext` + `ScriptProcessorNode` para capturar PCM16 chunks
3. Crear sesión: `POST /public/voice-widget/{token}/session`
4. Conectar WebSocket: `new WebSocket(ws_url)`
5. Enviar audio chunks por WS
6. Recibir audio chunks → `AudioContext.decodeAudioData()` → play
7. UI states: connecting → active (waveform + timer) → idle
8. Botón colgar
9. Handler para WS close codes:
   - `4001` → "Sesión inválida"
   - `4003` → BLOCKED (abuso) → CTA WhatsApp
   - `4004` → MINUTES_EXHAUSTED → CTA WhatsApp

**Verificación**: Visitante habla → escucha respuesta del agente. Timer funciona. Colgar funciona.

---

### T22: Detección de abuso + bloqueo IP
**Archivo a modificar**: `orchestrator_service/app/routes/voice_widget_ws.py`

En ambos handlers (openai y nvidia):
1. Inyectar instrucción en system_prompt:
   ```
   REGLA CRÍTICA: Si el usuario habla sobre temas NO relacionados con la tienda,
   productos o servicios, responde EXACTAMENTE con el prefijo [ABUSE_DETECTED]
   seguido de: "Esta conversación no está relacionada con nuestro negocio.
   Voy a finalizar la llamada."
   ```
2. Monitorear respuestas del agente por `[ABUSE_DETECTED]`
3. Si detectado:
   - Enviar audio final al cliente
   - Guardar en Redis: `voice_blocked:{widget_token}:{visitor_ip}` TTL=3600
   - Registrar `abuse_detected=true` en `voice_usage_records`
   - Cerrar WS con code `4003`
4. En `POST /session`: verificar `voice_blocked:{token}:{ip}` antes de crear sesión

**Verificación**: Hablar de temas random → llamada se corta → botón WhatsApp aparece → no puede volver a llamar.

---

## CROSS-CHECK: Criterios de Aceptación vs Tareas

### SPEC 1 (Backend)
| Criterio | Tarea |
|----------|-------|
| Tabla auto-crea en startup | T2 |
| CRUD con aislamiento tenant_id | T4 |
| Endpoint público sin datos sensibles | T15 |
| widget_token único uuid4 | T4 |
| agent_id pertenece al tenant | T4 |
| Rate limiting endpoints públicos | T17 |
| allowed_domains hereda de store_website | T4, T15 |
| /providers dinámico | T5 |
| NVIDIA Riva funciona | T20 |
| NGC_API_KEY encriptada | T4 (usa encrypt_password existente) |
| Múltiples widgets por tenant | T4, T13 |
| Bloqueado para plan Free | T4, T7 |
| Voice add-on billing | T6 |
| BYOK mode | T4, T17 |
| voice_usage_records | T2, T18 |
| Endpoint /usage | T6 |
| Detección abuso + IP bloqueada | T22 |
| Tools en chat y voz | T19, T20 |

### SPEC 2 (Frontend)
| Criterio | Tarea |
|----------|-------|
| Página en /voice-widget | T7, T8 |
| Selector agentes activos | T9 |
| Preview en vivo | T12 |
| Snippet con widget_token | T16 |
| Botón copiar | T12 |
| Responsive mobile | T7 |
| CTA si no hay agentes | T9 |
| Nav en Sidebar | T8 |
| Providers dinámicos | T10 |
| NVIDIA con NGC_API_KEY | T10 |
| Providers sin key disabled | T10 |
| Voces se actualizan por provider | T10 |
| Toggle Pipeline | T10 |
| Lista múltiples widgets | T13 |
| Plan Free overlay | T7 |
| Mini-dashboard minutos | T12 |
| BYOK toggle + NGC textarea | T12 |
| Dominio hereda del agente | T9 |

### SPEC 3 (SDK)
| Criterio | Tarea |
|----------|-------|
| SDK con data-token | T14 |
| Botón flotante estilos | T14 |
| Burbuja bienvenida | T14 |
| Shadow DOM | T14 |
| No renderiza si inactive | T14, T15 |
| Permiso micrófono | T21 |
| Audio por WebSocket | T21 |
| Timer visible | T21 |
| Cierre max_duration | T18, T21 |
| Reconexión automática | T21 |
| NVIDIA Riva funcional | T20 |
| NGC_API_KEY del Vault | T17, T20 |
| Abuso: WS 4003 + IP blocked | T22 |
| BLOCKED → CTA WhatsApp | T21, T22 |
| MINUTES_EXHAUSTED | T17, T21 |
| BYOK sin límite | T17 |
| Tools por voz | T19, T20 |

---

## DEPENDENCIAS ENTRE TAREAS

```
T1 ─→ T2 ─→ T4 ─→ T5
                ─→ T6
                ─→ T15 ─→ T14 ─→ T16
                                  ─→ T21
                ─→ T17 ─→ T18 ─→ T19
                              ─→ T20
                              ─→ T22

T7 (paralelo con T4+)
T8 (paralelo con T7)
T9, T10, T11, T12 (secuencial dentro de T7)
T13 (después de T4 + T7-T12)

T23 (después de T1-T22 completados — auditoría final)
```

**Paralelizables**: T7-T12 (frontend) se pueden hacer en paralelo con T4-T6 (backend) una vez que T1-T2 estén listos.

---

## ESTIMACIÓN DE COMPLEJIDAD

| Tarea | Complejidad | Archivos tocados |
|-------|------------|------------------|
| T1 | Baja | 2 (model + __init__) |
| T2 | Baja | 1 (main.py) |
| T3 | Baja | 1 (inline en routes) |
| T4 | Media | 2 (routes + main.py) |
| T5 | Baja | 1 (routes) |
| T6 | Baja | 1 (routes) |
| T7 | Alta | 1 (VoiceWidget.tsx ~400 líneas) |
| T8 | Baja | 2 (App.tsx + Sidebar.tsx) |
| T9-T12 | Media | 1 (VoiceWidget.tsx) |
| T13 | Media | 1 (VoiceWidget.tsx) |
| T14 | Media | 1 (voice-widget-sdk.js ~200 líneas) |
| T15 | Baja | 2 (routes + guard) |
| T16 | Baja | 1 (VoiceWidget.tsx) |
| T17 | Media | 1 (routes) |
| T18 | Media | 1 (voice_widget_ws.py) |
| T19 | Alta | 1 (ws handler + tools adapter) |
| T20 | Alta | 1 (ws handler + Riva integration) |
| T21 | Alta | 1 (SDK audio capture + playback) |
| T22 | Media | 1 (ws handler + Redis) |
| T23 | Media | Todos (auditoría cross-cutting) |

---

## FASE CIERRE: SOVEREIGN AUDIT

### T23: Sovereign Audit — Verificación de seguridad multi-tenant
**Tipo**: Auditoría post-implementación (workflow `new_feature.md` paso 4)
**Herramienta**: Skill `Sovereign_Auditor` del ecosistema Antigravity

**Checklist de verificación**:

#### Aislamiento de Datos
- [ ] TODAS las queries SELECT/UPDATE/DELETE en `voice_widget_routes.py` filtran por `tenant_id`
- [ ] TODAS las queries en `voice_widget_ws.py` validan session ownership
- [ ] `voice_usage_records` siempre registra `tenant_id` correcto
- [ ] Un tenant NO puede ver/editar/eliminar widgets de otro tenant (test con 2 tenants)

#### Endpoint Público Sanitizado
- [ ] `GET /public/voice-widget/{token}` NO retorna: `tenant_id`, `agent_id`, `system_prompt`, `system_prompt_override`, `api_key_mode`, `widget_token` interno
- [ ] `GET /public/voice-widget/{token}` SÍ retorna: `widget_name`, `brand_color`, `button_*`, `avatar_url`, `welcome_message`, `voice_model`, `language`, `whatsapp_number`
- [ ] `widget_token` no es reversible a `tenant_id` (uuid4 puro, no derivado)

#### Credenciales
- [ ] `NGC_API_KEY` se almacena encriptada en `credentials` (AES-256 via `encrypt_password`)
- [ ] `NGC_API_KEY` NUNCA aparece en logs, responses, ni en el SDK del browser
- [ ] `OPENAI_API_KEY` del tenant (BYOK) NUNCA llega al browser — solo al backend
- [ ] Key global de la plataforma no se expone al tenant

#### Sessions y Redis
- [ ] `voice_session:{session_id}` tiene TTL finito (max_duration + 60s)
- [ ] `voice_blocked:{token}:{ip}` tiene TTL finito (3600s)
- [ ] Session data en Redis incluye `tenant_id` para audit trail
- [ ] Session data NO es accesible desde el browser (solo via WS handler interno)

#### Rate Limiting y Abuso
- [ ] Rate limit funciona: >10 sesiones/min por IP → 429
- [ ] IP bloqueada por abuso → 403 en POST /session
- [ ] Abuso no bloquea IPs de otros widgets del mismo tenant
- [ ] `abuse_detected` se registra en `voice_usage_records`

#### Billing Isolation
- [ ] Minutos de voz se cuentan POR tenant (no globalmente)
- [ ] BYOK mode no descuenta minutos del plan
- [ ] Platform mode verifica cuota ANTES de crear sesión
- [ ] Un tenant no puede consumir los minutos de otro

#### Subscription Guard
- [ ] `/public/voice-widget/*` está en `EXEMPT_PREFIXES` (endpoints públicos)
- [ ] `/admin/voice-widget/*` requiere autenticación (NOT exempt)
- [ ] Plan Free no puede acceder a `/admin/voice-widget/config` (POST bloqueado)

**Verificación final**: Correr los Gherkin scenarios de aislamiento multi-tenant de SPEC 1 manualmente con 2 tenants diferentes.
