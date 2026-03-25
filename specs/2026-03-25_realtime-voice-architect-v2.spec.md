# SPEC: Realtime Voice Architect v2 — Fix de Arquitectura

## Fecha: 2026-03-25
## Prioridad: P0 — El onboarding de voz no funciona correctamente
## Problema: Sesiones se reinician, audio se superpone, no usa datos de redes

---

## PROBLEMAS ACTUALES

1. **Sesion se reinicia**: Cuando Nova dice algo que parece fin de seccion, el frontend crea nueva sesion → pierde todo el contexto → arranca de cero
2. **Audio superpuesto**: Al crear nueva sesion, el audio de la anterior sigue sonando → dos voces simultaneas
3. **No usa datos de redes**: El meta context no llega al Realtime porque tenant_id es null en el momento de la extraccion
4. **Capta ruido ambiente**: VAD demasiado sensible, capta conversaciones de fondo y otros idiomas
5. **No hay control de transicion**: El Realtime API no emite tags XML como el chat de texto — no hay forma automatica de detectar fin de seccion

---

## ARQUITECTURA CORRECTA

### Principio: UNA sola sesion Realtime por todo el paso 3 (o 4 o 5)

```
Usuario toca "Iniciar experiencia de voz"
    |
    v
1. Frontend extrae meta context (tenant_id correcto)
2. Frontend crea sesion Realtime con system prompt + meta context
3. Se abre UN SOLO WebSocket que dura todo el paso
4. Nova habla presentando la investigacion de redes
5. Conversacion fluye — el usuario habla, Nova responde
6. El usuario controla avance con botones manuales en la UI:
   [Confirmar identidad] [Confirmar tono] [Ya termine]
7. Al tocar "Ya termine" → se cierra el WS → se muestra resumen
8. Al confirmar resumen → recien ahi se avanza al paso siguiente
9. Paso siguiente → se abre NUEVO WS con NUEVO prompt
```

### Reglas criticas:
- **NUNCA** crear sesion nueva sin cerrar la anterior primero
- **NUNCA** iniciar audio nuevo si hay audio reproduciendose
- **UN SOLO WebSocket** activo a la vez, durante todo un paso
- **El usuario controla las transiciones**, no la IA
- **Al cerrar WS**: limpiar AudioContext, detener mic, resetear cola de audio

---

## CAMBIOS NECESARIOS

### 1. Frontend: Ciclo de vida del WebSocket

**Estado actual (roto)**:
- `connectRealtime()` se llama multiples veces
- No hay cleanup del WS anterior
- `goNext()` puede triggear reconexion

**Estado correcto**:
```typescript
// Un solo WS por paso. Se crea al aceptar voz. Se cierra al confirmar resumen.
const [realtimeSessionActive, setRealtimeSessionActive] = useState(false);

// connectRealtime: solo se llama UNA VEZ al inicio del paso
// stopRealtimeAudio: limpia TODO (WS, AudioContext, mic, cola de audio)
// goNext: PRIMERO cierra WS, DESPUES avanza

// Secuencia correcta:
// acceptVoice → connectRealtime → [conversacion libre] → boton "Ya termine"
// → stopRealtimeAudio → mostrar resumen → boton "Confirmar" → goNext
```

### 2. Frontend: Cola de audio con cleanup

**Estado actual (roto)**:
- `nextPlayTimeRef` puede quedar desfasado si se crea nuevo AudioContext
- No hay forma de cancelar audio en reproduccion

**Estado correcto**:
```typescript
// Al crear nuevo AudioContext, resetear nextPlayTimeRef
// Al llamar stopRealtimeAudio, cancelar todo audio pendiente
const stopRealtimeAudio = () => {
    // 1. Cerrar WebSocket
    // 2. Detener microfono
    // 3. Cerrar AudioContext (esto cancela todo audio pendiente)
    // 4. Resetear nextPlayTimeRef a 0
    // 5. Setear realtimeSessionActive = false
};
```

### 3. Tools de Nova: Guardar secciones del System Prompt

Nova tiene tools que GUARDAN cada pieza del system prompt en la DB mientras conversa. Cada tool persiste una seccion especifica. Al final, todas las piezas se ensamblan.

