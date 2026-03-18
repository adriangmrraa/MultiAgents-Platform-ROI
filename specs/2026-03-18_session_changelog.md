# SPEC: Session Changelog — 2026-03-18
## Alcance: Merge audit branch + SaaS Billing + Creative Studio + Meta Integration + Google OAuth

---

## RESUMEN EJECUTIVO

Sesion de estabilizacion masiva que implemento 5 sistemas nuevos y corrigio 20+ bugs criticos. 30 commits en master.

---

## 1. MERGE & DB LAYER FIX

### Merge: `claude/audit-fix-all-pages-Anwym` → `master`
- 2 commits: SaaS billing system + Creative Studio (Pomelli-style)
- 20 archivos nuevos, 5,034 lineas agregadas

### Bug Critico: AsyncSession vs AsyncPG Pool
- `billing_routes.py`, `gallery_routes.py`, `platform_routes.py` usaban metodos asyncpg (`.fetch()`, `.fetchrow()`) sobre SQLAlchemy `AsyncSession`
- **Fix**: Creado `get_pool_db()` dependency en `db.py`, migrado las 3 rutas
- Corregido `.get()` en asyncpg Records (no soportado)
- `auth_routes.py` `/me` endpoint: faltaba parametro `db`

---

## 2. SAAS BILLING SYSTEM

### Subscription Guard Middleware
- Bloquea API cuando trial expirado, suscripcion cancelada/suspendida
- Respuestas 402 incluyen headers CORS (solucion al CORS cascade error)
- Preflight OPTIONS pasan directo
- Rutas exentas: `/auth/`, `/billing/`, `/admin/`, `/platform/`, `/gallery/setup-*`

### Startup Migration (`migrate_saas_billing.py`)
- Crea tablas: plans, subscriptions, usage_records, invoices, audit_logs
- Seeds: Free Trial, Pro ($49), Enterprise ($199)
- **Hydrate**: tenants pre-billing reciben Plan Pro activo automaticamente
- **Super Admin**: `SUPER_ADMIN_EMAIL` env var promueve usuario en cada deploy

### Platform Control Tower (`/platform`)
- Overview: MRR, revenue, costos, margenes, trials expirando
- Tenant CRUD: buscar, filtrar, editar, suspender, activar, eliminar
- PUT `/platform/tenants/{id}` — editar tenant
- DELETE `/platform/tenants/{id}` — eliminar con cascade completo
- Plan management, revenue analytics, cost tracking, audit logs

---

## 3. CREATIVE STUDIO (BUSINESS FORGE)

### BYOK (Bring Your Own Key)
- Cada tenant conecta su propia Google AI API Key
- GET `/gallery/setup-status` — verifica si tenant tiene key
- POST `/gallery/setup-google` — valida y guarda key encriptada
- Onboarding guiado de 2 pasos con link directo a Google AI Studio
- Pricing transparente (~$0.04/img)

### Image Generation Models
- **Nano Banana 2** (`gemini-3.1-flash-image-preview`) — rapido, default
- **Nano Banana Pro** (`gemini-3-pro-image-preview`) — maxima calidad
- Ambos soportan image-to-image (hasta 14 referencias)
- Gemini 2.5 Flash eliminado (no soporta referencias de imagen)

### Photoshoot Tab (5 templates)
- Studio, Floating, Lifestyle, In Use, Ingredient
- Prompts profesionales (Phase One IQ4, Hasselblad X2D, Kinfolk-style, etc.)
- Imagen del producto pasa como referencia visual al modelo
- Selector de modelo IA + prompt enhancer

### Model Shoot Tab (8 templates) — NUEVO
- Urban Street, Hogar Cozy, Aventura Outdoor, Cafe & Social
- Fitness & Wellness, Workspace Pro, Night Out, Beach & Verano
- Upload de foto de modelo → analisis facial preciso (forma de cara, color de ojos, tono de piel, pelo, cuerpo)
- Producto analizado por categoria → instrucciones especificas (ropa puesta, zapatillas en pies, cartera en mano, etc.)
- Imagenes de producto + modelo pasan como referencia multimodal

### Campaign Generator
- Generacion paralela con `asyncio.gather` (antes era secuencial → timeout)
- Textos con frameworks de conversion: AIDA, FOMO, exclusividad, engagement, branding
- Persona de copywriter senior (Ogilvy/Wieden+Kennedy level)
- Cada variacion usa angle diferente (emocional, racional, social proof, urgencia, curiosidad)

### AI Prompt Enhancer
- POST `/gallery/enhance-prompt` — transforma prompts basicos en instrucciones de art director
- Incorpora Brand DNA del tenant automaticamente
- Boton "Mejorar prompt" en Photoshoot, Model Shoot, y Campaigns

