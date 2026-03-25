# PLAN: Realtime Voice Architect v2

## Spec: `specs/2026-03-25_realtime-voice-architect-v2.spec.md`

---

## RESUMEN: 5 fases, 10 tareas

| Fase | Entregable | Tareas |
|------|-----------|--------|
| **1** | Backend WS handler: tools + function calling + guardado en DB | T1-T2 |
| **2** | Backend: fix meta extraction + VAD config | T3 |
| **3** | Frontend: sesion unica + cleanup + cola audio | T4-T5 |
| **4** | Frontend: cards research cascada + badges progreso | T6-T7 |
| **5** | Frontend: handler de tools (UI reactiva) + botones | T8-T10 |

---

## FASE 1: BACKEND — Tools en el WS Realtime

### T1: Definir tools en el session.update del WS handler
**Modificar**: `orchestrator_service/main.py` — el bloque `onboarding_realtime_ws`

Agregar las 7 tools al `session.update`:
```python
"tools": [
    {"type": "function", "name": "guardar_identidad", ...},
    {"type": "function", "name": "guardar_tono", ...},
    {"type": "function", "name": "guardar_reglas", ...},
    {"type": "function", "name": "guardar_diccionario", ...},
    {"type": "function", "name": "finalizar_configuracion", ...},
    {"type": "function", "name": "cambiar_seccion", ...},
    {"type": "function", "name": "mostrar_dato_extraido", ...},
]
```

En `openai_to_client`, agregar handler para `response.function_call_arguments.done`:
```python
elif etype == "response.function_call_arguments.done":
    fn_name = event.get("name", "")
    fn_args = json.loads(event.get("arguments", "{}"))
    call_id = event.get("call_id", "")

    result = await handle_onboarding_tool(config, fn_name, fn_args)

    # Send result back to OpenAI
    await openai_ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {"type": "function_call_output", "call_id": call_id, "output": json.dumps(result)}
    }))
    await openai_ws.send(json.dumps({"type": "response.create"}))

    # Forward tool event to frontend
    await websocket.send_text(json.dumps({
        "type": "tool_call",
        "name": fn_name,
        "args": fn_args,
        "result": result
    }))
```

### T2: handle_onboarding_tool — guardar secciones en DB
**Agregar en**: `orchestrator_service/main.py` o extraer a helper

```python
async def handle_onboarding_tool(config, fn_name, fn_args):
    tenant_id = config.get("tenant_id")
    step = config.get("step", 3)

    if fn_name in ("guardar_identidad", "guardar_tono", "guardar_reglas", "guardar_diccionario"):
        prompt_seccion = fn_args.get("prompt_seccion", "")
        # Guardar en onboarding_progress.step_data
        await db.pool.execute("""
            UPDATE onboarding_progress
            SET step_data = jsonb_set(COALESCE(step_data, '{}'), $1, $2::jsonb),
                system_prompt_draft = COALESCE(system_prompt_draft, '') || E'\n\n' || $3,
                updated_at = NOW()
            WHERE tenant_id = $4
        """, [f"step_{step}", fn_name], json.dumps(fn_args), prompt_seccion, tenant_id)
        return {"status": "guardado", "seccion": fn_name}

    elif fn_name == "finalizar_configuracion":
        return {"status": "finalizado"}

    elif fn_name == "cambiar_seccion":
        # Solo forwarded to frontend — no DB action
        return {"status": "ok"}

    elif fn_name == "mostrar_dato_extraido":
        # Solo forwarded to frontend — no DB action
        return {"status": "ok"}

    return {"status": "unknown_tool"}
```

---

## FASE 2: BACKEND — Meta extraction fix + VAD

### T3: Fix meta extraction + VAD tuning
**Modificar**: `orchestrator_service/app/api/onboarding.py` + `orchestrator_service/main.py`

Meta fix:
- `extract-meta-data`: retornar tambien los `assets` raw (no solo el context string) para que el frontend pueda renderizar las cards
- Asegurar `str(tenant_id)` en la query