**Tools del Realtime (OpenAI function calling)**:

```json
[
    {
        "type": "function",
        "name": "guardar_identidad",
        "description": "Guardar la seccion de identidad del negocio en el system prompt. Llamar cuando tengas: nombre del negocio, rubro, cliente ideal, diferencial competitivo.",
        "parameters": {
            "type": "object",
            "properties": {
                "nombre_negocio": { "type": "string" },
                "rubro": { "type": "string" },
                "cliente_ideal": { "type": "string" },
                "diferencial": { "type": "string" },
                "prompt_seccion": { "type": "string", "description": "Texto completo de la seccion IDENTIDAD para el system prompt, con densidad tipo Pointe Coach" }
            },
            "required": ["nombre_negocio", "rubro", "prompt_seccion"]
        }
    },
    {
        "type": "function",
        "name": "guardar_tono",
        "description": "Guardar la seccion de tono y personalidad. Llamar cuando tengas: pronombres, formalidad, emojis, muletillas, frases prohibidas.",
        "parameters": {
            "type": "object",
            "properties": {
                "pronombres": { "type": "string", "description": "vos, tu, o usted" },
                "formalidad": { "type": "string", "description": "casual, profesional, premium" },
                "emojis": { "type": "string", "description": "si/no y cuales" },
                "muletillas": { "type": "string", "description": "frases puente tipicas" },
                "prohibido": { "type": "string", "description": "frases o palabras prohibidas" },
                "prompt_seccion": { "type": "string", "description": "Texto completo de la seccion TONO Y PERSONALIDAD para el system prompt" }
            },
            "required": ["prompt_seccion"]
        }
    },
    {
        "type": "function",
        "name": "guardar_reglas",
        "description": "Guardar las reglas de negocio. Llamar cuando tengas: envios, cambios, horarios, pagos, prohibiciones.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt_seccion": { "type": "string", "description": "Texto completo de la seccion REGLAS DE NEGOCIO como imperativos claros" }
            },
            "required": ["prompt_seccion"]
        }
    },
    {
        "type": "function",
        "name": "guardar_diccionario",
        "description": "Guardar el diccionario de sinonimos. Llamar cuando tengas los sinonimos de productos, jerga, abreviaciones.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt_seccion": { "type": "string", "description": "Texto completo de la seccion DICCIONARIO DE SINONIMOS con minimo 5 sinonimos por categoria" }
            },
            "required": ["prompt_seccion"]
        }
    },
    {
        "type": "function",
        "name": "finalizar_configuracion",
        "description": "Llamar cuando TODAS las secciones estan guardadas y el usuario confirmo. Ensambla el system prompt final.",
        "parameters": {
            "type": "object",
            "properties": {
                "resumen_final": { "type": "string", "description": "Resumen breve de todo lo configurado" }
            },
            "required": ["resumen_final"]
        }
    },
    {
        "type": "function",
        "name": "cambiar_seccion",
        "description": "Cambiar la seccion visible en la UI. Usar para navegar entre secciones, mostrar progreso, o cambiar el contexto visual. Tambien se usa para mostrar botones interactivos al usuario.",
        "parameters": {
            "type": "object",
            "properties": {
                "seccion_activa": { "type": "string", "description": "Seccion a mostrar: identidad, tono, estilo, restricciones, reglas, diccionario, resumen" },
                "titulo": { "type": "string", "description": "Titulo que se muestra en la UI para esta seccion" },
                "descripcion": { "type": "string", "description": "Descripcion breve de que se configura en esta seccion" },
                "botones": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": { "type": "string" },
                            "accion": { "type": "string", "description": "confirmar, editar, saltar, volver" },
                            "estilo": { "type": "string", "description": "primary, secondary, danger" }
                        }
                    },
                    "description": "Botones interactivos que se muestran al usuario"
                },
                "mostrar_resumen_parcial": { "type": "boolean", "description": "Si true, muestra el resumen de lo guardado hasta ahora" }
            },
            "required": ["seccion_activa"]
        }
    },
    {
        "type": "function",
        "name": "mostrar_dato_extraido",
        "description": "Mostrar un dato especifico extraido de las redes sociales como card visual en la UI. Usar al inicio para presentar la investigacion de forma visual.",
        "parameters": {
            "type": "object",
            "properties": {
                "tipo": { "type": "string", "description": "instagram_profile, facebook_page, dato_clave, estadistica" },
                "titulo": { "type": "string" },
                "valor": { "type": "string" },
                "icono": { "type": "string", "description": "instagram, facebook, store, users, star" }
            },
            "required": ["tipo", "titulo", "valor"]
        }
    }
]
```

