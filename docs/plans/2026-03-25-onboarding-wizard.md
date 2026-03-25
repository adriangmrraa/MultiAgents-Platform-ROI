# PLAN TECNICO: Onboarding Wizard — Experiencia de Bienvenida

## Fecha: 2026-03-25
## Spec: `specs/2026-03-25_onboarding-wizard.spec.md`

---

## NOTA ARQUITECTONICA

Sigue patrones reales del proyecto: schemas inline en routes, `db.pool.fetch*`, `useApi` hook, dark theme glass UI. Reutiliza infraestructura existente: `/admin/onboarding/interview`, Meta OAuth flow, Tienda Nube connection, billing checkout.

---

## ANALISIS DE IMPACTO

### Base de Datos
- [x] Tabla nueva: `onboarding_progress` (progreso persistente del wizard)
- [ ] No requiere vectores/RAG

### Credenciales
- [ ] No requiere nuevas categorias — usa la OPENAI_API_KEY global de la plataforma
- [x] Reutiliza Meta OAuth existente y Tienda Nube token existente

### Servicios Afectados
- [x] `orchestrator_service`: Nuevos endpoints de progreso + interview-step + complete
- [x] `frontend_react`: Nueva pagina OnboardingWizard.tsx + redirect logic en App.tsx
- [ ] `meta_service`: No se modifica — se reutiliza el OAuth popup existente
- [ ] `whatsapp_service`: No afectado

### Multi-Tenancy
- [x] Tenant se crea en paso 0 del wizard
- [x] Progreso scoped por user_id (UNIQUE index)
- [x] Todas las queries filtran por user_id/tenant_id

---

## RESUMEN EJECUTIVO

5 fases, 18 tareas atomicas.

| Fase | Entregable | Tareas |
|------|-----------|--------|
| **Fase 1** | Backend: tabla + endpoints progreso + interview-step | T1–T5 |
| **Fase 2** | Frontend: wizard shell + stepper + redirect logic | T6–T8 |
| **Fase 3** | Pasos 0-1-2: Bienvenida + Tienda Nube + Meta | T9–T11 |
| **Fase 4** | Pasos 3-4-5: Chat conversacional + audio + checklist | T12–T14 |
| **Fase 5** | Pasos 6-7: Revision + Pricing + notificaciones | T15–T18 |

---

## FASE 1: BACKEND

### T1: Modelo SQLAlchemy + Migration SQL
**Crear**: `orchestrator_service/app/models/onboarding.py`
**Modificar**: `orchestrator_service/app/models/__init__.py`, `orchestrator_service/main.py` (migration_steps)

```python
class OnboardingProgress(Base, TimestampMixin):
    __tablename__ = "onboarding_progress"
    id: int (PK)
    user_id: UUID (FK users.id, UNIQUE)
    tenant_id: int (FK tenants.id, nullable — se llena en paso 0)
    current_step: int (default 0)
    step_data: JSONB (default '{}')
    system_prompt_draft: Text (default '')
    completed_at: TIMESTAMPTZ (nullable)
```

Migration step en main.py:
```sql
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id),
    current_step INTEGER DEFAULT 0,
    step_data JSONB DEFAULT '{}',
    system_prompt_draft TEXT DEFAULT '',
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_progress(user_id);
```

**Verificacion**: Tabla se crea en startup.

---

### T2: Endpoints CRUD de progreso
**Crear**: `orchestrator_service/app/routes/onboarding_wizard_routes.py`
**Modificar**: `orchestrator_service/main.py` (include_router)

Router: `APIRouter(prefix="/admin/onboarding-wizard", tags=["onboarding-wizard"])`

Endpoints:
1. `GET /admin/onboarding-wizard/progress` — Retorna progreso del user. Si no existe, crea uno con step=0
2. `PUT /admin/onboarding-wizard/progress` — Actualiza step + step_data. Valida secuencia (no saltar pasos)
3. `POST /admin/onboarding-wizard/create-tenant` — Crea tenant minimo en paso 0. Body: `{ store_name_provisional }`

Patron: igual que `voice_widget_routes.py` — `get_current_user`, `db.pool.fetch*`

**Verificacion**: `curl GET /admin/onboarding-wizard/progress` → `{ current_step: 0, step_data: {} }`

---

### T3: Endpoint interview-step (chat por seccion)
**Modificar**: `orchestrator_service/app/api/onboarding.py`