VAD en main.py:
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.7,
    "prefix_padding_ms": 500,
    "silence_duration_ms": 2000
}
```

---

## FASE 3: FRONTEND — Sesion unica + Audio cleanup

### T4: Refactor connectRealtime — guard de sesion unica
**Modificar**: `frontend_react/src/views/OnboardingWizard.tsx`

```typescript
const connectRealtime = async (chatStep: number) => {
    // GUARD: si ya hay sesion activa, no crear otra
    if (realtimeWsRef.current && realtimeWsRef.current.readyState === WebSocket.OPEN) {
        console.warn('[Realtime] Session already active, skipping');
        return;
    }
    // CLEANUP: cerrar cualquier residuo anterior
    stopRealtimeAudio();
    // ... resto del codigo
};
```

`stopRealtimeAudio`:
```typescript
const stopRealtimeAudio = () => {
    // 1. Cerrar WS
    if (realtimeWsRef.current) { try { realtimeWsRef.current.close(); } catch(e){} realtimeWsRef.current = null; }
    // 2. Detener mic
    if (realtimeStreamRef.current) { realtimeStreamRef.current.getTracks().forEach(t => t.stop()); realtimeStreamRef.current = null; }
    // 3. Desconectar processor
    if (realtimeProcessorRef.current) { try { realtimeProcessorRef.current.disconnect(); } catch(e){} realtimeProcessorRef.current = null; }
    // 4. Cerrar AudioContext (cancela TODO audio pendiente)
    if (realtimeAudioCtxRef.current) { try { realtimeAudioCtxRef.current.close(); } catch(e){} realtimeAudioCtxRef.current = null; }
    // 5. Resetear cola de audio
    nextPlayTimeRef.current = 0;
    // 6. Resetear estados
    setRealtimeConnected(false);
    setVoiceState('idle');
};
```

`goNext`:
```typescript
const goNext = async () => {
    // SIEMPRE cerrar Realtime antes de avanzar
    stopRealtimeAudio();
    // ... resto
};
```

### T5: Cola de audio robusta
**Modificar**: `OnboardingWizard.tsx`

```typescript
const playRealtimeAudio = (arrayBuffer: ArrayBuffer) => {
    // Crear AudioContext si no existe (con sampleRate 24000)
    if (!realtimeAudioCtxRef.current || realtimeAudioCtxRef.current.state === 'closed') {
        realtimeAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0; // Resetear cola con nuevo context
    }
    const ctx = realtimeAudioCtxRef.current;

    // Convertir PCM16 a Float32
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    // Encolar secuencialmente
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    src.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
};
```

---

## FASE 4: FRONTEND — Cards research + Badges

### T6: Cards de research en cascada
**Modificar**: `OnboardingWizard.tsx`

Nuevo state:
```typescript
const [researchCards, setResearchCards] = useState<{tipo: string, titulo: string, valor: string, icono: string}[]>([]);
const [currentCardIndex, setCurrentCardIndex] = useState(0);
const [showingResearch, setShowingResearch] = useState(false);
```

Al entrar paso 3 (despues de consent):
1. Llamar `extractMetaData` → recibe `assets` array
2. Mapear assets a cards: `{tipo: "instagram_profile", titulo: "@ahsports", valor: "2.3K seguidores · Bio: ...", icono: "instagram"}`
3. `setShowingResearch(true)` + `setResearchCards(cards)`
4. Timer: cada 3 seg, `setCurrentCardIndex(prev => prev + 1)`
5. En paralelo: `connectRealtime(step)` que conecta el WS
6. Cuando WS conecta: `setShowingResearch(false)` → cards se reemplazan por "Nova hablando..."

Render:
```tsx
{showingResearch && researchCards[currentCardIndex] && (
    <div className="animate-fade-in glass p-6 rounded-2xl border border-violet-500/20 text-center">
        <Icon /> {/* instagram/facebook/store segun icono */}
        <h3>{researchCards[currentCardIndex].titulo}</h3>
        <p>{researchCards[currentCardIndex].valor}</p>
    </div>
)}
```

### T7: Badges de progreso de secciones
**Modificar**: `OnboardingWizard.tsx`

```typescript
const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});

