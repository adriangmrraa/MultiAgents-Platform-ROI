# SPEC 1: Voice Widget — Backend & Data Layer

## Fecha: 2026-03-25
## Prioridad: P0 — Feature principal del Voice Agent Widget
## Dependencias: Tabla `agents` existente, `credentials` existente, multi-tenant architecture

---

## OBJETIVO DE NEGOCIO

Permitir que los usuarios de Future configuren y desplieguen un widget de asistente de voz embebible en sus Tiendas Nube. El widget conecta con un agente IA ya desplegado pero usando un modelo de voz (TTS/STT) para que los visitantes de la tienda puedan hablar por voz con el asistente directamente desde la web.

**Propuesta de valor**: Similar a GoHighLevel Voice Widget — un botón en la web que conecta al visitante con un asistente de IA por voz, capaz de agendar citas, consultar productos, tomar pedidos, etc.

---

## CLARIFICACIONES RESUELTAS

### C1: Múltiples widgets por tenant
**Decisión**: Un tenant puede tener N voice widgets (uno por tienda, o varios por tienda). Cada widget puede usar el mismo agente o uno diferente. Ejemplo: tenant con 3 Tiendas Nube → 3 widgets, cada uno con su agente y personalización.

### C2: Billing y consumo de voz
**Decisión**: Voice Widget solo disponible en planes **Pro** y **Enterprise**. Dos modalidades:

| Concepto | Pro ($49/mes) | Enterprise ($199/mes) |
|----------|--------------|----------------------|
| Minutos incluidos (API de Future) | 60 min/mes | 300 min/mes |
| Recargo voice add-on | +$19 USD/mes | +$39 USD/mes |
| Precio total con voz | **$68 USD/mes** | **$238 USD/mes** |
| Minuto adicional (overage) | $0.35 USD/min | $0.25 USD/min |
| BYOK (Bring Your Own Key) | Ilimitado (su API key) | Ilimitado (su API key) |

**Cálculo de rentabilidad**:
- Costo real por minuto (OpenAI Realtime): ~$0.15-$0.30/min
- Pro: 60 min × $0.22 avg = $13.20 costo → $19 recargo = **30% margen**
- Enterprise: 300 min × $0.22 avg = $66 costo → $39 recargo + overage = **margen en volumen**
- BYOK: 0 costo para Future → solo valor de plataforma

**Opción BYOK (para devs)**: Si el tenant pega su propia API key (OpenAI o NVIDIA NGC), los minutos NO se descuentan de su cuota. Consume directamente su key. Esta opción se muestra como "Avanzado: Usa tu propia API Key" en la UI.

### C3: Tools funcionales en voz
**Decisión**: Las tools del agente DEBEN funcionar tanto en chat como en voz. Ambos canales usan el mismo NexusEngine y las mismas tools (MercadoPago, TiendaNube, agendar citas, etc.). En OpenAI Realtime, las tools se adaptan a OpenAI function calling. En NVIDIA Riva, pasan directo por NexusEngine.

### C4: API Keys por tenant (NVIDIA)
**Decisión**: La NGC API Key la pone cada tenant individualmente. Se almacena encriptada en `credentials` (category: `nvidia`, scope: `tenant`). En la UI de configuración del voice widget, si elige NVIDIA como provider, aparece un textarea para pegar la NGC API Key, que se cifra y guarda en el Sovereign Vault.

La API de OpenAI para chat (mensajes de texto) se consume con la key global de la plataforma, medida por tenant (mensajes/mes según plan). Pero para voz con BYOK, el tenant usa su propia key.

### C5: URL del widget = URL pública de la tienda
**Decisión**: El dominio donde se muestra el widget se toma de la configuración existente del agente. En el wizard de creación de agentes hay un textarea con la URL pública de la tienda nube. Esa URL se usa automáticamente como `allowed_domains` del widget. No hay campo manual de dominios — se hereda del agente/tienda.

### C6 (Extra): Detección de uso indebido — corte de llamada
**Decisión**: Si el agente detecta que la conversación NO está relacionada con la tienda, productos o servicios del negocio, se debe:
1. El agente responde: "Esta conversación no está relacionada con nuestro negocio. Voy a finalizar la llamada."
2. Se corta la llamada automáticamente
3. La IP del visitante queda bloqueada en Redis para esa sesión (no puede volver a llamar)
4. El widget muestra: "Llamada finalizada por uso indebido. Si necesitas ayuda con nuestros productos, escríbenos por WhatsApp." + Botón directo a WhatsApp de la tienda (usando el número del tenant)