Nuevo endpoint `POST /admin/onboarding/interview-step`:
```python
@router.post("/interview-step")
async def onboarding_interview_step(
    session_id: str,
    user_message: str,
    step: int,  # 3=tono, 4=reglas, 5=diccionario
    tenant_id: int
):
    # Usa prompt diferente segun step
    prompts = {
        3: ONBOARDING_TONE_PROMPT,      # Focalizado en tono/personalidad
        4: ONBOARDING_RULES_PROMPT,     # Focalizado en reglas de negocio
        5: ONBOARDING_DICTIONARY_PROMPT # Focalizado en sinonimos
    }
    # Misma mecanica que /interview pero con prompt scoped
    # Retorna: { ai_message, section_complete, extracted_draft }
```

**Prompts nuevos** (agregar a `app/core/prompts.py`):
- `ONBOARDING_TONE_PROMPT`: Extrae tono, personalidad, pronombres. Checklist interno. Adaptativo al tipo de negocio.
- `ONBOARDING_RULES_PROMPT`: Extrae reglas operativas. Checklist: envios, cambios, horarios, pagos, prohibiciones.
- `ONBOARDING_DICTIONARY_PROMPT`: Extrae sinonimos y jerga. Checklist: categorias, jerga, abreviaciones.

Cada prompt incluye instruccion: "Cuando tengas toda la info del checklist, emite `<SECTION_COMPLETE>` seguido del JSON de la seccion."

**Verificacion**: Enviar mensaje al step 3 → respuesta adaptada a tono. Enviar al step 4 → respuesta sobre reglas.

---

### T4: Endpoint complete (crear agente + activar)
**Modificar**: `orchestrator_service/app/routes/onboarding_wizard_routes.py`

`POST /admin/onboarding-wizard/complete`:
1. Lee `onboarding_progress` del user
2. Ensambla `system_prompt_draft` completo (tono + reglas + diccionario)
3. Crea agente via patron existente (`INSERT INTO agents`)
4. Marca `onboarding_progress.completed_at = NOW()`
5. Retorna `{ agent_id, status: "active" }`

Reutiliza logica de `onboarding_generate` existente pero con el prompt acumulado del wizard.

**Verificacion**: POST complete → agente creado con system_prompt completo.

---

### T5: Endpoint test-agent (paso 6 preview)
**Agregar en**: `orchestrator_service/app/routes/onboarding_wizard_routes.py`

`POST /admin/onboarding-wizard/test-agent`:
- Body: `{ message: string, system_prompt: string }`
- Usa OPENAI_API_KEY global (key de la plataforma)
- Envia el mensaje con el system_prompt_draft como system prompt
- Retorna: `{ response: string }`
- Sin tools, sin contexto — solo prueba el prompt puro

**Verificacion**: Enviar "Hola, tienen zapatillas?" → respuesta con el tono configurado.

---

## FASE 2: FRONTEND SHELL

### T6: OnboardingWizard.tsx — estructura shell
**Crear**: `frontend_react/src/views/OnboardingWizard.tsx`

Componente principal fullscreen:
```
OnboardingWizard.tsx (~800 lineas estimadas)
├── StepBar (barra de progreso: 8 circulos 0-7)
├── StepContent (renderiza el paso actual)
│   ├── Step0Welcome
│   ├── Step1TiendaNube
│   ├── Step2Meta
│   ├── Step3Tone (chat + audio)
│   ├── Step4Rules (chat + audio)
│   ├── Step5Dictionary (chat + audio)
│   ├── Step6Review
│   └── Step7Pricing
├── NotificationToast (tips contextuales)
└── No sidebar, no header — fullscreen immersive
```

State principal:
```typescript
interface WizardState {
    currentStep: number;
    stepData: Record<string, any>;
    systemPromptDraft: string;
    tenantId: number | null;
    isLoading: boolean;
}
```

Layout: `fixed inset-0 z-[9999] bg-[#09090b]` — cubre todo.

**Verificacion**: Componente renderiza con step bar y paso 0.

---

### T7: Redirect logic en App.tsx
**Modificar**: `frontend_react/src/App.tsx`

En `RequireAuth`, agregar check de onboarding:
```typescript
// Despues de verificar isAuthenticated
// Fetch GET /admin/onboarding-wizard/progress
// Si current_step < 7 AND completed_at == null AND user no es super_admin
//   AND user tiene agents.length == 0 (usuario nuevo)
// → Redirect a /onboarding-wizard
```

