# SPEC 3: Voice Widget — Embeddable SDK & Voice Pipeline

## Fecha: 2026-03-25
## Prioridad: P1 — SDK embebible + pipeline de audio
## Dependencias: SPEC 1 (Backend), SPEC 2 (Frontend config)

---

## OBJETIVO DE NEGOCIO

Crear el SDK JavaScript liviano que se embebe en las Tiendas Nube de los clientes. Este script renderiza el botón flotante de voz y gestiona toda la comunicación de audio bidireccional con el backend de Future, de forma que el visitante de la tienda pueda hablar con el agente IA sin salir de la web.

**Analogía**: Como el script de Chatwoot/Intercom que ya existe en `WebSettings.tsx`, pero en vez de chat de texto, es un widget de voz.

---

## ARQUITECTURA DEL FLUJO DE AUDIO

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIENDA NUBE DEL CLIENTE                       │
│                                                                 │
│   Visitante hace clic en botón 🎙                               │
│            │                                                    │
│            ▼                                                    │
│   voice-widget-sdk.js                                           │
│   ├── Pide permiso de micrófono (getUserMedia)                  │
│   ├── POST /public/voice-widget/{token}/session → session_id    │
│   ├── Conecta WebSocket ws://.../voice-widget/ws/{session_id}   │
│   ├── Captura audio del mic → envía chunks por WS               │
│   └── Recibe audio chunks del WS → reproduce con AudioContext   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FUTURE BACKEND                                │
│                                                                 │
│   WebSocket Handler /public/voice-widget/ws/{session_id}        │
│   │                                                             │
│   ├── Recibe audio chunks del cliente                           │
│   ├── Acumula buffer → detecta silencio (VAD)                   │
│   │                                                             │
│   ├── [OPCIÓN A: Pipeline Custom]                               │
│   │   ├── STT: audio → texto (Whisper / Deepgram)               │
│   │   ├── Agent: texto → NexusEngine → respuesta texto          │
│   │   ├── TTS: respuesta → audio (OpenAI TTS / ElevenLabs)     │
│   │   └── Envía audio chunks al cliente via WS                  │
│   │                                                             │
│   ├── [OPCIÓN B: OpenAI Realtime API] ← RECOMENDADA             │
│   │   ├── Proxy directo a OpenAI Realtime API                   │
│   │   ├── Audio in → OpenAI → Audio out (sub-segundo latency)   │
│   │   ├── System prompt + tools del agente seleccionado         │
│   │   └── Soporta function calling nativo por voz               │
│   │                                                             │
│   └── Cierra sesión al alcanzar max_call_duration               │
└─────────────────────────────────────────────────────────────────┘
```

### Decisión de Arquitectura: 3 Opciones

| Aspecto | Opción A: Cascaded Pipeline | Opción B: OpenAI Realtime | Opción C: NVIDIA Riva NIM |
|---------|---------------------------|---------------------------|---------------------------|
| Latencia | ~2-4s (STT+LLM+TTS) | ~200-500ms (speech-to-speech) | ~300-800ms (ASR sub-25ms + LLM + TTS) |
| Naturalidad | Turnos discretos | Conversación fluida, interrupciones | Conversación fluida, barge-in support |
| Costo | Más barato por llamada | Per-minute ($0.06-$0.24/min) | GPU license ($4.5K/GPU/año) o free tier cloud |
| Complejidad | Alta (VAD, buffering, 3 APIs) | Baja (proxy a 1 API) | Media (2 WS Riva + NexusEngine) |
| LLM | Tu propio LLM (NexusEngine) | Solo modelos OpenAI | Tu propio LLM (NexusEngine) ← VENTAJA |
| Tools | Via NexusEngine (MercadoPago, TiendaNube) | Via OpenAI function calling | Via NexusEngine (MercadoPago, TiendaNube) |
| Español | Depende del STT/TTS elegido | Soportado | Nativo es-ES + es-LATAM (canary-1b) |
| Data Privacy | Depende de providers | Datos van a OpenAI | Self-host posible (on-prem) |
| Providers | Mix libre (Deepgram+ElevenLabs) | Solo OpenAI | Solo NVIDIA (ASR+TTS) + tu LLM |

**Recomendación**: Soportar las 3 opciones configurables por widget:
- **OpenAI Realtime** como default (simplicidad, MVP rápido)
- **NVIDIA Riva NIM** como opción premium (mejor español, usa tu propio LLM, privacidad)
- **Cascaded** como opción avanzada (máxima flexibilidad, fase posterior)

**La ventaja clave de NVIDIA para el cliente ideal**: Al usar Riva NIM, el asistente de voz usa el mismo NexusEngine y las mismas tools (MercadoPago, TiendaNube, agendar citas) que ya tiene el agente configurado. Con OpenAI Realtime, las tools deben redefinirse en el formato de OpenAI function calling.

---

## SDK EMBEBIBLE: `voice-widget-sdk.js`

### Responsabilidades

1. **Bootstrap**: Fetch config pública → renderizar botón
2. **UI**: Botón flotante + modal/overlay de llamada
3. **Audio**: Capturar micrófono + reproducir respuesta
4. **Conexión**: WebSocket bidireccional con el backend
5. **UX**: Estados visuales (idle, connecting, listening, speaking, error)

### Flujo del SDK

```
1. Script carga → lee data-token del tag <script>
2. Fetch GET /public/voice-widget/{token} → config visual
3. Renderiza botón flotante según config (color, posición, icono, etc)
4. Muestra burbuja de welcome_message