Implementación:
- System prompt del agente de voz incluye instrucción de detección de off-topic
- Backend monitorea la respuesta del agente por un flag `[ABUSE_DETECTED]`
- Al detectar, se cierra el WS y se guarda la IP en Redis con TTL de la sesión
- El SDK muestra el estado `BLOCKED` con CTA a WhatsApp

---

## ESQUEMA DE DATOS

### Nueva tabla: `voice_widget_configs`

```sql
CREATE TABLE IF NOT EXISTS voice_widget_configs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Widget Appearance
    widget_name VARCHAR(100) DEFAULT 'Asistente de Voz',
    brand_color VARCHAR(7) DEFAULT '#8B5CF6',
    button_size VARCHAR(10) DEFAULT 'md',         -- sm, md, lg
    button_position VARCHAR(20) DEFAULT 'bottom-right', -- bottom-right, bottom-left
    button_icon VARCHAR(20) DEFAULT 'phone',      -- phone, mic, headset
    avatar_url TEXT DEFAULT NULL,                  -- URL to avatar image
    welcome_message TEXT DEFAULT '¡Hola! Toca para hablar conmigo.',

    -- Voice Configuration
    voice_provider VARCHAR(50) DEFAULT 'openai',  -- openai, elevenlabs, deepgram, nvidia
    voice_model VARCHAR(100) DEFAULT 'alloy',     -- openai: alloy/echo/fable/onyx/nova/shimmer | nvidia: magpie-tts
    stt_provider VARCHAR(50) DEFAULT 'openai',    -- openai (whisper), deepgram, nvidia (riva)
    stt_model VARCHAR(100) DEFAULT 'whisper-1',   -- nvidia: canary-1b, canary-0.6b-turbo
    language VARCHAR(10) DEFAULT 'es',             -- es, en, pt

    -- Pipeline Mode
    voice_pipeline VARCHAR(20) DEFAULT 'realtime', -- realtime (unified model) | cascaded (STT→LLM→TTS)
    realtime_provider VARCHAR(50) DEFAULT 'openai', -- openai (Realtime API) | nvidia (Riva NIM full pipeline)

    -- Agent Behavior Override (optional — if null, uses agent defaults)
    system_prompt_override TEXT DEFAULT NULL,
    temperature_override FLOAT DEFAULT NULL,
    max_call_duration INTEGER DEFAULT 300,         -- seconds (5 min default)

    -- Billing Mode
    api_key_mode VARCHAR(10) DEFAULT 'platform',   -- platform (usa minutos del plan) | byok (usa key del tenant)

    -- Embed Config
    widget_token VARCHAR(64) NOT NULL UNIQUE,      -- public token for embed script
    -- allowed_domains se hereda de la URL pública de la tienda (del agente/tenant)

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_widget_tenant ON voice_widget_configs(tenant_id);
CREATE UNIQUE INDEX idx_voice_widget_token ON voice_widget_configs(widget_token);
```

### TypeScript Interface (Frontend)

```typescript
interface VoiceWidgetConfig {
    id?: number;
    tenant_id: number;
    agent_id: number;

    // Appearance
    widget_name: string;
    brand_color: string;
    button_size: 'sm' | 'md' | 'lg';
    button_position: 'bottom-right' | 'bottom-left';
    button_icon: 'phone' | 'mic' | 'headset';
    avatar_url: string | null;
    welcome_message: string;

    // Voice
    voice_provider: 'openai' | 'elevenlabs' | 'deepgram' | 'nvidia';
    voice_model: string;
    stt_provider: 'openai' | 'deepgram' | 'nvidia';
    stt_model: string;
    language: string;

    // Pipeline Mode
    voice_pipeline: 'realtime' | 'cascaded';
    realtime_provider: 'openai' | 'nvidia';

    // Agent Override
    system_prompt_override: string | null;
    temperature_override: number | null;
    max_call_duration: number;

    // Billing
    api_key_mode: 'platform' | 'byok';

    // Embed
    widget_token: string;

    is_active: boolean;
}
```

