# PLAN: Nova Phase 4 + Phase 5 — Proactividad + Análisis de Conversaciones

## Spec: `specs/2026-03-26_nova-platform-assistant.spec.md`

---

## RESUMEN: 2 fases, 10 tareas

| Fase | Entregable | Tareas | Costo |
|------|-----------|--------|-------|
| **Phase 4** | Checks estáticos + sugerencias contextuales + notificaciones | P4-T1 a P4-T5 | $0 (SQL) |
| **Phase 5** | Cron diario + análisis de conversaciones + mejoras al prompt | P5-T1 a P5-T5 | ~$0.05/tenant/día |

---

## PHASE 4: PROACTIVIDAD INTELIGENTE (sin IA, $0)

### P4-T1: Endpoint de health-check del negocio
**Crear en**: `orchestrator_service/app/routes/nova_routes.py`

`GET /admin/nova/health-check` — análisis completo del estado del negocio del tenant.

Checks (todos SQL, sin IA):

| Check | Query | Severidad |
|-------|-------|-----------|
| Productos sin foto | `WHERE images IS NULL OR images = '[]'` | suggestion |
| Productos sin stock | `WHERE stock = 0` | alert |
| Sin productos | `COUNT(*) = 0` (internal + TN check) | warning |
| Prompt muy corto | `LENGTH(system_prompt) < 500` | suggestion |
| Sin sección de envíos | `prompt NOT LIKE '%envio%'` | suggestion |
| Sin sección de cambios | `prompt NOT LIKE '%cambio%devoluc%'` | suggestion |
| Sin diccionario | `prompt NOT LIKE '%diccionario%sinonimo%'` | suggestion |
| Canales no conectados | `COUNT(business_assets) = 0 AND no ycloud` | warning |
| Knowledge vacío | `COUNT(rag_documents) = 0` | suggestion |
| Trial expirando | `days_left <= 3` | alert |
| Muchas derivaciones | `COUNT(derivaciones_hoy) > 5` | alert |
| Sin conversaciones (7 días) | `MAX(chat_messages.created_at) < NOW() - 7 days` | info |
| Agente inactivo | `agents.is_active = false` | warning |

Retorna:
```json
{
    "score": 72,  // Health score 0-100
    "checks": [...],
    "top_priority": "No tenes canales conectados",
    "completed": ["Agente configurado", "Prompt completo"],
    "suggestions_count": 5
}
```

---

### P4-T2: Score de completitud del negocio
**Dentro de**: `/admin/nova/health-check`

Calcular un score 0-100 basado en pesos:

| Item | Peso | Criterio |
|------|------|----------|
| Tiene agente activo | 15 | agents.is_active = true |
| Prompt > 1000 chars | 10 | LENGTH(prompt) > 1000 |
| Prompt tiene reglas | 5 | prompt LIKE '%REGLAS%' |
| Prompt tiene diccionario | 5 | prompt LIKE '%DICCIONARIO%' |
| Tiene canales conectados | 15 | meta OR ycloud |
| Tiene productos (TN o interno) | 15 | COUNT > 0 |
| Productos con fotos | 5 | % con fotos > 80% |
| Knowledge con docs | 10 | COUNT > 0 |
| Conversaciones recientes | 10 | últimos 7 días |
| Sin derivaciones excesivas | 10 | < 5/día promedio |

Score = suma de pesos cumplidos.

---

### P4-T3: Widget muestra health score + checks como cards
**Modificar**: `frontend_react/src/components/NovaWidget.tsx`

Al abrir Nova en el Dashboard:
```
┌──────────────────────────┐
│ Nova · Dashboard         │
│                          │
│ Tu negocio: 72/100 ████░ │
│                          │
│ 🔴 Sin canales conectados│
│    [Conectar ahora →]    │
│                          │
│ 💡 3 productos sin foto  │
│    [Agregar fotos →]     │
│                          │
│ ✅ Agente configurado    │
│ ✅ Prompt completo       │
│                          │
│ [💬 Preguntale a Nova]   │
└──────────────────────────┘
```

---

