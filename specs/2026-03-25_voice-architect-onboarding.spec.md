# SPEC: Voice Architect — Experiencia de Voz en el Onboarding Wizard

## Fecha: 2026-03-25
## Prioridad: P0 — Experiencia diferenciadora del onboarding
## Dependencias: Onboarding Wizard (pasos 3-4-5), OPENAI_API_KEY global

---

## OBJETIVO DE NEGOCIO

Transformar los pasos 3, 4 y 5 del onboarding wizard en una experiencia conversacional por voz bidireccional. Al entrar al paso 3, el Arquitecto de IA **habla automáticamente** dando la bienvenida y guiando al usuario. El usuario responde hablando. La conversación fluye como una llamada natural — el agente pregunta, el usuario responde, el agente procesa y sigue preguntando.

**Diferenciador**: Ninguna plataforma de e-commerce ofrece esto. Es el "wow moment" que cierra la suscripción.

---

## FLUJO DE EXPERIENCIA

```
Usuario entra al Paso 3
    │
    ▼
🔊 El Arquitecto HABLA automáticamente:
   "¡Hola! Soy el arquitecto de tu agente de IA.
    Vamos a crear la personalidad perfecta para tu negocio.
    Contame, ¿cómo se llama tu tienda y qué vendés?"
    │
    ▼
🎙 El micrófono se activa automáticamente (con permiso del browser)
   El usuario HABLA su respuesta
    │
    ▼
📝 STT (Web Speech API) transcribe → se envía como texto al backend
    │
    ▼
🤖 Backend procesa (interview-step) → genera respuesta texto
    │
    ▼
🔊 TTS (OpenAI TTS o Web Speech API) reproduce la respuesta del arquitecto
    │
    ▼
🎙 Mic se reactiva automáticamente → espera siguiente respuesta
    │
    ▼
   (ciclo continúa hasta completar el checklist)
    │
    ▼
🔊 "Perfecto, ya tengo toda la info. Te muestro el resumen."
    │
    ▼
📋 Se muestra el resumen editable (igual que ahora)
```

---

## ARQUITECTURA TÉCNICA

### Opción A: Web Speech API puro (STT + TTS del browser)
- **STT**: `webkitSpeechRecognition` (ya implementado en el wizard)
- **TTS**: `window.speechSynthesis` (gratis, funciona offline, voces del sistema)
- **Costo**: $0 adicional
- **Calidad de voz**: Media (voces robóticas del sistema)
- **Latencia**: Baja (~200ms)
- **Pros**: Sin costo, sin API calls extra
- **Contras**: Voces poco naturales, depende del browser/OS

### Opción B: Web Speech API STT + OpenAI TTS (RECOMENDADA)
- **STT**: `webkitSpeechRecognition` (gratis, del browser)
- **TTS**: OpenAI TTS API (`POST /v1/audio/speech`) con voces naturales
- **Costo**: ~$0.015 por respuesta TTS (~15 respuestas por onboarding = ~$0.22/usuario)
- **Calidad de voz**: Alta (voces alloy/nova/shimmer — naturales, humanas)
- **Latencia**: ~500ms-1s (API call + streaming audio)
- **Pros**: Voz natural, profesional, consistente entre browsers
- **Contras**: Costo adicional (pero es inversión en conversión)

### Decisión: OPCIÓN B
A $0.22/usuario de TTS + $0.02/usuario de chat = $0.24/usuario total de onboarding.
A 1M usuarios = $240K. Con 3% conversión × $49/mes = $1.47M/mes. ROI: 6x.

---

## IMPLEMENTACIÓN

### Nuevo endpoint: `POST /admin/onboarding/tts`

```python
@router.post("/tts")
async def onboarding_tts(text: str = Body(..., embed=True)):
    """Convert text to speech using OpenAI TTS. Returns audio bytes."""
    api_key = get_platform_openai_key()
    client = openai.AsyncOpenAI(api_key=api_key)

    response = await client.audio.speech.create(
        model="tts-1",          # tts-1 (rápido) o tts-1-hd (calidad)
        voice="nova",           # nova = femenina cálida, ideal para onboarding
        input=text,
        response_format="mp3"
    )

    return StreamingResponse(
        response.iter_bytes(),
        media_type="audio/mpeg"
    )
```