### Pydantic Model (Backend)

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
    voice_provider: str = "openai"       # openai | elevenlabs | deepgram | nvidia
    voice_model: str = "alloy"            # nvidia: magpie-tts
    stt_provider: str = "openai"          # openai | deepgram | nvidia
    stt_model: str = "whisper-1"          # nvidia: canary-1b | canary-0.6b-turbo
    language: str = "es"
    voice_pipeline: str = "realtime"      # realtime | cascaded
    realtime_provider: str = "openai"     # openai | nvidia
    system_prompt_override: Optional[str] = None
    temperature_override: Optional[float] = None
    max_call_duration: int = 300
    api_key_mode: str = "platform"     # platform | byok
    is_active: bool = True

class VoiceWidgetUpdate(VoiceWidgetCreate):
    pass
```

---

## ENDPOINTS API

### 1. `GET /admin/voice-widget/config`
- **Auth**: `get_current_user` (tenant-scoped)
- **Response**: Lista de voice widget configs del tenant
- **Lógica**: `SELECT * FROM voice_widget_configs WHERE tenant_id = $1`

### 2. `POST /admin/voice-widget/config`
- **Auth**: `get_current_user`
- **Body**: `VoiceWidgetCreate`
- **Lógica**:
  1. Validar que `agent_id` pertenece al tenant
  2. Generar `widget_token` único (uuid4 hex, 64 chars)
  3. INSERT en `voice_widget_configs`
  4. Retornar config con token

### 3. `PUT /admin/voice-widget/config/{config_id}`
- **Auth**: `get_current_user`
- **Body**: `VoiceWidgetUpdate`
- **Lógica**: UPDATE con validación de tenant_id ownership

### 4. `DELETE /admin/voice-widget/config/{config_id}`
- **Auth**: `get_current_user`
- **Lógica**: DELETE con validación de tenant_id

### 5. `GET /public/voice-widget/{widget_token}` ← PÚBLICO
- **Auth**: NINGUNA (es público, lo consume el script embed)
- **CORS**: Validar `Origin` contra `allowed_domains` (si está vacío, permitir cualquiera)
- **Response**: Config sanitizada (sin tenant_id, sin system_prompt, sin tokens internos)
  ```json
  {
      "widget_name": "Asistente de Voz",
      "brand_color": "#8B5CF6",
      "button_size": "md",
      "button_position": "bottom-right",
      "button_icon": "phone",
      "avatar_url": null,
      "welcome_message": "¡Hola! Toca para hablar...",
      "voice_model": "alloy",
      "language": "es",
      "whatsapp_number": "+5491155551234"
  }
  ```

### 6. `POST /public/voice-widget/{widget_token}/session` ← PÚBLICO
- **Auth**: NINGUNA (rate-limited por IP)
- **Propósito**: Iniciar una sesión de voz (WebSocket o WebRTC signaling)
- **Lógica**:
  1. Validar widget_token existe y is_active
  2. Resolver agent_id → cargar config del agente
  3. Crear session_id efímero en Redis (TTL = max_call_duration)
  4. Retornar `{ session_id, ws_url }` para que el widget conecte
- **Rate limit**: 10 sesiones/minuto por IP

### 7. `WebSocket /public/voice-widget/ws/{session_id}` ← PÚBLICO
- **Propósito**: Canal bidireccional de audio
- **Flow según `voice_pipeline`**:

  **A) `realtime` + `openai`** (OpenAI Realtime API):
  1. Backend abre WS a OpenAI Realtime con system_prompt + tools del agente
  2. Bridge bidireccional: cliente ↔ backend ↔ OpenAI
  3. OpenAI maneja VAD, STT, LLM y TTS internamente
  4. Latencia: ~200-500ms

  **B) `realtime` + `nvidia`** (NVIDIA Riva NIM Full Pipeline):
  1. Backend abre 2 WS a Riva NIM: ASR (`ws://riva/v1/realtime?intent=transcription`) + TTS (`ws://riva/v1/realtime?intent=synthesize`)
  2. Audio del cliente → Riva ASR NIM → texto transcrito (sub-25ms)
  3. Texto → NexusEngine (LLM del agente) → respuesta texto
  4. Respuesta → Riva TTS NIM (magpie-tts) → audio chunks
  5. Audio al cliente via WS
  6. Latencia: ~300-800ms (depende del LLM)

  **C) `cascaded`** (Mix de providers):
  1. Audio → STT (según `stt_provider`: whisper/deepgram/riva)
  2. Texto → NexusEngine → respuesta
  3. Respuesta → TTS (según `voice_provider`: openai/elevenlabs/deepgram/nvidia)
  4. Mayor latencia (~2-4s) pero máxima flexibilidad de providers