5. Usuario hace clic en botón:
   a. Pedir permiso de micrófono (navigator.mediaDevices.getUserMedia)
   b. Si denegado → mostrar error "Necesitamos acceso al micrófono"
   c. POST /public/voice-widget/{token}/session → { session_id, ws_url }
   d. Conectar WebSocket
   e. UI cambia a estado "Conectando..."

6. Conexión establecida:
   a. UI cambia a estado "Escuchando..." (onda de audio animada)
   b. El agente dice su greeting por audio (TTS del welcome o primer mensaje)
   c. Captura audio del mic → stream por WebSocket
   d. Recibe audio del agente → reproduce en speaker

7. Durante la llamada:
   a. Indicador visual: "Escuchando..." / "El asistente está hablando..."
   b. Botón para colgar/terminar
   c. Timer visible con duración de la llamada
   d. Al alcanzar max_duration → aviso y cierre automático

8. Fin de llamada:
   a. Cerrar WebSocket
   b. Liberar micrófono
   c. UI vuelve a estado idle (botón flotante)
```

### UI States del Widget

```
┌─ IDLE ──────────────────────┐
│  Botón circular flotante     │
│  + Burbuja welcome_message   │
│  Color: brand_color          │
│  Icono: phone/mic/headset    │
└─────────────────────────────┘

┌─ CONNECTING ────────────────┐
│  Botón con spinner/pulse     │
│  Texto: "Conectando..."     │
└─────────────────────────────┘

┌─ ACTIVE CALL ───────────────┐
│  ┌───────────────────────┐  │
│  │  🎙 Asistente de Voz  │  │
│  │                       │  │
│  │  [Avatar/Waveform]    │  │
│  │                       │  │
│  │  "Escuchando..."      │  │
│  │   ── o ──             │  │
│  │  "Hablando..."        │  │
│  │                       │  │
│  │  ⏱ 02:34             │  │
│  │                       │  │
│  │  [🔴 Colgar]          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─ ERROR ─────────────────────┐
│  "No se pudo conectar"       │
│  [Reintentar]                │
└─────────────────────────────┘

┌─ BLOCKED (Abuso) ──────────┐
│  "Llamada finalizada"        │
│  "Si necesitas ayuda con     │
│   nuestros productos,        │
│   escríbenos por WhatsApp"   │
│                              │
│  [💬 Hablar por WhatsApp]    │
│  (link directo a wa.me/...)  │
└─────────────────────────────┘

┌─ MINUTES_EXHAUSTED ─────────┐
│  "Minutos de voz agotados"   │
│  "Intenta de nuevo el        │
│   próximo mes o contáctanos  │
│   por WhatsApp"              │
│                              │
│  [💬 Hablar por WhatsApp]    │
└─────────────────────────────┘
```

### Especificaciones Técnicas del SDK

- **Tamaño**: < 30KB gzipped
- **Zero dependencies**: Vanilla JS, no React/Vue/jQuery
- **Shadow DOM**: Encapsular estilos para no interferir con la tienda
- **Browser support**: Chrome 80+, Firefox 78+, Safari 14+, Edge 80+
- **Audio format**: Opus en WebSocket, PCM 16kHz fallback
- **Hosting**: Servido desde el backend de Future como static file

---

## BACKEND: VOICE SESSION HANDLER

### WebSocket Handler

```python
# Pseudocódigo del handler
@app.websocket("/public/voice-widget/ws/{session_id}")
async def voice_ws(websocket: WebSocket, session_id: str):
    # 1. Validar session_id en Redis
    session = await redis_client.get(f"voice_session:{session_id}")
    if not session:
        await websocket.close(code=4001, reason="Invalid session")
        return

    config = json.loads(session)
    await websocket.accept()

    # 2. Route to the correct provider
    provider = config['realtime_provider']  # 'openai' or 'nvidia'

    if provider == 'openai':
        await handle_openai_realtime(websocket, config)
    elif provider == 'nvidia':
        await handle_nvidia_riva(websocket, config)
    else:
        await handle_cascaded_pipeline(websocket, config)