**Flujo de ejecucion completo**:

INICIO (Nova presenta investigacion):
1. Nova llama `mostrar_dato_extraido({tipo: "instagram_profile", titulo: "@ahsports", valor: "2.3K seguidores, Bio: Indumentaria deportiva premium", icono: "instagram"})`
2. Frontend renderiza card visual con el dato de Instagram
3. Nova llama `mostrar_dato_extraido({tipo: "facebook_page", titulo: "Ah-Indumentaria Deportiva", valor: "1.2K fans, Categoria: Ropa deportiva", icono: "facebook"})`
4. Frontend renderiza otra card
5. Nova HABLA presentando los datos mientras las cards aparecen visualmente

SECCION IDENTIDAD:
6. Nova llama `cambiar_seccion({seccion_activa: "identidad", titulo: "Identidad del Negocio", descripcion: "Nombre, rubro, cliente ideal", botones: [{label: "Confirmar identidad", accion: "confirmar", estilo: "primary"}]})`
7. Frontend actualiza la UI: muestra titulo + descripcion + boton
8. Nova conversa, extrae info
9. Cuando tiene todo → llama `guardar_identidad({nombre: "H-Sports", rubro: "indumentaria deportiva", prompt_seccion: "## IDENTIDAD\n..."})`
10. Backend guarda en DB → envia evento al frontend → badge verde
11. El boton "Confirmar identidad" se pone en check verde automaticamente

SECCION TONO:
12. Nova llama `cambiar_seccion({seccion_activa: "tono", titulo: "Tono y Personalidad", descripcion: "Como habla tu agente", botones: [{label: "Confirmar tono", accion: "confirmar", estilo: "primary"}]})`
13. Frontend actualiza UI con nueva seccion
14. Proceso se repite...

FINALIZACION:
15. Nova llama `cambiar_seccion({seccion_activa: "resumen", titulo: "Resumen Final", mostrar_resumen_parcial: true, botones: [{label: "Activar agente", accion: "confirmar", estilo: "primary"}, {label: "Editar algo", accion: "editar", estilo: "secondary"}]})`
16. Frontend muestra todo el system prompt ensamblado
17. Nova llama `finalizar_configuracion({resumen: "..."})`
18. Frontend cierra WS, activa el agente

**Las secciones se persisten en la DB en tiempo real** — si el usuario cierra el browser, las secciones ya guardadas no se pierden.
**La UI se actualiza en tiempo real** — Nova controla qué ve el usuario mientras conversan.

### Badges de progreso (UI)

```
┌─────────────────────────────────────┐
│ [✓ Identidad] [✓ Tono] [ Reglas]    │
│ [ Diccionario] [ Final]             │
│                                     │
│  [Pausar mic]  [Ya termine]         │
│                                     │
│  Nova hablando / Te escucho...      │
│                                     │
│  Chat transcript                    │
└─────────────────────────────────────┘
```

- **Badges grises**: Pendientes
- **Badges violetas con check**: Guardados (Nova ejecuto la tool)
- **"Ya termine"**: Fallback manual — cierra WS y genera resumen via texto
- **"Pausar mic"**: Mute sin cerrar WS

### 3b. Secuencia visual de Research (ANTES de que Nova hable)

Al entrar al paso 3, ANTES de conectar el Realtime:

