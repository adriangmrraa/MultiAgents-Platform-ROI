# PLAN TÉCNICO: Voice Architect — Experiencia de Voz en Onboarding

## Fecha: 2026-03-25
## Spec: `specs/2026-03-25_voice-architect-onboarding.spec.md`

---

## NOTA ARQUITECTÓNICA

No se crean archivos nuevos. Todo se modifica en archivos existentes:
- Backend: 1 endpoint nuevo en `onboarding.py` (TTS proxy)
- Frontend: refactor del chat en `OnboardingWizard.tsx` para agregar modo voz

---

## RESUMEN EJECUTIVO

3 fases, 8 tareas.

| Fase | Entregable | Tareas |
|------|-----------|--------|
| **Fase 1** | Backend TTS endpoint + API key fix | T1-T2 |
| **Fase 2** | Frontend: consent card + playTTS + auto-listen cycle | T3-T5 |
| **Fase 3** | UI interactiva: botones inline + sub-confirmaciones + estados | T6-T8 |

---

## FASE 1: BACKEND

### T1: Endpoint TTS proxy
**Modificar**: `orchestrator_service/app/api/onboarding.py`

Agregar endpoint:
```python
@router.post("/tts")
async def onboarding_tts(text: str = Body(..., embed=True)):
    """Convert text to speech using OpenAI TTS. Returns MP3 audio."""
    api_key = await _get_platform_key()
    client = openai.AsyncOpenAI(api_key=api_key)
    response = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=text,
        response_format="mp3"
    )
    from starlette.responses import StreamingResponse
    return StreamingResponse(response.iter_bytes(), media_type="audio/mpeg")
```

Helper `_get_platform_key()` que reutiliza la misma lógica de resolución de API key que ya funciona en `interview-step`.

**Verificación**: `curl -X POST /admin/onboarding/tts -d '{"text":"Hola"}' --output test.mp3` → archivo MP3 reproducible.

---

### T2: Refactor API key helper (DRY)
**Modificar**: `orchestrator_service/app/api/onboarding.py`

Extraer la lógica de resolución de API key que se repite en `interview`, `interview-step` y `tts` a una función compartida:

```python
async def _get_platform_key(tenant_id: int = 0) -> str:
    """Resolve OpenAI API key: tenant credential → global var → env fallback."""
    api_key = None
    if tenant_id:
        api_key = await get_tenant_credential_by_type(tenant_id, "OPENAI_API_KEY")
    if not api_key:
        try:
            from main import OPENAI_API_KEY as GLOBAL_KEY
            api_key = GLOBAL_KEY
        except:
            pass
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Platform API key not configured")
    return api_key
```

Reemplazar las 3 instancias de resolución de key para usar esta función.

**Verificación**: `interview-step` y `tts` ambos funcionan con la misma key.

---

## FASE 2: FRONTEND — Modo Voz Core

### T3: Card de consentimiento + playTTS function
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

Agregar estado:
```typescript
const [voiceMode, setVoiceMode] = useState(false);
const [voiceConsent, setVoiceConsent] = useState(false);
const [voiceState, setVoiceState] = useState<'idle'|'speaking'|'listening'|'processing'>('idle');
const [isTTSPlaying, setIsTTSPlaying] = useState(false);
const audioRef = useRef<HTMLAudioElement | null>(null);
```

Función `playTTS(text)`:
```typescript
async function playTTS(text: string): Promise<void> {
    setVoiceState('speaking');
    setIsTTSPlaying(true);
    const res = await fetchApi('/admin/onboarding/tts', {
        method: 'POST', body: { text }
    });
    // fetchApi returns JSON, but TTS returns audio — need raw fetch
    // Use raw fetch for binary audio response
    const audioRes = await fetch(`${API_BASE}/admin/onboarding/tts`, {
        method: 'POST',
        headers: { 'x-admin-token': TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        credentials: 'include'
    });
    const blob = await audioRes.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    return new Promise((resolve) => {
        audio.onended = () => {
            URL.revokeObjectURL(url);
            setIsTTSPlaying(false);
            setVoiceState('idle');
            resolve();
        };
        audio.play().catch(() => { setIsTTSPlaying(false); resolve(); });
    });
}
```

Card de consentimiento al inicio del paso 3 (antes del chat):
```tsx
{step >= 3 && step <= 5 && !voiceConsent && (
    <div className="card">
        <Mic icon />
        <h3>Experiencia de voz</h3>
        <p>Vamos a usar el micrófono para conversar con tu arquitecto de IA.
           Los datos se usan exclusivamente para configurar tu agente.</p>
        <button onClick={acceptVoice}>Iniciar experiencia de voz</button>
        <button onClick={declineVoice}>Prefiero escribir</button>
    </div>
)}
```