### 8. `GET /admin/voice-widget/providers` ← ADMIN
- **Auth**: `get_current_user`
- **Propósito**: Retornar providers disponibles según las credenciales del tenant
- **Lógica**: Verificar qué API keys tiene el tenant en `credentials`:
  - `openai` → credentials category 'openai' → habilita OpenAI Realtime + TTS + Whisper
  - `nvidia` → credentials category 'nvidia' (NGC API Key) → habilita Riva NIM ASR + TTS
  - `elevenlabs` → credentials category 'elevenlabs' → habilita ElevenLabs TTS
  - `deepgram` → credentials category 'deepgram' → habilita Deepgram ASR + TTS
- **Response**:
  ```json
  {
      "realtime_providers": ["openai", "nvidia"],
      "tts_providers": ["openai", "nvidia", "elevenlabs"],
      "stt_providers": ["openai", "nvidia", "deepgram"],
      "voices": {
          "openai": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
          "nvidia": ["magpie-tts-es", "magpie-tts-en"],
          "elevenlabs": []
      }
  }
  ```

### 9. `GET /admin/voice-widget/usage` ← ADMIN
- **Auth**: `get_current_user`
- **Propósito**: Consumo de minutos de voz del tenant en el período actual
- **Response**:
  ```json
  {
      "plan": "pro",
      "voice_minutes_included": 60,
      "voice_minutes_used": 23.5,
      "voice_minutes_remaining": 36.5,
      "overage_minutes": 0,
      "api_key_mode": "platform",
      "billing_period_end": "2026-04-25"
  }
  ```

### 10. Lógica de control de abuso (interno)
- **Trigger**: Respuesta del agente contiene flag `[ABUSE_DETECTED]`
- **Acciones**:
  1. Enviar mensaje final de voz: "Esta conversación no está relacionada con nuestro negocio."
  2. Cerrar WebSocket con code `4003`
  3. Guardar IP en Redis: `voice_blocked:{widget_token}:{ip}` con TTL = duración restante de sesión
  4. El SDK recibe el close code 4003 y muestra estado BLOCKED con botón a WhatsApp
- **En sesiones futuras**: `POST /public/voice-widget/{token}/session` verifica si la IP está bloqueada

### Nueva tabla: `voice_usage_records`

```sql
CREATE TABLE IF NOT EXISTS voice_usage_records (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    widget_id INTEGER NOT NULL REFERENCES voice_widget_configs(id),
    session_id VARCHAR(64) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    api_key_mode VARCHAR(10) DEFAULT 'platform',  -- platform | byok
    provider VARCHAR(50),                          -- openai | nvidia
    visitor_ip VARCHAR(45),
    abuse_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_usage_tenant ON voice_usage_records(tenant_id, created_at);
```

---

## LÓGICA DE NEGOCIO (Gherkin)