### P4-T4: Notificaciones push (toast al entrar)
**Modificar**: `NovaWidget.tsx`

Cuando el usuario entra a la plataforma, si hay checks críticos (type=alert):
- Mostrar toast en bottom-left por 8 segundos
- "Nova: Tenes 2 productos sin stock. Queres actualizarlo?"
- Solo 1 toast por sesión (guardar en sessionStorage)

---

### P4-T5: Nova greeting usa health-check data
**Modificar**: `NovaWidget.tsx` + `nova_routes.py`

En vez de solo el `/context` endpoint, también llamar `/health-check` y usar el `top_priority` como greeting de Nova:

```
// Si score < 50: "Tu negocio necesita atención. Lo más urgente: {top_priority}"
// Si score 50-80: "Vas bien! Pero podés mejorar: {top_suggestion}"
// Si score > 80: "Tu negocio está al día. En qué te ayudo?"
```

---

## PHASE 5: ANÁLISIS DE CONVERSACIONES (~$0.05/tenant/día)

### P5-T1: Cron job diario — análisis de conversaciones
**Crear**: `orchestrator_service/app/services/nova_daily_analysis.py`
**Registrar**: `orchestrator_service/main.py` (background task al startup)

Cron que corre 1 vez al día (o cada 12 horas):

```python
async def run_daily_analysis():
    """Analiza conversaciones de las últimas 24h por tenant."""
    tenants = await db.pool.fetch("SELECT DISTINCT tenant_id FROM chat_conversations WHERE updated_at >= NOW() - INTERVAL '24 hours'")

    for tenant in tenants:
        tid = tenant["tenant_id"]

        # 1. Fetch últimas 50 conversaciones (solo resumen)
        conversations = await db.pool.fetch("""
            SELECT cm.content, cm.role, cc.channel
            FROM chat_messages cm
            JOIN chat_conversations cc ON cc.id = cm.conversation_id
            WHERE cm.tenant_id = $1 AND cm.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY cm.created_at DESC LIMIT 100
        """, tid)

        if not conversations:
            continue

        # 2. Construir resumen compacto (para minimizar tokens)
        summary_input = "\n".join([
            f"{'USER' if c['role'] == 'user' else 'AGENT'}: {c['content'][:80]}"
            for c in conversations[:50]
        ])

        # 3. Analizar con GPT-4o-mini (barato)
        analysis = await analyze_with_gpt(summary_input, tid)

        # 4. Guardar en Redis (TTL 48h)
        await redis_client.setex(
            f"nova_daily:{tid}",
            172800,  # 48 horas
            json.dumps(analysis)
        )
```

---

### P5-T2: Análisis con GPT-4o-mini
**Dentro de**: `nova_daily_analysis.py`

```python
async def analyze_with_gpt(conversation_summary: str, tenant_id: int):
    """Analiza conversaciones y retorna insights."""
    api_key = os.getenv("OPENAI_API_KEY")
    client = openai.AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",  # Barato: ~$0.01 por análisis
        messages=[
            {"role": "system", "content": """Analiza estas conversaciones de un agente de ventas.
Retorna un JSON con:
- temas_frecuentes: [lista de 3-5 temas más consultados]
- problemas: [lista de situaciones donde el agente respondió mal o derivó innecesariamente]
- temas_sin_cobertura: [temas que los clientes preguntaron y el agente no supo responder]
- sugerencias: [lista de 2-3 mejoras concretas para el prompt del agente]
- satisfaccion_estimada: numero 1-10
- resumen: string de 2-3 oraciones resumen
Solo JSON, sin explicaciones."""},
            {"role": "user", "content": conversation_summary}
        ],
        temperature=0,
        max_tokens=500,
        response_format={"type": "json_object"}
    )

    try:
        return json.loads(response.choices[0].message.content)
    except:
        return {"resumen": "No se pudo analizar", "sugerencias": []}
```

Costo: GPT-4o-mini con ~2000 tokens input + 500 output ≈ **$0.003 por tenant por día**.
A 1000 tenants activos: $3/día = $90/mes.