async def handle_openai_realtime(websocket, config):
    """OpenAI Realtime API — unified speech-to-speech model"""
    openai_ws = await connect_openai_realtime(
        api_key=config['openai_key'],
        model="gpt-4o-realtime-preview",
        system_prompt=config['system_prompt'],
        tools=config['tools'],
        voice=config['voice_model']
    )

    async def client_to_openai():
        async for message in websocket.iter_bytes():
            await openai_ws.send(audio_chunk(message))

    async def openai_to_client():
        async for message in openai_ws:
            if is_audio(message):
                await websocket.send_bytes(message.audio)
            elif is_function_call(message):
                result = await execute_tool(config['agent_id'], message.function)
                await openai_ws.send(function_result(result))

    await asyncio.gather(client_to_openai(), openai_to_client())


async def handle_nvidia_riva(websocket, config):
    """
    NVIDIA Riva NIM — cascaded but low-latency pipeline.
    ASR (canary, sub-25ms) → NexusEngine (LLM) → TTS (magpie-tts)

    Key advantage: Uses the SAME NexusEngine + tools the agent already has.
    The tenant's MercadoPago, TiendaNube, appointment scheduling tools
    all work natively without any adaptation.
    """
    ngc_key = config['nvidia_key']  # from credential vault
    riva_endpoint = config.get('riva_endpoint', 'grpc.nvcf.nvidia.com:443')  # cloud or self-hosted

    # Connect to Riva ASR NIM (WebSocket)
    asr_ws = await connect_riva_asr(
        endpoint=riva_endpoint,
        api_key=ngc_key,
        model="canary-1b",           # or canary-0.6b-turbo for lower latency
        language=config['language'],  # es-ES, en-US, etc.
        encoding="LINEAR_PCM",
        sample_rate=16000
    )

    # Connect to Riva TTS NIM (WebSocket)
    tts_ws = await connect_riva_tts(
        endpoint=riva_endpoint,
        api_key=ngc_key,
        voice=config['voice_model'],  # magpie-tts
        language=config['language'],
        encoding="OGG_OPUS",          # or LINEAR_PCM
        sample_rate=22050
    )

    async def client_audio_to_asr():
        """Browser mic → Riva ASR NIM"""
        async for audio_chunk in websocket.iter_bytes():
            await asr_ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(audio_chunk).decode()
            }))

    async def asr_to_llm_to_tts():
        """Riva ASR → NexusEngine (LLM) → Riva TTS → Browser speaker"""
        async for event in asr_ws:
            data = json.loads(event)
            if data["type"] == "conversation.item.input_audio_transcription.completed":
                user_text = data["transcript"]

                # Send to NexusEngine — same engine, same tools, same agent config
                agent_response = await nexus_engine.process(
                    agent_id=config['agent_id'],
                    tenant_id=config['tenant_id'],
                    message=user_text,
                    channel="voice_widget"
                )

                # Send response text to Riva TTS
                await tts_ws.send(json.dumps({
                    "type": "input_text.append",
                    "text": agent_response.text
                }))
                await tts_ws.send(json.dumps({"type": "input_text.commit"}))

    async def tts_to_client():
        """Riva TTS → Browser speaker"""
        async for event in tts_ws:
            data = json.loads(event)
            if data["type"] == "conversation.item.speech.data":
                audio_bytes = base64.b64decode(data["audio"])
                await websocket.send_bytes(audio_bytes)

    await asyncio.gather(
        client_audio_to_asr(),
        asr_to_llm_to_tts(),
        tts_to_client()
    )