Agregar ruta:
```tsx
<Route path="/onboarding-wizard" element={<OnboardingWizard />} />
```

Reemplazar ruta `/magic`:
```tsx
// Antes: <Route path="/magic" element={<MagicOnboarding />} />
// Ahora: <Route path="/magic" element={<Navigate to="/onboarding-wizard" replace />} />
```

**Verificacion**: Usuario nuevo post-registro → redirige a /onboarding-wizard. Super admin → dashboard directo.

---

### T8: Sidebar — actualizar NavItem
**Modificar**: `frontend_react/src/components/Sidebar.tsx`

Cambiar:
```tsx
// Antes:
<NavItem to="/magic" icon={<Sparkles size={20} />} label="Magic" desc="Hacer Magia" />
// Ahora:
<NavItem to="/onboarding-wizard" icon={<Sparkles size={20} />} label="Wizard" desc="Configuracion Guiada" />
```

**Verificacion**: Sidebar muestra "Wizard" en vez de "Magic".

---

## FASE 3: PASOS 0-1-2 (Conexiones)

### T9: Paso 0 — Bienvenida + Crear Tenant
**Dentro de**: `OnboardingWizard.tsx`

- Pantalla con animacion (nombre del usuario, texto de bienvenida)
- Al montar: `POST /admin/onboarding-wizard/create-tenant` → crea tenant provisional
- Auto-avanza en 5 seg o clic
- Guarda `tenantId` en state

CSS: gradient de fondo, texto grande centrado, animacion fade-in-up.

**Verificacion**: Se crea tenant en DB. Auto-avanza a paso 1.

---

### T10: Paso 1 — Conectar Tienda Nube (obligatorio)
**Dentro de**: `OnboardingWizard.tsx`

- 2 inputs: Store ID + Access Token
- Boton "Conectar Tienda" → valida contra API TN
- Exito: muestra nombre tienda + productos
- "Necesito ayuda" → expande instrucciones + boton "Copiar mensaje para tu dev"
- "No uso Tienda Nube" (link pequeño) → panel con funciones limitadas vs disponibles
- Al conectar: `PUT /admin/onboarding-wizard/progress` con step_data.step_1

Backend de validacion: reutiliza la logica existente de `admin_routes.py` para conectar tienda (verificar token contra `https://api.tiendanube.com/v1/{store_id}/store`).

**Verificacion**: Token valido → muestra nombre de tienda → boton "Siguiente" habilitado.

---

### T11: Paso 2 — Conectar Meta OAuth
**Dentro de**: `OnboardingWizard.tsx`

- Boton "Conectar con Meta" → abre popup OAuth (reutilizar logica de `MetaSettings.tsx` lineas 60-104)
- Post-OAuth: muestra paginas/numeros conectados con checks
- "Configurar despues" → permite avanzar con advertencia
- Al completar: `PUT progress` con step_data.step_2

**Verificacion**: OAuth popup funciona. Paginas aparecen al volver.

---

## FASE 4: PASOS 3-4-5 (Chat Conversacional + Audio)

### T12: Componente ChatStep reutilizable
**Crear**: Componente inline en `OnboardingWizard.tsx` o extraer a `components/WizardChatStep.tsx`

Props:
```typescript
interface ChatStepProps {
    step: 3 | 4 | 5;
    title: string;
    tenantId: number;
    onComplete: (draft: string) => void;
}
```

Features:
- Chat dark theme (burbujas: usuario violeta, agente glass)
- Input de texto + boton enviar
- Boton microfono (toggle on/off)
  - Usa `webkitSpeechRecognition` / `SpeechRecognition` del browser
  - Corte automatico por 15 seg silencio
  - Indicador visual "Escuchando..." con animacion pulse
  - Multitarea: puede scrollear mientras graba
  - Fallback: si browser no soporta → boton no aparece
- Llama a `POST /admin/onboarding/interview-step` con `step` param
- Detecta `section_complete` en respuesta → muestra resumen editable
- Boton "Listo" manual para cortar la conversacion
- Al confirmar resumen: llama onComplete(draft)

**Verificacion**: Chat funciona. Audio graba y transcribe. Resumen aparece al completar.

---