```gherkin
Feature: Voice Widget Configuration

  Scenario: Crear configuración de voice widget
    Given un usuario autenticado con tenant_id=5
    And tiene un agente activo con id=12
    When envía POST /admin/voice-widget/config con agent_id=12
    Then se crea un voice_widget_config con widget_token único
    And el widget_token tiene 64 caracteres hex

  Scenario: Widget público sirve config sanitizada
    Given existe un voice_widget_config con widget_token="abc123..."
    When un visitante hace GET /public/voice-widget/abc123...
    Then recibe la config visual (colores, botón, avatar)
    And NO recibe tenant_id, system_prompt, ni tokens internos

  Scenario: Aislamiento multi-tenant
    Given tenant_id=5 tiene un widget con id=1
    When tenant_id=9 intenta PUT /admin/voice-widget/config/1
    Then recibe 404 (no puede ver ni editar widgets de otro tenant)

  Scenario: Validación de agente
    Given tenant_id=5 intenta crear widget con agent_id=99
    And agent_id=99 pertenece a tenant_id=7
    Then recibe 403 "Agent does not belong to your tenant"

  Scenario: Provider dinámico según credenciales
    Given tenant_id=5 tiene NGC_API_KEY en credentials
    And tiene OPENAI_API_KEY en credentials
    When llama GET /admin/voice-widget/providers
    Then realtime_providers incluye ["openai", "nvidia"]
    And tts_providers incluye ["openai", "nvidia"]

  Scenario: NVIDIA Riva NIM como realtime provider
    Given un widget con voice_pipeline="realtime" y realtime_provider="nvidia"
    When un visitante inicia sesión de voz
    Then el backend conecta con Riva ASR NIM (canary-1b, es-ES)
    And envia la transcripción al NexusEngine del agente
    And la respuesta pasa por Riva TTS NIM (magpie-tts)
    And el visitante escucha la respuesta en español con voz natural

  Scenario: Múltiples widgets por tenant
    Given tenant_id=5 tiene 3 tiendas nube conectadas
    When crea 3 voice widgets (uno por tienda)
    Then cada widget tiene su propio widget_token
    And cada uno puede usar un agente diferente o el mismo
    And cada uno tiene su propia personalización (colores, voz, etc.)

  Scenario: Voice Widget solo para Pro/Enterprise
    Given un usuario con plan "free"
    When intenta acceder a /voice-widget
    Then ve un mensaje "Voice Widget disponible en planes Pro y Enterprise"
    And un CTA "Actualizar Plan" → /billing

  Scenario: Consumo de minutos con plan (mode=platform)
    Given tenant con plan Pro (60 min/mes incluidos)
    And api_key_mode="platform"
    When un visitante usa 5 minutos de voz
    Then se registra en voice_usage_records (duration_seconds=300)
    And voice_minutes_used sube a 5
    And voice_minutes_remaining baja a 55

  Scenario: Minutos agotados (overage)
    Given tenant con plan Pro y 60 min usados
    When un visitante intenta iniciar sesión
    Then recibe error "Minutos de voz agotados este mes"
    And el admin ve opción "Comprar minutos extra" o "Activar BYOK"

  Scenario: BYOK mode (Bring Your Own Key)
    Given tenant con api_key_mode="byok"
    And tiene su OPENAI_API_KEY o NGC_API_KEY en credentials
    When un visitante inicia sesión de voz
    Then se usa la API key del tenant (no la de la plataforma)
    And NO se descuentan minutos del plan
    And el costo lo paga el tenant directamente a OpenAI/NVIDIA

  Scenario: Detección de uso indebido
    Given un visitante con IP 1.2.3.4 está en llamada
    When habla sobre temas no relacionados con la tienda
    Then el agente detecta off-topic y responde con aviso de corte
    And la llamada se cierra automáticamente
    And la IP 1.2.3.4 queda bloqueada para ese widget
    And el widget muestra "Uso indebido detectado" + botón WhatsApp

  Scenario: IP bloqueada intenta llamar de nuevo
    Given IP 1.2.3.4 fue bloqueada por abuso en widget X
    When intenta POST /public/voice-widget/{token}/session
    Then recibe 403 con mensaje de bloqueo
    And el SDK muestra estado BLOCKED con CTA a WhatsApp

  Scenario: URL del widget se hereda de la tienda
    Given un agente tiene url_publica="mitienda.mitiendanube.com" en su config
    When el admin crea un voice widget con ese agente
    Then allowed_domains se setea automáticamente a ["mitienda.mitiendanube.com"]
    And el snippet usa esa URL como referencia
```

---

## ARCHIVOS A CREAR

- `orchestrator_service/app/routes/voice_widget_routes.py` — Endpoints CRUD + público
- `orchestrator_service/app/models/voice_widget.py` — SQLAlchemy model

## ARCHIVOS A MODIFICAR

- `orchestrator_service/app/models/__init__.py` — Registrar VoiceWidgetConfig
- `orchestrator_service/main.py` — Incluir voice_widget_routes en el router + auto-create table
- `orchestrator_service/admin_routes.py` — Incluir router de voice widget (o mantener separado)

---

## NVIDIA RIVA NIM — DETALLES DE INTEGRACIÓN