```

### Session Management (Redis)

```python
# Al crear sesión:
session_data = {
    "widget_id": config.id,
    "agent_id": config.agent_id,
    "tenant_id": config.tenant_id,
    "voice_model": config.voice_model,
    "system_prompt": agent.system_prompt_template,  # o el override
    "tools": agent.enabled_tools,
    "openai_key": decrypt(tenant_openai_key),  # o nvidia_key si provider=nvidia
    "api_key_mode": config.api_key_mode,       # platform | byok
    "max_duration": config.max_call_duration,
    "whatsapp_number": tenant.bot_phone_number, # para CTA de WhatsApp en caso de abuso
    "store_url": agent.store_url,               # URL pública de la tienda
    "started_at": None  # se setea cuando conecta el WS
}
await redis_client.setex(
    f"voice_session:{session_id}",
    config.max_call_duration + 60,  # TTL con margen
    json.dumps(session_data)
)
```

---

## LÓGICA DE NEGOCIO (Gherkin)

```gherkin
Feature: Embeddable Voice Widget

  Scenario: Widget se carga en tienda nube
    Given una tienda tiene el script con data-token="abc123"
    When la página carga
    Then el SDK hace fetch a /public/voice-widget/abc123
    And renderiza un botón flotante con los colores configurados
    And muestra la burbuja de bienvenida

  Scenario: Visitante inicia llamada de voz
    Given el widget está renderizado
    When el visitante hace clic en el botón
    Then el browser pide permiso de micrófono
    And si acepta, se crea una sesión de voz
    And el widget cambia a estado "Conectando..."
    And luego a "Escuchando..."

  Scenario: Conversación bidireccional
    Given la sesión de voz está activa
    When el visitante habla
    Then su audio se envía al backend por WebSocket
    And el backend lo procesa (STT → Agent → TTS)
    And el visitante escucha la respuesta del agente

  Scenario: Duración máxima alcanzada
    Given una sesión tiene max_call_duration=300 (5 min)
    When han pasado 300 segundos
    Then el agente dice "Hemos alcanzado el límite de tiempo"
    And la sesión se cierra automáticamente
    And el widget vuelve a estado idle

  Scenario: Micrófono denegado
    Given el visitante hace clic en el botón de voz
    When deniega el permiso de micrófono
    Then el widget muestra "Necesitamos acceso al micrófono para continuar"
    And un link "Cómo habilitarlo" con instrucciones

  Scenario: Pérdida de conexión
    Given una sesión de voz activa
    When se pierde la conexión WebSocket
    Then el widget muestra "Conexión perdida"
    And un botón "Reintentar"
    And si no reconecta en 10s, vuelve a idle

  Scenario: Widget desactivado
    Given el admin desactivó el widget (is_active=false)
    When un visitante carga la tienda
    Then el endpoint público retorna 404
    And el SDK no renderiza nada

  Scenario: Abuso detectado — corte de llamada
    Given un visitante está en llamada activa
    When habla sobre temas no relacionados con la tienda
    Then el agente responde "Esta conversación no está relacionada con nuestro negocio"
    And el backend cierra el WebSocket con code 4003
    And el SDK muestra estado BLOCKED
    And muestra botón "Hablar por WhatsApp" con link directo al wa.me del tenant
    And la IP queda bloqueada para ese widget en esta sesión

  Scenario: IP bloqueada intenta reconectar
    Given un visitante con IP bloqueada por abuso
    When hace clic en el botón de voz
    Then el SDK recibe 403 al intentar crear sesión
    And muestra directamente estado BLOCKED con CTA a WhatsApp

  Scenario: Minutos de voz agotados
    Given el tenant ha consumido todos sus minutos del plan
    And api_key_mode="platform"
    When un visitante intenta iniciar llamada
    Then el SDK recibe error "minutes_exhausted" del backend
    And muestra estado MINUTES_EXHAUSTED con CTA a WhatsApp

  Scenario: BYOK mode — sin límite de minutos
    Given el widget tiene api_key_mode="byok"
    When un visitante inicia llamada
    Then la sesión se crea normalmente (sin chequeo de minutos)
    And el audio se procesa usando la API key del tenant

  Scenario: Tools funcionan por voz
    Given un visitante pregunta "¿Tienen zapatillas Nike en talla 42?"
    When el agente procesa la pregunta
    Then ejecuta la tool search_products con query="zapatillas Nike talla 42"
    And responde por voz con los resultados del catálogo de TiendaNube
