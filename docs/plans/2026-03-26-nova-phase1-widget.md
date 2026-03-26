# PLAN: Nova Phase 1 — Widget Flotante + Contexto por Página

## Spec: `specs/2026-03-26_nova-platform-assistant.spec.md`
## Alcance: Solo Fase 1 — widget flotante, contexto, checks estáticos, tools básicas

---

## RESUMEN: 3 fases internas, 8 tareas

| Fase | Entregable | Tareas |
|------|-----------|--------|
| **1A** | Backend: contexto endpoint + checks estáticos | T1-T2 |
| **1B** | Frontend: widget flotante + panel slide-in | T3-T5 |
| **1C** | Integración: Realtime voice en widget + tools básicas | T6-T8 |

---

## FASE 1A: BACKEND

### T1: Endpoint de contexto por página
**Crear**: `orchestrator_service/app/routes/nova_routes.py`
**Registrar en**: `orchestrator_service/main.py`

```python
router = APIRouter(prefix="/admin/nova", tags=["nova"])

@router.get("/context")
async def get_nova_context(page: str = "dashboard", current_user = Depends(get_current_user)):
    """Returns Nova's context for the current page.
    Includes static checks (no AI, no tokens) + page-specific data."""
    tenant_id = current_user.tenant_id

    # Static checks (SQL queries, $0 cost)
    checks = []

    # Products
    product_count = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true", tenant_id)
    products_no_photo = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND (images IS NULL OR images = '[]')", tenant_id)
    products_no_stock = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND stock = 0", tenant_id)

    if product_count == 0:
        checks.append({"type": "warning", "message": "No tenes productos cargados. Puedo ayudarte a cargar los primeros ahora mismo.", "action": "cargar_productos"})
    if products_no_photo > 0:
        checks.append({"type": "suggestion", "message": f"Tenes {products_no_photo} productos sin foto. Las fotos aumentan 40% las ventas.", "action": "agregar_fotos"})
    if products_no_stock > 0:
        checks.append({"type": "alert", "message": f"Tenes {products_no_stock} productos sin stock.", "action": "actualizar_stock"})

    # Agent
    agent = await db.pool.fetchrow("SELECT id, system_prompt_template FROM agents WHERE tenant_id = $1 AND is_active = true LIMIT 1", tenant_id)
    if not agent:
        checks.append({"type": "warning", "message": "No tenes un agente configurado. Queres crear uno?", "action": "crear_agente"})
    elif agent and len(agent["system_prompt_template"] or "") < 200:
        checks.append({"type": "suggestion", "message": "Tu system prompt es muy corto. Un prompt mas detallado mejora las respuestas.", "action": "mejorar_prompt"})

    # Channels
    has_meta = await db.pool.fetchval("SELECT COUNT(*) FROM business_assets WHERE tenant_id = $1 AND is_active = true", str(tenant_id))
    has_ycloud = await db.pool.fetchval("SELECT COUNT(*) FROM credentials WHERE tenant_id = $1 AND category = 'whatsapp_cloud'", tenant_id)
    if not has_meta and not has_ycloud:
        checks.append({"type": "warning", "message": "No tenes canales conectados. Sin WhatsApp o Instagram, el agente no puede responder.", "action": "conectar_canales"})

    # Knowledge
    docs_count = await db.pool.fetchval("SELECT COUNT(*) FROM rag_documents WHERE tenant_id = $1 AND status = 'active'", tenant_id)
    if docs_count == 0:
        checks.append({"type": "suggestion", "message": "Tu base de conocimiento esta vacia. Subi documentos para que el agente responda con mas contexto.", "action": "subir_docs"})

    # Plan
    sub = await db.pool.fetchrow("SELECT p.name, s.current_period_end FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.tenant_id = $1 AND s.status = 'active' LIMIT 1", tenant_id)
    if sub and sub["name"] == "free":
        days_left = (sub["current_period_end"] - datetime.utcnow()).days if sub["current_period_end"] else 0
        if days_left <= 3:
            checks.append({"type": "alert", "message": f"Tu prueba gratis vence en {days_left} dias. Suscribite para no perder acceso.", "action": "ver_planes"})

    # Daily summary (from Redis cache, populated by cron)
    daily_summary = await redis_client.get(f"nova_daily:{tenant_id}")

    return {
        "page": page,
        "checks": checks,
        "stats": {
            "products": product_count,
            "products_no_photo": products_no_photo,
            "products_no_stock": products_no_stock,
            "documents": docs_count,
            "has_channels": bool(has_meta or has_ycloud),
            "has_agent": bool(agent),
        },
        "daily_summary": json.loads(daily_summary) if daily_summary else None,
        "greeting": _build_greeting(page, checks)
    }


def _build_greeting(page, checks):
    """Build Nova's first message based on page + checks."""
    if checks:
        top = checks[0]
        return top["message"]
    greetings = {
        "dashboard": "Todo en orden por aca. En que te puedo ayudar?",
        "products": "Aca tenes tu catalogo. Queres agregar o editar algo?",
        "agents": "Este es tu agente. Queres ajustar algo del prompt?",
        "chats": "Estas son tus conversaciones. Alguna que quieras revisar?",
        "analytics": "Aca tenes tus metricas. Queres que te haga un resumen?",
        "knowledge": "Esta es tu base de conocimiento. Queres subir algo?",
        "settings": "Aca podes configurar tus conexiones. Necesitas ayuda?",
    }
    return greetings.get(page, "Hola! En que te puedo ayudar?")
```