`acceptVoice`: pide permiso mic → setVoiceConsent(true) → setVoiceMode(true) → inicia chat
`declineVoice`: setVoiceConsent(true) → setVoiceMode(false) → inicia chat normal

**Verificación**: Card aparece al entrar paso 3. Al aceptar, el arquitecto habla.

---

### T4: Ciclo voz automático (speak → listen → process → speak)
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

Refactor del flujo `sendChatMessage` para integrar voz:

```typescript
async function sendAndSpeak(text?: string) {
    const msg = text || chatInput;
    // ... enviar al backend (ya existe)
    const res = await fetchApi('/admin/onboarding/interview-step', { ... });

    // Mostrar texto en chat (ya existe)
    setChatMessages(prev => [...prev, { role: 'assistant', content: res.ai_message, ... }]);

    // Si modo voz → reproducir TTS y luego reactivar mic
    if (voiceMode) {
        await playTTS(res.ai_message);
        startAutoListen();  // reactiva mic después del TTS
    }
}
```

`startAutoListen()`:
- Usa SpeechRecognition existente
- Al detectar 2s de silencio → envía lo transcrito via `sendAndSpeak(transcript)`
- Al detectar 15s sin voz → stopRecording() + mostrar botón reactivar
- Mientras escucha: `setVoiceState('listening')`

Integrar con `initChat` para el primer mensaje:
```typescript
// Al montar paso 3 con voiceMode=true:
const res = await initChat(step);
if (voiceMode && res?.ai_message) {
    await playTTS(res.ai_message);
    startAutoListen();
}
```

**Verificación**: Ciclo completo funciona: arquitecto habla → mic activo → usuario habla → 2s silencio → procesa → arquitecto responde hablando → mic se reactiva.

---

### T5: Toggle voz/texto + indicadores visuales
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

Toggle permanente en el header del chat:
```tsx
<div className="flex items-center gap-2">
    <button onClick={toggleVoiceMode}>
        {voiceMode ? <Volume2 /> : <VolumeX />}
        {voiceMode ? 'Voz activa' : 'Modo texto'}
    </button>
</div>
```

Indicadores de estado (reemplaza el área encima del input):
```tsx
{voiceState === 'speaking' && (
    <div className="waveform-animation text-violet-400">
        El arquitecto está hablando...
    </div>
)}
{voiceState === 'listening' && (
    <div className="pulse-red">
        Te escucho...
    </div>
)}
{voiceState === 'processing' && (
    <div className="spinner">
        Procesando...
    </div>
)}
```

Waveform: 5 barras animadas (CSS keyframes, igual que el SDK del voice widget).
Pulse: círculo rojo que pulsa (ya existe en el mic button).

**Verificación**: Toggle cambia entre voz y texto. Indicadores se muestran correctamente.

---

## FASE 3: UI INTERACTIVA

### T6: Botones de confirmación inline en el chat
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

Extender el modelo de mensajes del chat:
```typescript
interface ChatMsg {
    role: 'assistant' | 'user';
    content: string;
    buttons?: { label: string; action: string; confirmed?: boolean }[];
}
```

Cuando el backend envía una respuesta que contiene `<CONFIRM:seccion>`, el frontend extrae el tag y muestra botones:

Backend (modificar prompts en `onboarding.py`): agregar instrucciones al prompt para emitir tags de confirmación:
```
Cuando propongas un resumen parcial de una sección, emite el tag:
<CONFIRM:identidad> o <CONFIRM:tono> o <CONFIRM:estilo> etc.
Esto mostrará botones de confirmación al usuario.
```

Frontend: parsear el tag y renderizar botones:
```tsx
{msg.buttons && (
    <div className="flex gap-2 mt-2">
        {msg.buttons.map(btn => (
            <button onClick={() => handleConfirm(btn.action)}>
                {btn.confirmed ? <Check /> : null} {btn.label}
            </button>
        ))}
    </div>
)}
```

`handleConfirm(action)`:
- Guarda el draft parcial de esa sub-sección
- Marca el botón como confirmado (check verde)
- Si voiceMode → el arquitecto dice "Perfecto, siguiente..." por TTS
- Envía mensaje al backend: "CONFIRMADO: {action}" para que el agente avance

**Verificación**: Después de responder sobre tono, aparece botón "Confirmar tono". Al tocar, se guarda y el agente sigue.