### Frontend: VoiceArchitect mode en ChatStep

Cuando el paso es 3, 4 o 5 y el wizard entra al paso:

```typescript
// 1. Al montar el paso, enviar INIT al backend
const res = await fetchApi('/admin/onboarding/interview-step', { ... reset: true });

// 2. Reproducir la respuesta del arquitecto por voz
await playTTS(res.ai_message);

// 3. Activar micrófono automáticamente (con permiso previo)
startListening();

// 4. Cuando el usuario termina de hablar (silencio 2s):
//    - Enviar texto transcrito al backend
//    - Recibir respuesta
//    - Reproducir respuesta por TTS
//    - Reactivar micrófono
```

### Función `playTTS(text)`:

```typescript
async function playTTS(text: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/onboarding/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': TOKEN },
        body: JSON.stringify({ text }),
        credentials: 'include'
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    return new Promise((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play();
    });
}
```

### Flujo de estados del modo voz:

```
IDLE → SPEAKING (TTS reproduciendo) → LISTENING (mic activo) → PROCESSING (enviando al backend) → SPEAKING → ...
```

UI indicators:
- **SPEAKING**: Waveform animado violeta + texto "El arquitecto está hablando..."
- **LISTENING**: Círculo rojo pulsante + texto "Te escucho..."
- **PROCESSING**: Spinner + texto "Procesando..."

### Permiso de micrófono:

Al entrar al paso 3 por primera vez:
1. Mostrar card: "Para una experiencia más fluida, activá el micrófono. También podés escribir si preferís."
2. Botón "Activar micrófono" → pide permiso
3. Si acepta → modo voz completo (auto-speak + auto-listen)
4. Si rechaza → modo texto normal (como está ahora)
5. Toggle visible siempre: "Modo voz ON/OFF" para cambiar en cualquier momento

---

---

## CLARIFICACIONES RESUELTAS

### C1: Permiso de micrófono — antes del TTS, con consentimiento
**Decisión**: Al entrar al paso 3, ANTES de que el arquitecto hable:
1. Mostrar card de consentimiento: "Vamos a usar el micrófono para conversar con tu arquitecto de IA. Los datos de voz se usan exclusivamente para configurar tu agente. Aceptás?"
2. Botón "Iniciar experiencia de voz" → pide permiso de mic + satisface autoplay policy
3. Si acepta → el arquitecto arranca hablando automáticamente
4. Si rechaza → modo texto puro (chat normal, sin TTS ni STT)
5. Si el browser permite autoplay directo → se salta la card y arranca

### C2: Silencio — 15s para cortar mic, 2s para empezar a procesar
**Decisión**: Dos umbrales:
- **2 segundos de silencio**: El sistema empieza a procesar lo que el usuario dijo (envía al backend). Si el usuario retoma antes de que la respuesta llegue, se cancela y se espera.
- **15 segundos de silencio total**: Se corta el micrófono completamente (ahorro de recursos). El usuario puede reactivarlo tocando el botón de mic.
- El modelo NO gestiona esto — es lógica del frontend con el VAD (Voice Activity Detection) del Web Speech API.
- Experiencia: el usuario habla → pausa natural de 2s → el agente procesa → responde por voz → el mic se reactiva automáticamente.

### C3: Voz femenina argentina por defecto
**Decisión**: Todo preconfigurado, sin opciones para el usuario:
- Voz: `nova` (femenina, cálida — la más natural de OpenAI en español)
- Idioma STT: `es-AR` (español argentino)
- No hay selector de voz — es parte de la identidad de la plataforma
- El arquitecto habla con voseo natural ("Contame", "Fijate", "Mirá")