### T13: Paso 3 — Identidad (usa ChatStep)
**Dentro de**: `OnboardingWizard.tsx`

```tsx
<ChatStep
    step={3}
    title="Identidad de tu Negocio"
    tenantId={tenantId}
    onComplete={(draft) => {
        updateProgress(3, { tone_draft: draft });
        setSystemPromptDraft(prev => prev + '\n' + draft);
    }}
/>
```

Notificacion contextual: "Los agentes con personalidad definida tienen 40% mas engagement"

**Verificacion**: Conversacion sobre tono → resumen editable → confirmar → avanza a paso 4.

---

### T14: Pasos 4 y 5 — Reglas + Diccionario (usa ChatStep)
**Dentro de**: `OnboardingWizard.tsx`

Mismo patron que T13 pero con step=4 y step=5.
- Paso 4: notificacion "Las reglas claras reducen 60% las consultas repetitivas"
- Paso 5: notificacion "Con el diccionario, tu agente entiende jerga local"

**Verificacion**: Cada paso genera su seccion del prompt. El system_prompt_draft se va acumulando.

---

## FASE 5: PASOS 6-7 + NOTIFICACIONES

### T15: Paso 6 — Revision + Test del Agente
**Dentro de**: `OnboardingWizard.tsx`

- Cards resumen: Tienda (nombre/productos), Canales (Meta), Tono, Reglas, Diccionario
- Cada card con boton "Editar" → vuelve al paso correspondiente
- System prompt expandible en textarea editable
- **Probar Agente**: input + boton → `POST /admin/onboarding-wizard/test-agent`
  - Muestra la respuesta del agente en burbuja de chat
  - El usuario ve como "suena" su agente
- **Activar Agente**: `POST /admin/onboarding-wizard/complete`

**Verificacion**: Resumen muestra todo. Test responde con tono correcto. Activar crea agente.

---

### T16: Paso 7 — Pricing + Free Trial
**Dentro de**: `OnboardingWizard.tsx`

- Animacion "Tu agente esta listo!" (CSS confetti o particulas simple)
- 3 pricing cards (patron de `Pricing.tsx` existente):
  - Pro $49 (badge "Popular")
  - Enterprise $199 (badge "Todo incluido")
  - Free Trial (10 dias, 50 msgs)
- Toggle mensual/anual (-20%)
- Comparativa features
- CTAs:
  - Pro/Enterprise → `POST /billing/checkout` → redirect Stripe/MP
  - Free Trial → `POST /billing/start-trial` (o logica existente)
- Al completar cualquiera → `onboarding_progress.completed_at = NOW()` → redirect `/` con toast

**Verificacion**: Cada opcion funciona. Wizard se cierra. Dashboard aparece.

---

### T17: Sistema de Notificaciones Contextuales
**Dentro de**: `OnboardingWizard.tsx`

Componente `WizardNotification`:
- Pool de mensajes por paso (5-8 cada uno)
- Timer: cada 30 seg muestra un toast lateral (bottom-left para no interferir con el boton principal)
- Animacion: slide-in desde la izquierda, auto-dismiss en 8 seg
- Boton X para descartar inmediatamente
- No bloquea — puramente informativo/educativo

Mensajes ejemplo por paso:
```typescript
const TIPS = {
    0: ["Future potencia tu tienda con IA de ultima generacion"],
    1: ["Tu agente podra buscar productos y crear ordenes automaticamente"],
    2: ["Con Meta conectado, atendes WhatsApp, Instagram y Facebook al mismo tiempo"],
    3: ["Los agentes con personalidad definida tienen 40% mas engagement"],
    4: ["Las reglas claras reducen 60% las consultas repetitivas"],
    5: ["Con el diccionario, tu agente entiende 'remera', 'playera' o 'franela'"],
    6: ["Prueba tu agente antes de activarlo — asegurate de que suene perfecto"],
    7: ["Los comercios con IA venden 3x mas en los primeros 30 dias"]
};
```

**Verificacion**: Toasts aparecen cada ~30 seg. Se descartan con X. Rotan mensajes.

---

### T18: Prompts de seccion (Pointe Coach adaptativo)
**Modificar**: `orchestrator_service/app/core/prompts.py`

Agregar 3 prompts nuevos:

```python
ONBOARDING_TONE_PROMPT = """
Eres el Arquitecto de Tono para el agente de IA del usuario.
Tu CHECKLIST interno (no se lo muestres al usuario):
- [ ] Nombre del negocio y que vende
- [ ] Que lo hace especial/diferente
- [ ] Pronombres (vos/tu/usted)
- [ ] Nivel de formalidad (casual/profesional/barrio)
- [ ] Emojis si/no y cuales
- [ ] Frases prohibidas
- [ ] Muletillas o frases puente del sector

ADAPTACION: Si el usuario dice que vende ropa, pregunta sobre estilo, temporadas.
Si vende comida, pregunta sobre tipo de cocina, delivery.
Adapta tus preguntas al sector.

Cuando tengas TODOS los items del checklist, emite:
<SECTION_COMPLETE>{"tone": "...texto del tono generado..."}</SECTION_COMPLETE>
"""

ONBOARDING_RULES_PROMPT = """..."""  # Similar con checklist de reglas
ONBOARDING_DICTIONARY_PROMPT = """..."""  # Similar con checklist de sinonimos
```

**Verificacion**: Cada prompt genera preguntas relevantes y detecta cuando tiene toda la info.

---

## DEPENDENCIAS ENTRE TAREAS

```
T1 ─→ T2 ─→ T3
         ─→ T4
         ─→ T5

T6 ─→ T7 ─→ T8

T9  (despues de T2 + T6)
T10 (despues de T9)
T11 (despues de T10)

T12 (despues de T3 + T6)
T13 (despues de T12)
T14 (despues de T13)

T15 (despues de T4 + T5 + T14)
T16 (despues de T15)
T17 (paralelo con T9+)
T18 (paralelo con T1+, es solo prompts.py)
```

**Paralelizables**: T1-T5 (backend) en paralelo con T6-T8 (frontend shell). T18 (prompts) en paralelo con todo.

---

## CROSS-CHECK: Criterios de Aceptacion vs Tareas

| Criterio | Tarea |
|----------|-------|
| Wizard obligatorio para nuevos | T7 (redirect logic) |
| No navegar hasta paso 7 | T6, T7 (fullscreen, no sidebar) |
| 7 pasos secuenciales | T2 (backend valida), T6 (frontend enforces) |
| Progreso persiste en DB | T1, T2 |
| Paso 1: Tienda Nube obligatoria | T10 |
| Paso 2: Meta OAuth popup | T11 |
| Pasos 3-4-5: Chat conversacional | T12, T13, T14 |
| Audio STT browser | T12 |
| Paso 6: Preview con test real | T5, T15 |
| Paso 7: Pricing + Free Trial | T16 |
| Super admin no ve wizard | T7 |
| OnboardingChat 5 sesiones (separado) | Ya existe, no se modifica |
| Mobile responsive fullscreen | T6 |
| Reemplaza MagicOnboarding | T7, T8 |
| API key de la plataforma | T3, T5 (usa os.getenv) |
| Animaciones suaves | T6 |
| Tenant se crea en paso 0 | T2, T9 |
| Tienda Nube con "Copiar mensaje dev" | T10 |
| Notificaciones contextuales | T17 |
| Audio 15 seg silencio + multitarea | T12 |
| Checklist Pointe Coach adaptativo | T18 |
| Usuarios existentes NO ven wizard | T7 |

---

## ESTIMACION DE COMPLEJIDAD

| Tarea | Complejidad | Archivos |
|-------|------------|----------|
| T1 | Baja | 3 (model + __init__ + main.py) |
| T2 | Media | 2 (routes + main.py) |
| T3 | Media | 1 (onboarding.py) |
| T4 | Media | 1 (routes) |
| T5 | Baja | 1 (routes) |
| T6 | **Alta** | 1 (OnboardingWizard.tsx ~800 lineas) |
| T7 | Media | 1 (App.tsx) |
| T8 | Baja | 1 (Sidebar.tsx) |
| T9 | Baja | Inline en T6 |
| T10 | Media | Inline en T6 |
| T11 | Media | Inline en T6 (reutiliza OAuth) |
| T12 | **Alta** | 1 (ChatStep component + STT) |
| T13 | Baja | Inline en T6 |
| T14 | Baja | Inline en T6 |
| T15 | Media | Inline en T6 |
| T16 | Media | Inline en T6 (reutiliza Pricing pattern) |
| T17 | Baja | Inline en T6 |
| T18 | Media | 1 (prompts.py) |