---

### T7: Sub-confirmaciones por paso (Pointe Coach sections)
**Modificar**: `orchestrator_service/app/api/onboarding.py` (prompts)

Actualizar `WIZARD_STEP_PROMPTS` para que el agente emita `<CONFIRM:x>` en momentos clave:

**Paso 3 — Identidad** (5 sub-secciones):
```
Sigue este orden estricto:
1. Pregunta nombre + qué vende + diferencial → cuando tengas respuesta, emite <CONFIRM:identidad>
2. Pregunta pronombres + formalidad → emite <CONFIRM:tono>
3. Pregunta emojis + muletillas → emite <CONFIRM:estilo>
4. Pregunta frases prohibidas → emite <CONFIRM:restricciones>
5. Genera resumen completo → emite <SECTION_COMPLETE>
```

**Paso 4 — Reglas** (sub-secciones):
```
1. Envíos → <CONFIRM:envios>
2. Cambios/devoluciones → <CONFIRM:cambios>
3. Horarios + pagos → <CONFIRM:operativa>
4. Prohibiciones → <CONFIRM:prohibiciones>
5. Resumen → <SECTION_COMPLETE>
```

**Paso 5 — Diccionario** (sub-secciones):
```
1. Categorías de productos → <CONFIRM:categorias>
2. Jerga regional → <CONFIRM:jerga>
3. Abreviaciones → <CONFIRM:abreviaciones>
4. Resumen → <SECTION_COMPLETE>
```

**Verificación**: El agente propone sub-secciones en orden y emite tags de confirmación.

---

### T8: Preservar historial al navegar entre pasos
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

Cambiar el state de `chatMessages` a un map por paso:
```typescript
const [chatHistories, setChatHistories] = useState<Record<number, ChatMsg[]>>({});
```

Al cambiar de paso:
- Guardar mensajes actuales en `chatHistories[step]`
- Al volver, cargar `chatHistories[step]` si existe
- NO reiniciar la sesión del backend (ya se preserva en `WIZARD_STEP_SESSIONS`)

Al cargar historial existente:
- No hacer `initChat` de nuevo (el saludo ya está en el historial)
- Si voiceMode activo, NO reproducir TTS del último mensaje (ya se dijo)
- El usuario puede continuar hablando/escribiendo desde donde quedó

**Verificación**: Sale del paso 3 → va a paso 2 → vuelve al 3 → historial intacto, sin re-saludo.

---

## DEPENDENCIAS

```
T1 ─→ T2 (DRY refactor)
T3 (después de T1 — necesita endpoint TTS)
T4 (después de T3 — necesita playTTS)
T5 (paralelo con T4)
T6 (después de T4)
T7 (paralelo con T6 — es backend prompts)
T8 (después de T6)
```

---

## CROSS-CHECK: Criterios de Aceptación vs Tareas

| Criterio | Tarea |
|----------|-------|
| Card de consentimiento | T3 |
| Arquitecto habla automáticamente (TTS nova) | T1, T3 |
| Voz femenina argentina preconfigurada | T1 |
| Mic se activa después del TTS | T4 |
| 2s silencio → procesa | T4 |
| 15s silencio → mic off | T4 |
| Toggle voz/texto | T5 |
| Mic denegado → TTS + texto | T3 |
| 3 modalidades siempre | T4, T5 |
| Texto aparece como burbuja simultánea | T4 |
| Botones confirmación inline | T6 |
| 5 sub-confirmaciones paso 3 | T6, T7 |
| Cada confirmación guarda draft parcial | T6 |
| Indicadores visuales | T5 |
| Historial preservado al navegar | T8 |
| Retoma sin re-saludo | T8 |
| Sesión backend preservada | T8 (ya funciona) |
| Misma experiencia pasos 4-5 | T7 |
| Costo ~$0.22/usuario tts-1 | T1 |
| API key de la plataforma | T2 |

---

## ESTIMACIÓN

| Tarea | Complejidad | Archivos |
|-------|------------|----------|
| T1 | Baja | 1 (onboarding.py) |
| T2 | Baja | 1 (onboarding.py) |
| T3 | Media | 1 (OnboardingWizard.tsx) |
| T4 | **Alta** | 1 (OnboardingWizard.tsx — ciclo voz completo) |
| T5 | Baja | 1 (OnboardingWizard.tsx) |
| T6 | Media | 1 (OnboardingWizard.tsx) |
| T7 | Media | 1 (onboarding.py — prompts) |
| T8 | Media | 1 (OnboardingWizard.tsx) |