```
1. Frontend llama extract-meta-data → recibe assets + context
2. Empieza la secuencia de cards animadas (parallelo con la conexion WS):

   [Card 1 — fade in]
   Instagram: @ahsports · 2.3K seguidores
   Bio: "Indumentaria deportiva premium"
   → 3 segundos → fade out

   [Card 2 — fade in]
   Facebook: Ah-Indumentaria Deportiva · 1.2K fans
   Categoria: Ropa deportiva
   → 3 segundos → fade out

   [Card 3 — fade in]
   Ultimo post IG: "Nueva coleccion de conjuntos deportivos..."
   → 3 segundos → fade out

   [Card 4 — fade in]
   Ultimo post FB: "Camisetas personalizadas para tu equipo..."
   → 3 segundos → fade out

   [Card 5 — fade in]
   Investigacion completa · Conectando con Nova...
   → hasta que el WS conecte

3. Mientras las cards se muestran, el frontend conecta el WS Realtime
4. El system prompt del Realtime YA tiene todo el context de Meta
5. Cuando el WS conecta y Nova empieza a hablar, las cards se reemplazan
   por el indicador "Nova hablando..." + chat transcript
6. Nova HABLA con todo el contexto — menciona datos concretos
```

**Cada card tiene**:
- Icono (Instagram/Facebook/Web/Dato)
- Titulo (nombre del perfil o tipo de dato)
- Valor (seguidores, bio, excerpt de post)
- Animacion: fade-in → 3 seg visible → fade-out → siguiente card
- Estilo glass con borde del color de la red social

**Los datos vienen de `extract-meta-data`** que retorna:
- `instagram_profile`: username, bio, followers, media_count
- `instagram_posts`: captions de ultimos 5 posts
- `facebook_page`: name, category, about, fan_count
- `facebook_posts`: messages de ultimos 5 posts

**El context completo se inyecta al system prompt del Realtime** — Nova ya sabe todo antes de decir "Hola".

### 4. Backend: Meta context debe llegar

**Flujo correcto**:
1. `loadProgress` setea `tenantId` desde la DB
2. Al entrar a paso 3, ANTES de `connectRealtime`:
   - Llamar `extractMetaData()` con `tenantId` correcto (no 0)
   - Esperar respuesta
   - Guardar en `metaContext` state
3. `connectRealtime` pasa `metaContext` al `realtime-session` endpoint
4. El endpoint inyecta el contexto en el system prompt
5. El greeting del Realtime usa ese contexto

**Verificacion**: Log del backend debe mostrar `has_meta: true`

### 5. Backend: VAD menos sensible

```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.7,           # era 0.5 — subir para ignorar ruido
    "prefix_padding_ms": 500,   # era 300 — mas margen antes del habla
    "silence_duration_ms": 2000  # era 1500 — esperar mas silencio
}
```

### 6. Frontend: Generacion de resumen al terminar

Cuando el usuario toca "Ya termine":
1. Cerrar WS Realtime
2. Tomar todo el transcript acumulado (mensajes del chat)
3. Enviar a `POST /admin/onboarding/interview-step` con:
   - `user_message: "GENERA EL RESUMEN FINAL basado en toda la conversacion"`
   - `chat_history: [todos los mensajes]`
   - `step: 3`
4. El endpoint de texto (no Realtime) genera el `<SECTION_COMPLETE>` con el draft
5. Mostrar resumen editable
6. Al confirmar → guardar draft → avanzar paso

Esto separa la conversacion de voz (fluida, sin tags) de la generacion de resumen (texto, con tags).

---

## GHERKIN

