# SPEC: Buffer Omnichannel + Voice Architect Fix

## Fecha: 2026-03-25
## Prioridad: P0 — Corregir la experiencia de voz del onboarding + implementar buffer omnichannel
## Referencia: ClinicForge buffer_manager.py, buffer_task.py, response_sender.py

---

## PROBLEMA ACTUAL

La interaccion con el agente de voz en el onboarding es engorrosa porque:
1. **Se cortan las frases**: El VAD corta prematuramente cuando el usuario hace una pausa
2. **Se envian palabras sueltas**: Fragmentos incompletos se envian al AI
3. **Audio superpuesto**: Multiples respuestas suenan al mismo tiempo
4. **No hay buffer de acumulacion**: Cada fragmento de voz se procesa individualmente
5. **La conversacion no se persiste correctamente**: step_data queda vacio
6. **El meta context no llega**: Nova no tiene datos de redes sociales

---

## SOLUCION: BUFFER SYSTEM (inspirado en ClinicForge)

### Concepto: Debounce + Acumulacion + Procesamiento Atomico

El mismo patron que ClinicForge usa para WhatsApp/Instagram, adaptado al Realtime voice:

```
FLUJO ACTUAL (roto):
  Usuario habla → fragmento → AI procesa → responde → fragmento → AI procesa → responde
  (cada fragmento genera una respuesta separada, se superponen)

FLUJO CORRECTO (con buffer):
  Usuario habla → fragmento 1 → buffer
                → fragmento 2 → buffer (timer reset)
                → fragmento 3 → buffer (timer reset)
                → [2s silencio] → timer expira → concatenar todo → AI procesa UNA VEZ → responde UNA VEZ
```

### Para el Realtime de OpenAI:

El Realtime API de OpenAI YA tiene VAD (Voice Activity Detection) con `server_vad`. El problema es la configuracion. La solucion NO es implementar un buffer custom — es configurar correctamente el VAD de OpenAI:

```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.8,              # ALTO — solo voz clara, ignora ruido
    "prefix_padding_ms": 500,      # 0.5s de margen antes del habla
    "silence_duration_ms": 3000    # 3 SEGUNDOS de silencio para considerar que termino
}
```

Con `silence_duration_ms: 3000`, OpenAI espera 3 segundos completos de silencio antes de procesar. Esto elimina:
- Cortes prematuros por pausas naturales
- Palabras sueltas enviadas por error
- Procesamiento de fragmentos incompletos

### Para el canal de chat (WhatsApp/Instagram/Facebook):

Implementar el buffer system de ClinicForge completo:

---

## PARTE 1: BUFFER MANAGER PARA CANALES DE CHAT

### Arquitectura

```
Webhook (YCloud/Meta/Chatwoot)
    |
    v
CanonicalMessage (normalizado)
    |
    v
Redis Buffer: buffer:{provider}:{tenant_id}:{user_id}
    |
    v
Debounce Timer (11s WhatsApp, 8s Instagram/Facebook)
    |
    v
[Timer expira — usuario dejo de escribir]
    |
    v
Atomic Fetch: leer todo + limpiar buffer
    |
    v
Concatenar mensajes + media
    |
    v
NexusEngine: procesar UNA VEZ
    |
    v
ResponseSender: fragmentar en burbujas + enviar con delays
```

### Configuracion por canal

| Canal | Debounce | Bubble Delay | Max Length | Typing |
|-------|----------|-------------|------------|--------|
| WhatsApp | 11s | 4s | 400 chars | Si |
| Instagram | 8s | 3s | 300 chars | Si |
| Facebook | 8s | 3s | 300 chars | Si |

### Archivos a crear

- `orchestrator_service/app/services/buffer_manager.py` — Buffer queue + debounce + atomic fetch
- `orchestrator_service/app/services/response_sender.py` — Bubble fragmentation + multi-channel send

### Archivos a modificar

- `orchestrator_service/main.py` o `whatsapp_service/main.py` — Webhook handlers usan buffer
- `orchestrator_service/app/core/engine.py` — NexusEngine recibe texto concatenado

---

## PARTE 2: FIX DEL VOICE ARCHITECT (Realtime)