### C4: Retomar conversación al volver
**Decisión**: El historial de chat se preserva en el state del componente. Si el usuario sale y vuelve:
- Los mensajes anteriores siguen ahí (scroll up para ver)
- El backend tiene la sesión en `WIZARD_STEP_SESSIONS` (in-memory)
- Al reactivar voz o escribir, se retoma el contexto
- No se saluda de nuevo — el arquitecto continúa donde quedó
- Las 3 modalidades de input funcionan siempre: voz, texto escrito, audio grabado transcrito

### C5: Texto + UI interactiva sincronizada con la voz
**Decisión**: Mientras el arquitecto habla:
- El texto completo aparece inmediatamente como burbuja de chat
- El audio reproduce encima (no hay typing effect — la burbuja ya está)
- Botones interactivos aparecen EN LÍNEA con el chat cuando corresponde:
  - "Confirmar tono" → cuando el agente propone un tono
  - "Siguiente sección" → cuando se completa una parte del checklist
  - "Editar" → para corregir algo que el agente interpretó mal
- La UI sigue el hilo: cada sección del prompt Pointe Coach tiene su confirmación:
  1. Identidad (nombre, qué vende) → botón "Confirmar identidad"
  2. Pronombres y formalidad → botón "Confirmar tono"
  3. Emojis y muletillas → botón "Confirmar estilo"
  4. Frases prohibidas → botón "Confirmar restricciones"
  5. Resumen final → botón "Confirmar y seguir al paso 4"
- Cada confirmación envía un mini-update al backend que va armando el draft parcial

---

## CONFIGURACIÓN DE VOZ DEL ARQUITECTO

| Parámetro | Valor |
|-----------|-------|
| Modelo TTS | `tts-1` (rápido) para onboarding, `tts-1-hd` opcional |
| Voz | `nova` (femenina, cálida, profesional — ideal para LATAM) |
| Velocidad | 1.0 (normal) |
| Formato | MP3 (máxima compatibilidad) |
| STT | Web Speech API del browser (es-AR / es-ES) |
| Silencio para corte STT | 2 segundos (más corto que el widget de voz, para fluir mejor) |

---

## GHERKIN

```gherkin
Feature: Voice Architect en Onboarding

  Scenario: Card de consentimiento al entrar al paso 3
    Given el usuario completó paso 2 y entra al paso 3
    When el paso 3 se monta por primera vez
    Then ve una card: "Vamos a usar el micrófono para conversar con tu arquitecto"
    And un botón "Iniciar experiencia de voz"
    And un link "Prefiero escribir" para modo texto

  Scenario: Aceptar voz → arquitecto habla automáticamente
    Given el usuario toca "Iniciar experiencia de voz"
    When el browser otorga permiso de micrófono
    Then el backend genera el mensaje inicial del arquitecto
    And se reproduce por TTS (voz nova, español argentino)
    And el texto aparece como burbuja en el chat simultáneamente

  Scenario: Micrófono se activa después del TTS
    Given el arquitecto terminó de hablar (audio ended)
    When el TTS finaliza
    Then el micrófono se activa automáticamente
    And aparece indicador "Te escucho..." con círculo rojo pulsante

  Scenario: Usuario habla → 2s silencio → agente procesa
    Given el micrófono está activo y el usuario habla
    When hay 2 segundos de silencio
    Then el STT transcribe lo dicho
    And aparece como burbuja del usuario en el chat
    And se envía al backend (interview-step)
    And indicador cambia a "Procesando..."
    And la respuesta se reproduce por TTS
    And el micrófono se reactiva al terminar el TTS

  Scenario: 15s de silencio total → mic se apaga
    Given el micrófono está activo
    When pasan 15 segundos sin que el usuario hable nada
    Then el micrófono se desactiva automáticamente
    And aparece botón para reactivar

  Scenario: Botones interactivos durante la conversación
    Given el arquitecto preguntó sobre el tono y el usuario respondió
    When el arquitecto propone un tono ("Vos, informal, con emojis")
    Then aparece una burbuja con el tono propuesto
    And un botón "Confirmar tono" debajo
    And un botón "Cambiar algo" para corregir
    When el usuario toca "Confirmar tono"
    Then esa sección se guarda como draft parcial
    And el arquitecto pasa a la siguiente sección del checklist por voz

  Scenario: Sub-secciones del paso 3 con confirmación
    Given el paso 3 cubre identidad completa
    Then el flujo tiene 5 sub-confirmaciones en orden:
      1. "Confirmar identidad" (nombre, qué vende, diferencial)
      2. "Confirmar tono" (pronombres, formalidad)
      3. "Confirmar estilo" (emojis, muletillas)
      4. "Confirmar restricciones" (frases prohibidas)
      5. "Confirmar y seguir" (resumen final → paso 4)

  Scenario: Usuario sale y vuelve → retoma
    Given el usuario está en paso 3 y vuelve al paso 2
    When regresa al paso 3
    Then ve los mensajes anteriores del chat (historial preservado)
    And el arquitecto NO saluda de nuevo
    And al activar voz o escribir, continúa donde quedó

  Scenario: 3 modalidades de input siempre disponibles
    Given el usuario está en paso 3-4-5
    Then puede responder de 3 formas en cualquier momento:
      - Hablando (mic activo, STT transcribe)
      - Escribiendo (input de texto normal)
      - Toggle voz/texto para cambiar modo

  Scenario: Micrófono denegado → TTS + texto
    Given el usuario rechaza el permiso de micrófono
    Then el arquitecto habla por TTS (output de voz sí funciona)
    And el usuario responde escribiendo
    And los botones interactivos siguen apareciendo

  Scenario: Flujo completo pasos 3-4-5 por voz
    Given el usuario completó paso 3 con todas las confirmaciones
    When entra al paso 4
    Then el arquitecto habla automáticamente con el prompt de reglas
    And la misma mecánica de voz + botones se aplica
    And al completar paso 4 → paso 5 con diccionario
    And cada paso tiene sus sub-confirmaciones propias
```