**Verificación**: `GET /admin/nova/context?page=dashboard` → JSON con checks + stats + greeting

---

### T2: Endpoint Realtime session para Nova widget
**Modificar**: `orchestrator_service/app/api/onboarding.py`

Agregar endpoint similar a `realtime-session` pero para el widget de Nova:

```python
@router.post("/nova-session")
async def create_nova_session(
    page: str = Body("dashboard", embed=True),
    tenant_id: int = Body(0, embed=True),
    context_summary: str = Body("", embed=True),
):
    """Create OpenAI Realtime session for Nova widget (not onboarding)."""
```

El system prompt de Nova widget incluye:
- Contexto de la página actual
- Checks estáticos como conocimiento previo
- Tools relevantes para la página
- Instrucciones de proactividad

Reutiliza el mismo WS handler del onboarding pero con prompt diferente.

**Verificación**: `POST /admin/onboarding/nova-session` → session_id

---

## FASE 1B: FRONTEND

### T3: Componente NovaWidget (botón flotante + panel)
**Crear**: `frontend_react/src/components/NovaWidget.tsx`

Componente global que se renderiza en Layout:

```typescript
// Estado
const [isOpen, setIsOpen] = useState(false);
const [context, setContext] = useState(null);
const [messages, setMessages] = useState([]);
const [voiceMode, setVoiceMode] = useState(false);

// Al abrir: fetch /admin/nova/context?page=currentPage
// Mostrar greeting + checks como primer mensaje
// Input: texto + botón mic
// Voz: conecta Realtime igual que onboarding
```

UI del botón:
```tsx
<button className="fixed bottom-6 right-6 z-[9998] w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all">
    <Sparkles size={24} />
</button>
```

Panel slide-in (cuando abierto):
```tsx
<div className="fixed bottom-24 right-6 w-80 lg:w-96 h-[500px] z-[9998] glass rounded-2xl border border-violet-500/20 flex flex-col">
    <header>Nova · {pageName}</header>
    <messages area>
    <input + mic button>
</div>
```

### T4: Integrar NovaWidget en Layout
**Modificar**: `frontend_react/src/components/Layout.tsx`

```tsx
import { NovaWidget } from './NovaWidget';

export const Layout = ({ children }) => (
    <div>
        <Sidebar />
        <main>{children}</main>
        <NovaWidget /> {/* Siempre presente */}
    </div>
);
```

No aparece en:
- `/onboarding-wizard` (tiene su propio Nova fullscreen)
- Rutas públicas (login, register, landing)