### Cambios necesarios en el WS handler (main.py):

1. **VAD config**: threshold 0.8, silence 3000ms, prefix 500ms
2. **Barge-in**: Cancelar audio de Nova cuando el usuario habla (ya implementado)
3. **Meta context**: Asegurar que el context llega al system prompt
4. **Persistencia**: Guardar transcripts en step_data correctamente
5. **Audio queue**: Una sola cola, cancelar al avanzar de paso

### Cambios en el frontend (OnboardingWizard.tsx):

1. **cancelPlayback()**: Cerrar AudioContext al recibir transcript del usuario (ya implementado)
2. **saveChatToDb**: Verificar que step_data se guarda correctamente (fix de merge ya implementado)
3. **UI states**: Nova hablando / Nova escuchando / Procesando — claros y estables

---

## PARTE 3: WHISPER TRANSCRIPTION PARA AUDIO DE WHATSAPP

Cuando llega un audio por WhatsApp, transcribirlo con Whisper antes de enviarlo al AI:

### Flujo:
1. Webhook recibe mensaje con tipo `audio` o `voice`
2. Descargar el archivo de audio
3. Enviar a OpenAI Whisper API: `POST /v1/audio/transcriptions`
4. Guardar transcripcion en `chat_messages.content_attributes`
5. Inyectar transcripcion en el texto que va al AI

### Wait-for-transcription:
- Antes de procesar el buffer, verificar si hay audios pendientes de transcripcion
- Esperar hasta 15s (6 intentos x 2.5s) para que completen
- Si no completa, procesar sin la transcripcion

---

## PARTE 4: RESPONSE SENDER (BUBBLE FRAGMENTATION)

Cuando el AI responde con un texto largo, fragmentarlo en burbujas naturales:

### Logica:
1. Separar por parrafos (`\n\n`)
2. Si un parrafo es muy largo, separar por oraciones (`. ! ?`)
3. Cada burbuja <= max_length del canal
4. Enviar con delay entre burbujas (3-4s)
5. Typing indicator entre burbujas

### Ejemplo:
```
AI responde: "Hola! Tenemos zapatillas Nike en talle 42. El precio es $15.000. Hacemos envios a todo el pais con Andreani."

Se fragmenta en:
Burbuja 1: "Hola! Tenemos zapatillas Nike en talle 42."
[3s delay + typing indicator]
Burbuja 2: "El precio es $15.000."
[3s delay + typing indicator]
Burbuja 3: "Hacemos envios a todo el pais con Andreani."
```

---

## PARTE 5: SOCKET.IO PARA REAL-TIME DASHBOARD

Emitir eventos Socket.IO cuando llegan mensajes y cuando el AI responde:

- `NEW_MESSAGE` → frontend Chats actualiza en vivo
- `TYPING` → mostrar indicador de escritura

---

## CRITERIOS DE ACEPTACION

### Buffer Manager
- [ ] Mensajes se acumulan en Redis con debounce por canal
- [ ] Timer se resetea con cada mensaje nuevo
- [ ] Atomic fetch: leer + limpiar en una operacion
- [ ] Un solo procesamiento AI por batch de mensajes
- [ ] Multi-wave: si llegan mensajes durante el AI, se crea nuevo batch

### Voice Architect
- [ ] VAD threshold 0.8, silence 3000ms — no corta frases
- [ ] Audio de Nova se cancela cuando el usuario habla (barge-in)
- [ ] Meta context llega al system prompt de Nova
- [ ] Chat history se persiste en step_data correctamente
- [ ] No hay audio superpuesto entre respuestas

### Whisper Transcription
- [ ] Audios de WhatsApp se transcriben con Whisper
- [ ] Transcripcion se inyecta en el contexto del AI
- [ ] Wait-for-transcription con timeout de 15s

### Response Sender
- [ ] Respuestas largas se fragmentan en burbujas
- [ ] Delay natural entre burbujas (3-4s)
- [ ] Typing indicator entre burbujas
- [ ] Respeta max_length por canal

### Socket.IO
- [ ] NEW_MESSAGE emitido en cada mensaje entrante y saliente
- [ ] Frontend Chats se actualiza en tiempo real