---

## ARCHIVOS A CREAR

- Ninguno nuevo — todo se modifica en archivos existentes

## ARCHIVOS A MODIFICAR

- `orchestrator_service/app/api/onboarding.py` — Agregar endpoint `/tts`
- `frontend_react/src/views/OnboardingWizard.tsx` — Agregar modo voz: playTTS(), auto-listen, estados visuales, toggle voz/texto

---

## CRITERIOS DE ACEPTACIÓN

### Voz y Audio
- [ ] Card de consentimiento al entrar al paso 3 (permiso mic + aviso de datos)
- [ ] Al aceptar, el arquitecto habla automáticamente (OpenAI TTS, voz nova)
- [ ] Voz femenina argentina preconfigurada (nova, es-AR)
- [ ] El micrófono se activa automáticamente después del TTS
- [ ] 2s silencio → empieza a procesar la respuesta del usuario
- [ ] 15s silencio total → mic se apaga automáticamente
- [ ] Toggle "Modo voz / Modo texto" visible siempre
- [ ] Si micrófono denegado → TTS funciona, input por texto
- [ ] 3 modalidades: voz, texto escrito, toggle — siempre disponibles

### UI Interactiva
- [ ] Texto del arquitecto aparece como burbuja simultánea al TTS
- [ ] Botones de confirmación inline: "Confirmar tono", "Cambiar algo", etc.
- [ ] Paso 3: 5 sub-confirmaciones (identidad, tono, estilo, restricciones, resumen)
- [ ] Cada confirmación guarda draft parcial y avanza la conversación
- [ ] Indicadores visuales: "Hablando...", "Te escucho...", "Procesando..."

### Persistencia y Navegación
- [ ] Historial de chat preservado al salir y volver al paso
- [ ] Al volver, el arquitecto NO saluda de nuevo — retoma
- [ ] Sesión de chat en backend preservada (WIZARD_STEP_SESSIONS)

### Pasos 4 y 5
- [ ] Misma experiencia de voz que paso 3
- [ ] Cada paso tiene sus propias sub-confirmaciones
- [ ] Al completar paso 5 → resumen editable (modo texto)

### Costos
- [ ] TTS usa modelo tts-1 (rápido, barato)
- [ ] Costo controlado: ~$0.22/usuario de TTS
- [ ] API key de la plataforma (no del tenant)