```gherkin
Feature: Realtime Voice Architect v2

  Scenario: Una sola sesion por paso
    Given el usuario acepta experiencia de voz en paso 3
    When se conecta el Realtime
    Then hay UN SOLO WebSocket activo
    And permanece abierto durante toda la conversacion del paso
    And NO se crea otro hasta que el usuario cierre este

  Scenario: Nova presenta investigacion de redes
    Given tenant_id=18 tiene business_assets de Meta
    When se inicia el Realtime en paso 3
    Then Nova dice datos concretos del negocio (nombre, seguidores, bio)
    And los datos vienen de extract-meta-data con tenant_id=18

  Scenario: Audio limpio sin superposicion
    Given Nova esta hablando
    When llegan chunks de audio
    Then se reproducen en secuencia (cola FIFO)
    And NUNCA se superponen dos chunks

  Scenario: Usuario controla transicion
    Given la conversacion esta activa
    When el usuario toca "Ya termine esta seccion"
    Then se cierra el WebSocket
    And se detiene el microfono
    And se cancela todo audio pendiente
    And se muestra resumen editable generado del transcript

  Scenario: No se reinicia la sesion
    Given la conversacion esta activa
    When Nova termina de responder
    Then el WS sigue abierto
    And el mic se reactiva (listening)
    And NO se crea nueva sesion

  Scenario: Avanzar al paso siguiente
    Given el usuario confirmo el resumen del paso 3
    When toca "Confirmar y seguir"
    Then se verifica que el WS anterior esta cerrado
    And recien entonces se avanza al paso 4
    And se muestra consent card de voz para paso 4
    And se crea NUEVO WS con prompt de reglas

  Scenario: Ruido ambiente no activa respuesta
    Given el VAD tiene threshold 0.7
    When hay conversacion de fondo o ruido
    Then Nova NO responde
    And el mic sigue en listening esperando voz clara

  Scenario: Pausar microfono
    Given la conversacion esta activa
    When el usuario toca "Pausar mic"
    Then el mic se silencia (mute)
    And el WS sigue abierto
    And Nova puede seguir hablando si estaba respondiendo
    And el boton cambia a "Activar mic"
```

---

## ARCHIVOS A MODIFICAR

- `frontend_react/src/views/OnboardingWizard.tsx`:
  - Refactor `connectRealtime`: agregar guard de sesion unica
  - Refactor `stopRealtimeAudio`: cleanup completo + resetear cola
  - Agregar boton "Ya termine" que cierra WS y genera resumen via texto
  - Agregar boton "Pausar mic" (mute sin cerrar WS)
  - `goNext`: verificar WS cerrado antes de avanzar
  - `nextPlayTimeRef`: resetear al crear nuevo AudioContext
  - Resolver `tenantId` ANTES de `connectRealtime`

- `orchestrator_service/main.py`:
  - VAD: threshold 0.7, prefix 500ms, silence 2000ms
  - Log del system prompt length y meta presence

- `orchestrator_service/app/api/onboarding.py`:
  - `extract-meta-data`: asegurar que tenant_id=18 llega correctamente

---

## CRITERIOS DE ACEPTACION

### Sesion y Audio
- [ ] UN SOLO WebSocket activo por paso — nunca dos simultaneos
- [ ] Audio NUNCA se superpone — cola FIFO con cleanup al cerrar
- [ ] stopRealtimeAudio limpia TODO (WS, AudioContext, mic, cola, nextPlayTime)
- [ ] Nuevo paso = cerrar WS anterior PRIMERO, luego crear nuevo

### Meta Context
- [ ] Nova presenta datos de redes en el primer mensaje
- [ ] tenant_id correcto llega a extract-meta-data
- [ ] Log muestra has_meta: true con length > 0

### Function Calling — Guardado de Secciones
- [ ] Nova llama guardar_identidad cuando tiene nombre + rubro + cliente ideal + diferencial
- [ ] Nova llama guardar_tono cuando tiene pronombres + formalidad + emojis + muletillas
- [ ] Nova llama guardar_reglas cuando tiene envios + cambios + horarios + pagos + prohibiciones
- [ ] Nova llama guardar_diccionario cuando tiene sinonimos + jerga + abreviaciones
- [ ] Cada tool guarda prompt_seccion en onboarding_progress.step_data en la DB
- [ ] Cada tool acumula en system_prompt_draft
- [ ] Frontend muestra badge con check al recibir evento seccion_guardada
- [ ] Nova llama finalizar_configuracion cuando todo esta completo
- [ ] Frontend cierra WS y muestra resumen al recibir finalizar_configuracion
- [ ] Secciones guardadas sobreviven si el usuario cierra el browser
- [ ] "Ya termine" funciona como fallback manual

### VAD y Ruido
- [ ] Threshold 0.7 — ruido ambiente no triggerea respuestas
- [ ] Silence duration 2000ms — espera suficiente entre frases
- [ ] Prefix padding 500ms — no corta inicio de frases

### Transiciones
- [ ] Al confirmar resumen, recien se avanza al paso siguiente
- [ ] Paso siguiente muestra consent card o inicia nuevo WS
- [ ] "Pausar mic" silencia sin cerrar WS