### Autenticación
- Requiere NGC API Key almacenada en `credentials` (category: `nvidia`, name: `NGC_API_KEY`)
- Se obtiene en: `org.ngc.nvidia.com/setup/api-keys`
- Header: `Authorization: Bearer <NGC_API_KEY>`

### Endpoints Riva NIM (WebSocket)
- **ASR**: `ws://<riva-endpoint>/v1/realtime?intent=transcription`
- **TTS**: `ws://<riva-endpoint>/v1/realtime?intent=synthesize`
- **Cloud hosted**: Disponible en `build.nvidia.com` (free tier para prototyping)
- **Self-hosted**: NIM containers en GPU propia (prod scaling)

### Protocolo WebSocket Riva

**ASR (Client → Server):**
| Evento | Propósito |
|--------|-----------|
| `input_audio_buffer.append` | Enviar audio Base64 PCM16 16kHz |
| `input_audio_buffer.commit` | Procesar buffer acumulado |
| `input_audio_buffer.done` | Fin del stream |

**ASR (Server → Client):**
| Evento | Propósito |
|--------|-----------|
| `conversation.item.input_audio_transcription.delta` | Transcripción parcial (streaming) |
| `conversation.item.input_audio_transcription.completed` | Transcripción final |

**TTS (Client → Server):**
| Evento | Propósito |
|--------|-----------|
| `input_text.append` | Texto a sintetizar |
| `input_text.commit` | Disparar síntesis |

**TTS (Server → Client):**
| Evento | Propósito |
|--------|-----------|
| `conversation.item.speech.data` | Chunk de audio Base64 |
| `conversation.item.speech.completed` | Fin de síntesis |

### Modelos NVIDIA Disponibles
- **ASR**: `canary-1b` (alta precisión), `canary-0.6b-turbo` (baja latencia sub-25ms)
- **TTS**: `magpie-tts` (multilingual: es, en, fr — voces naturales)
- **Idiomas ASR**: `es-ES` (España), `es-US` (LATAM), `en-US`, `pt-BR`

### Ventajas de NVIDIA sobre OpenAI Realtime
| Aspecto | NVIDIA Riva NIM | OpenAI Realtime |
|---------|-----------------|-----------------|
| ASR Latencia | Sub-25ms (canary-turbo) | ~200ms (integrado) |
| LLM Flexibility | Usa TU propio LLM (NexusEngine) | Solo modelos OpenAI |
| Data Privacy | Self-host posible (on-prem) | Datos van a OpenAI |
| Español | Nativo es-ES + es-LATAM | Soportado pero menos voces |
| Costo a escala | GPU license ($4.5K/GPU/año) | Per-minute ($0.06-$0.24/min) |
| Tools/Functions | Via NexusEngine (MercadoPago, TiendaNube, etc.) | Solo OpenAI function calling |

---

## CRITERIOS DE ACEPTACIÓN

- [ ] Tabla `voice_widget_configs` se auto-crea en startup (Maintenance Robot)
- [ ] CRUD completo con aislamiento por tenant_id
- [ ] Endpoint público sirve config sin datos sensibles
- [ ] widget_token es único y no predecible (uuid4)
- [ ] Validación: agent_id debe pertenecer al mismo tenant
- [ ] Rate limiting en endpoints públicos
- [ ] allowed_domains se hereda automáticamente de la URL pública del agente/tienda
- [ ] Endpoint /providers detecta dinámicamente qué providers tiene el tenant
- [ ] NVIDIA Riva NIM funciona como opción de realtime_provider
- [ ] NGC_API_KEY se almacena encriptada en credentials (Sovereign Vault, scope: tenant)
- [ ] Múltiples widgets por tenant (N widgets, mismo o diferente agente)
- [ ] Voice Widget bloqueado para plan Free (solo Pro/Enterprise)
- [ ] Voice add-on: Pro +$19/mes (60 min), Enterprise +$39/mes (300 min)
- [ ] BYOK mode: tenant usa su propia API key, sin consumo de cuota
- [ ] Tabla voice_usage_records registra cada sesión (duración, provider, abuse)
- [ ] Endpoint /usage retorna consumo de minutos del período actual
- [ ] Detección de abuso: IP bloqueada en Redis al detectar off-topic
- [ ] IP bloqueada → 403 en crear sesión + CTA WhatsApp en SDK
- [ ] Tools del agente funcionales tanto en chat como en voz