---

### P5-T3: Endpoint para leer el análisis diario
**Agregar en**: `nova_routes.py`

`GET /admin/nova/daily-analysis`
- Lee `nova_daily:{tenant_id}` de Redis
- Si no hay → retorna `{"available": false}`
- Si hay → retorna el JSON del análisis

---

### P5-T4: NovaWidget muestra insights del día
**Modificar**: `NovaWidget.tsx`

En la página de Dashboard o Chats, si hay daily_analysis disponible:

```
┌──────────────────────────┐
│ Resumen del día          │
│                          │
│ 23 conversaciones        │
│ Satisfacción: 8/10       │
│                          │
│ Temas frecuentes:        │
│ • Envíos (12 consultas)  │
│ • Precios (8)            │
│ • Talles (5)             │
│                          │
│ ⚠️ Problemas detectados: │
│ "3 clientes preguntaron  │
│  por envío a Catamarca y │
│  el agente no supo"      │
│                          │
│ 💡 Sugerencia:           │
│ "Agregar regla de envío  │
│  a provincias del norte" │
│ [Aplicar sugerencia →]   │
└──────────────────────────┘
```

El botón "Aplicar sugerencia" ejecuta `agregar_regla` automáticamente.

---

### P5-T5: Auto-aplicar sugerencias con confirmación
**Modificar**: `NovaWidget.tsx`

Cuando el usuario toca "Aplicar sugerencia":
1. Mostrar preview de lo que se va a agregar al prompt
2. Botón "Confirmar" → llama `modificar_prompt` o `agregar_regla` via API
3. Mostrar "Regla agregada ✓"

Esto cierra el loop: datos → análisis → sugerencia → acción → mejora.

---

## DEPENDENCIAS

```
Phase 4:
P4-T1 → P4-T2 (health check → score)
P4-T3 (widget UI, después de T1)
P4-T4 (toast, después de T3)
P4-T5 (greeting, después de T1)

Phase 5:
P5-T1 → P5-T2 (cron → GPT analysis)
P5-T3 (endpoint, después de T1)
P5-T4 (widget UI, después de T3)
P5-T5 (auto-apply, después de T4 + Phase 3 tools)

Ambas fases pueden ir en paralelo.
```

---

## VERIFICACIÓN

### Phase 4
1. `GET /admin/nova/health-check` → score + checks
2. Abrir Nova en Dashboard → muestra score + cards de checks
3. Toast al entrar si hay alert
4. Tocar card → navega a la página correcta
5. Score sube cuando se resuelven checks

### Phase 5
1. Cron ejecuta → Redis tiene `nova_daily:{tid}`
2. `GET /admin/nova/daily-analysis` → temas + problemas + sugerencias
3. Nova widget muestra "Resumen del día"
4. "Aplicar sugerencia" → preview → confirmar → prompt actualizado
5. Score del health-check sube después de aplicar

---

## COSTOS

| Concepto | Costo | Frecuencia |
|----------|-------|-----------|
| Health check (SQL) | $0 | Cada vez que se abre Nova |
| Score calculation | $0 | Con health check |
| Toast notification | $0 | 1 por sesión |
| Daily analysis (GPT-4o-mini) | ~$0.003/tenant | 1 vez/día |
| **Total por tenant/mes** | **~$0.09** | |
| **1000 tenants/mes** | **~$90** | |

---

## ESTIMACIÓN

| Tarea | Complejidad | Archivos |
|-------|------------|----------|
| P4-T1 | Media | nova_routes.py |
| P4-T2 | Baja | Inline en T1 |
| P4-T3 | Media | NovaWidget.tsx |
| P4-T4 | Baja | NovaWidget.tsx |
| P4-T5 | Baja | NovaWidget.tsx + nova_routes.py |
| P5-T1 | Media | nova_daily_analysis.py + main.py |
| P5-T2 | Baja | Inline en T1 |
| P5-T3 | Baja | nova_routes.py |
| P5-T4 | Media | NovaWidget.tsx |
| P5-T5 | Baja | NovaWidget.tsx |