```

---

## ARCHIVOS A CREAR

- `frontend_react/public/voice-widget-sdk.js` — SDK embebible (vanilla JS)
  - Alternativa: `orchestrator_service/static/voice-widget-sdk.js` (servido por FastAPI)
- `orchestrator_service/app/routes/voice_widget_public_routes.py` — Endpoints públicos + WebSocket

## ARCHIVOS A MODIFICAR

- `orchestrator_service/main.py` — Montar static files para el SDK + registrar WS route
- `orchestrator_service/app/core/config.py` — Agregar config de OpenAI Realtime API URL

---

## FASES DE IMPLEMENTACIÓN SUGERIDAS

### Fase 1 (MVP) — Config + snippet + botón visual
- SPEC 1: Backend CRUD completo + tabla + endpoints
- SPEC 2: Página `/voice-widget` completa con preview
- Snippet de código generado con widget_token
- SDK placeholder: renderiza el botón (sin audio aún)
- Credential category `nvidia` para NGC_API_KEY

### Fase 2 — OpenAI Realtime funcional
- SDK con captura de audio y WebSocket
- Backend: `handle_openai_realtime()` — bridge bidireccional
- Sesiones en Redis con TTL
- Rate limiting en endpoints públicos
- Function calling para tools del agente

### Fase 3 — NVIDIA Riva NIM funcional
- Backend: `handle_nvidia_riva()` — pipeline ASR→NexusEngine→TTS
- Integración con Riva ASR NIM (canary-1b, es-ES)
- Integración con Riva TTS NIM (magpie-tts)
- **Ventaja clave**: Usa NexusEngine directamente → todas las tools (MercadoPago, TiendaNube, calendar) funcionan sin adaptación
- Test con free tier cloud de build.nvidia.com

### Fase 4 — Cascaded pipeline + analytics
- Soporte ElevenLabs y Deepgram (pipeline cascaded configurable)
- Analytics de llamadas (duración, temas, satisfacción)
- Dashboard de métricas de voz en /analytics
- Grabación opcional de llamadas (consent-based)
- Transcripción en tiempo real visible para el admin

---

## CONSIDERACIONES DE SEGURIDAD

1. **widget_token**: No expone tenant_id ni agent_id al público
2. **CORS**: Solo dominios permitidos pueden iniciar sesiones
3. **Rate limiting**: 10 sesiones/minuto por IP para evitar abuso
4. **API Keys**: Las keys de OpenAI/ElevenLabs/NVIDIA NUNCA llegan al browser — todo se proxea por backend
5. **Max duration**: Límite hard en backend (no confiar solo en frontend)
6. **Session isolation**: Cada sesión tiene su propio scope en Redis
7. **Audio data**: No se almacena por defecto (privacy-first)
8. **NGC API Key**: Se almacena encriptada en credentials via Sovereign Vault (category: `nvidia`)
9. **Riva endpoint**: Si self-hosted, el endpoint es interno (no expuesto al browser)

---

## CRITERIOS DE ACEPTACIÓN

### Fase 1 (MVP)
- [ ] SDK se carga desde un `<script>` tag con data-token
- [ ] Botón flotante se renderiza con estilos de la config
- [ ] Burbuja de bienvenida visible
- [ ] Shadow DOM impide conflictos con CSS de la tienda
- [ ] Widget no renderiza nada si is_active=false

### Fase 2 (Audio)
- [ ] Permiso de micrófono se solicita al hacer clic
- [ ] Audio se transmite por WebSocket al backend
- [ ] Backend procesa audio y responde con voz del agente
- [ ] Timer visible durante la llamada
- [ ] Cierre automático al alcanzar max_duration
- [ ] Reconexión automática ante pérdida de conexión

### Fase 3 (NVIDIA Riva NIM)
- [ ] handle_nvidia_riva() conecta con Riva ASR NIM via WebSocket
- [ ] ASR usa canary-1b con es-ES para transcripción sub-25ms
- [ ] Transcripción se envía al NexusEngine del agente (mismas tools)
- [ ] Respuesta del agente se sintetiza con Riva TTS NIM (magpie-tts)
- [ ] Audio de respuesta se envía al browser via WebSocket
- [ ] NGC_API_KEY se lee del Sovereign Vault (category: nvidia)
- [ ] Funciona con free tier cloud de build.nvidia.com

### Cross-phase (Seguridad y Billing)
- [ ] Detección de abuso: WS close code 4003, IP bloqueada en Redis
- [ ] Estado BLOCKED en SDK muestra CTA a WhatsApp (wa.me/{número del tenant})
- [ ] Estado MINUTES_EXHAUSTED en SDK muestra CTA a WhatsApp
- [ ] BYOK mode no chequea cuota de minutos
- [ ] Platform mode chequea minutos restantes antes de crear sesión
- [ ] Tools del agente funcionan por voz (search_products, check_stock, agendar, etc.)
- [ ] allowed_domains se hereda de URL pública de la tienda (del agente config)

### Fase 4 (Polish)
- [ ] Soporte cascaded multi-provider (ElevenLabs, Deepgram)
- [ ] Analytics de llamadas en el dashboard
- [ ] Transcripción en tiempo real (opcional)