// Se actualiza cuando llega tool_call de guardar_*
// ws.onmessage handler:
if (msg.type === 'tool_call' && msg.name.startsWith('guardar_')) {
    setSavedSections(prev => ({ ...prev, [msg.name]: true }));
}
```

Render badges:
```tsx
<div className="flex gap-2 flex-wrap">
    {['guardar_identidad', 'guardar_tono', 'guardar_reglas', 'guardar_diccionario'].map(s => (
        <div key={s} className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            savedSections[s] ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-600'
        }`}>
            {savedSections[s] && <Check size={10} />} {s.replace('guardar_', '')}
        </div>
    ))}
</div>
```

---

## FASE 5: FRONTEND — Tool handlers + UI reactiva

### T8: Handler de tool_call en el WS onmessage
**Modificar**: `OnboardingWizard.tsx` — ws.onmessage

```typescript
if (msg.type === 'tool_call') {
    const { name, args, result } = msg;

    if (name.startsWith('guardar_')) {
        setSavedSections(prev => ({ ...prev, [name]: true }));
    }

    if (name === 'cambiar_seccion') {
        setCurrentSection(args.seccion_activa);
        setSectionTitle(args.titulo || '');
        setSectionDesc(args.descripcion || '');
        if (args.botones) setSectionButtons(args.botones);
        if (args.mostrar_resumen_parcial) setShowPartialResume(true);
    }

    if (name === 'mostrar_dato_extraido') {
        // Agregar card dinamica durante la conversacion
        setDynamicCards(prev => [...prev, args]);
    }

    if (name === 'finalizar_configuracion') {
        // Cerrar WS, mostrar resumen
        stopRealtimeAudio();
        setSectionComplete(true);
    }
}
```

### T9: Seccion activa + botones dinamicos
**Modificar**: `OnboardingWizard.tsx`

Nuevos states:
```typescript
const [currentSection, setCurrentSection] = useState('identidad');
const [sectionTitle, setSectionTitle] = useState('');
const [sectionDesc, setSectionDesc] = useState('');
const [sectionButtons, setSectionButtons] = useState<{label: string, accion: string, estilo: string}[]>([]);
```

Render debajo de los badges:
```tsx
{sectionTitle && (
    <div className="glass p-4 rounded-xl border border-white/5 mb-3">
        <h3 className="text-sm font-bold text-white">{sectionTitle}</h3>
        {sectionDesc && <p className="text-xs text-slate-400 mt-1">{sectionDesc}</p>}
        {sectionButtons.length > 0 && (
            <div className="flex gap-2 mt-3">
                {sectionButtons.map((btn, i) => (
                    <button key={i} onClick={() => handleSectionButton(btn.accion)}
                        className={btn.estilo === 'primary' ? 'bg-violet-600 text-white ...' : 'bg-white/5 text-slate-400 ...'}>
                        {btn.label}
                    </button>
                ))}
            </div>
        )}
    </div>
)}
```

### T10: Boton "Ya termine" + "Pausar mic"
**Modificar**: `OnboardingWizard.tsx`

"Ya termine": Cierra WS → genera resumen via texto endpoint → muestra editable
"Pausar mic": Mute el stream sin cerrar WS

```typescript
const pauseMic = () => {
    if (realtimeStreamRef.current) {
        const track = realtimeStreamRef.current.getAudioTracks()[0];
        if (track) track.enabled = !track.enabled;
        setMicPaused(!micPaused);
    }
};

const forceFinish = async () => {
    stopRealtimeAudio();
    // Generar resumen via texto
    const allMessages = chatMessages.map(m => ({role: m.role, content: m.content}));
    const res = await fetchApi('/admin/onboarding/interview-step', {
        method: 'POST',
        body: { session_id: chatSessionId + `_s${step}`, user_message: 'GENERA EL RESUMEN FINAL', step, tenant_id: tenantId || 0, reset: true, chat_history: allMessages }
    });
    if (res?.extracted_draft) { setSectionDraft(res.extracted_draft); setSectionComplete(true); }
};
```

---

## DEPENDENCIAS

```
T1 → T2 (tools definition → handler)
T3 (paralelo, backend only)
T4 → T5 (session guard → audio cleanup)
T6 → T7 (cards → badges)
T8 → T9 → T10 (tool handler → UI reactiva → botones)

T1-T3: backend en paralelo
T4-T10: frontend secuencial
```

---

## VERIFICACION

1. Entrar paso 3 → cards de research aparecen en cascada (3 seg cada una)
2. WS conecta → Nova habla con datos de redes
3. Conversar → Nova llama guardar_identidad → badge verde aparece
4. Nova llama cambiar_seccion → UI cambia titulo + botones
5. Nova llama guardar_tono → otro badge verde
6. Al final → Nova llama finalizar_configuracion → WS se cierra → resumen editable
7. "Ya termine" funciona como fallback
8. "Pausar mic" silencia sin cerrar WS
9. Ruido ambiente NO triggerea respuestas
10. NUNCA dos voces superpuestas