### Brand DNA Mejorado
- `_build_brand_context()` ahora extrae: colores primarios + secundarios, tipografia, estilo fotografico, estetica, mood, personalidad, tono de voz, audiencia target
- Inyectado en todos los prompts de generacion

### Gallery Tab Fix
- Content JSONB de asyncpg llegaba como string → tarjetas vacias
- Backend parsea content antes de enviar + frontend safeguard
- Constraint `unique_tenant_asset_type` eliminado (permitia solo 1 asset por tipo)

---

## 4. GOOGLE OAUTH

### Backend
- POST `/auth/google` — verifica Google ID token, crea/loguea usuario
- Auto-crea tenant + trial subscription para nuevos usuarios
- Email Google-verified → skip verificacion por email
- `GOOGLE_OAUTH_CLIENT_ID` env var

### Frontend
- `GoogleSignInButton` componente reutilizable (Google Identity Services)
- Boton en Login ("Sign in with Google") y Register ("Sign up with Google")
- `AuthContext.loginWithGoogle()` method

---

## 5. META EMBEDDED SIGNUP (WhatsApp + Instagram + Facebook)

### Token Exchange Fix (Root Cause)
- Facebook Login for Business con `config_id` genera un SUAT code que se intercambia **SIN redirect_uri**
- Solo: `client_id + client_secret + code`
- Fallback a redirect_uri variants si el exchange sin redirect falla

### Meta Service (`meta_service/`)
- API actualizada de v19.0 a v22.0
- Auto-subscribe pages a webhooks al conectar
- Fetch WhatsApp phone numbers por cada WABA
- Tokens por asset: `META_PAGE_TOKEN_{id}`, `META_IG_TOKEN_{id}`, `META_WA_TOKEN_{id}`

### Orchestrator (`internal-sync`)
- Reescrito completamente (patron ClinicForge)
- Cada token guardado individualmente con credential_type correcto
- Access tokens NO se guardan en business_assets (solo en credentials encriptados)
- Assets con status "active"

### Wizard (`MetaOnboardingWizard`)
- Muestra phone numbers de WhatsApp
- Matching por Meta external ID (no UUID interno)
- Subscribe webhooks para FB, IG, y WA al finalizar

### Frontend
- Facebook SDK actualizado a v22.0
- Maneja tanto code como accessToken directo

---

## 6. FRONTEND FIXES MENORES

- `Billing.tsx`: proteccion contra `status` null en `toUpperCase()`
- `BusinessForge.tsx`: try/catch en `handleDelete`
- `Sidebar.tsx`: mobile nav con rutas faltantes (forge, knowledge, billing)
- Default model cambiado a `nano-banana-2` en todos los tabs

---

## ENVIRONMENT VARIABLES NUEVAS

### Orchestrator
```
SUPER_ADMIN_EMAIL=admin@domain.com
GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
INTERNAL_SECRET_KEY=shared-secret
```

### Meta Service
```
META_APP_ID=xxx
META_APP_SECRET=xxx
META_VERIFY_TOKEN=xxx
META_GRAPH_API_VERSION=v22.0
ORCHESTRATOR_URL=http://orchestrator_service:8000
INTERNAL_SECRET_KEY=shared-secret
```

### Frontend
```
VITE_FACEBOOK_APP_ID=xxx
VITE_META_CONFIG_ID=xxx
VITE_META_EMBEDDED_SIGNUP=true
VITE_FACEBOOK_API_VERSION=v22.0
VITE_GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
```

---

## ARCHIVOS CREADOS/MODIFICADOS (key files)

### Nuevos
- `frontend_react/src/components/GoogleSignInButton.tsx`
- `orchestrator_service/app/middleware/subscription_guard.py` (reescrito)
- `orchestrator_service/app/routes/platform_routes.py` (PUT/DELETE tenant)
- `orchestrator_service/app/routes/gallery_routes.py` (setup, enhance, model-shoot)

### Modificados significativamente
- `orchestrator_service/app/core/image_utils.py` — catalogo de modelos, multimodal
- `orchestrator_service/app/services/creative_studio.py` — templates pro, model shoot, brand DNA
- `orchestrator_service/scripts/migrate_saas_billing.py` — hydrate + super admin
- `orchestrator_service/admin_routes.py` — internal-sync rewrite, update-channels fix
- `meta_service/core/auth.py` — SUAT exchange sin redirect_uri
- `frontend_react/src/views/BusinessForge.tsx` — 5 tabs, gallery fix, model shoot
- `frontend_react/src/views/auth/Login.tsx` — Google OAuth
- `frontend_react/src/views/auth/Register.tsx` — Google OAuth
- `frontend_react/src/contexts/AuthContext.tsx` — loginWithGoogle