### T5: Detectar página actual para contexto
**Dentro de**: `NovaWidget.tsx`

```typescript
const location = useLocation();
const currentPage = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.includes('products')) return 'products';
    if (path.includes('agents')) return 'agents';
    if (path.includes('chats')) return 'chats';
    // etc...
    return 'dashboard';
}, [location]);

// Fetch context when page changes or widget opens
useEffect(() => {
    if (isOpen) fetchContext(currentPage);
}, [isOpen, currentPage]);
```

---

## FASE 1C: INTEGRACIÓN REALTIME + TOOLS

### T6: Reutilizar Realtime voice en el widget
**Dentro de**: `NovaWidget.tsx`

Reutilizar la lógica de `connectRealtime` del OnboardingWizard:
- Mismo flujo: mic capture → resample 24kHz → WS → OpenAI Realtime
- Mismo audio playback con queue FIFO
- Mismo barge-in
- System prompt diferente (contextual a la página)

### T7: Tools básicas — navegación + checks
**Modificar**: `orchestrator_service/main.py` o nuevo WS handler

Tools de Fase 1:
```python
nova_widget_tools = [
    {"name": "ir_a_pagina", "description": "Navegar a otra pagina", "parameters": {"page": "string"}},
    {"name": "ver_conexiones", "description": "Estado de canales conectados"},
    {"name": "ver_plan", "description": "Plan actual y dias restantes"},
    {"name": "ver_productos", "description": "Resumen del catalogo"},
    {"name": "ver_errores_agente", "description": "Ultimas derivaciones y errores"},
    {"name": "mostrar_tutorial", "description": "Mini-tutorial de la feature actual"},
]
```

Handler: cada tool hace una query SQL simple y devuelve resultado a Nova.

Frontend: `ir_a_pagina` navega con `react-router`. `mostrar_tutorial` muestra un modal.

### T8: Greeting proactivo con checks
**Dentro de**: `NovaWidget.tsx`

Al abrir el widget:
1. Fetch `/admin/nova/context?page={currentPage}`
2. Mostrar greeting como primer mensaje (burbuja de Nova)
3. Si hay checks, mostrar como cards clicables:
   - "⚠️ No tenes productos cargados" → [Cargar ahora]
   - "💡 3 productos sin foto" → [Agregar fotos]
   - "🔴 Trial vence en 2 días" → [Ver planes]

Estas cards son botones que ejecutan la acción correspondiente.

---

## DEPENDENCIAS

```
T1 (backend context) → T2 (realtime session)
T3 (widget component) → T4 (layout integration) → T5 (page detection)
T6 (voice) depende de T3 + T2
T7 (tools) depende de T6
T8 (greeting) depende de T1 + T3
```

**Paralelizables**: T1-T2 (backend) en paralelo con T3-T5 (frontend).

---

## VERIFICACIÓN END-TO-END

1. Abrir cualquier página → botón de Nova visible (bottom-right)
2. Tocar botón → panel slide-in con greeting contextual
3. Greeting dice algo relevante basado en checks estáticos
4. Escribir "que puedo hacer?" → Nova lista las opciones
5. Tocar mic → voz Realtime funciona
6. Decir "llevame a productos" → navega a /products
7. Cerrar y abrir en otra página → greeting cambia
8. Checks: si no hay productos, lo dice. Si hay productos sin foto, lo dice.

---

## ESTIMACIÓN

| Tarea | Complejidad | Archivos |
|-------|------------|----------|
| T1 | Media | 2 (nova_routes.py + main.py) |
| T2 | Baja | 1 (onboarding.py o nova_routes.py) |
| T3 | **Alta** | 1 (NovaWidget.tsx ~400 líneas) |
| T4 | Baja | 1 (Layout.tsx) |
| T5 | Baja | Inline en T3 |
| T6 | Media | Inline en T3 (reutiliza lógica existente) |
| T7 | Media | 1 (main.py o nova WS handler) |
| T8 | Baja | Inline en T3 |
