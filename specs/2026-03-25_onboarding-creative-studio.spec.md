# SPEC: Onboarding — Paso Creative Studio + Tour de Features

## Fecha: 2026-03-25
## Prioridad: P1 — Paso extra del onboarding wizard
## Dependencias: Onboarding Wizard existente (7 pasos), Creative Studio (BusinessForge), Google Gemini API

---

## OBJETIVO

Agregar un paso nuevo al onboarding wizard que:
1. Explica visualmente las capacidades del Creative Studio (generacion de imagenes con IA)
2. Genera plantillas personalizadas basadas en la conversacion con Nova (identidad, tono, rubro)
3. Hace una demo funcional: toma un producto de Tienda Nube y genera una imagen transformada
4. Las plantillas quedan guardadas y utilizables despues del wizard
5. Free trial: 10 imagenes, despues se bloquea
6. La empresa paga el costo de generacion (Google Gemini API key global)

---

## POSICION EN EL WIZARD

Wizard actual: 0-Bienvenida → 1-TiendaNube → 2-Meta → 3-Identidad → 4-Reglas → 5-Diccionario → 6-Revision → 7-Pricing

Nuevo wizard: 0-Bienvenida → 1-TiendaNube → 2-Meta → 3-Identidad → 4-Reglas → 5-Diccionario → **5.5-Creative Studio** → 6-Revision → 7-Pricing

Se inserta DESPUES del diccionario y ANTES de la revision. Cuando el usuario llega aca, ya tiene:
- Tienda Nube conectada (con catalogo de productos)
- Identidad, tono, reglas y diccionario configurados via voz
- Contexto completo del negocio para generar plantillas personalizadas

---

## ESTRUCTURA DEL PASO CREATIVE STUDIO

### Sub-pasos internos (dentro del mismo paso del wizard):

```
Sub-paso 1: INTRO (explicativo)
┌──────────────────────────────────────┐
│  "Creative Studio — Tu estudio       │
│   de marketing con IA"               │
│                                      │
│  [Card 1] Photoshoot IA              │
│  Transforma fotos de productos en    │
│  sesiones de estudio profesional     │
│                                      │
│  [Card 2] Campanas Multi-Canal       │
│  Genera ads para IG, FB, WhatsApp    │
│  con copy y visual coordinados       │
│                                      │
│  [Card 3] Modelos IA                 │
│  Pon modelos vistiendo tu ropa       │
│  sin necesidad de sesion fotografica │
│                                      │
│  [Siguiente →]                       │
└──────────────────────────────────────┘

Sub-paso 2: PLANTILLAS PERSONALIZADAS
┌──────────────────────────────────────┐
│  "Tus plantillas exclusivas"         │
│                                      │
│  Basandome en tu negocio (H-Sports,  │
│  indumentaria deportiva), cree       │
│  estas plantillas para vos:          │
│                                      │
│  [Grid de 4-6 plantillas]            │
│  Cada una con:                       │
│  - Nombre (ej: "Cancha de Futbol")   │
│  - Preview visual (placeholder/mock) │
│  - Prompt detallado (invisible)      │
│  - Tag: "Personalizada para vos"     │
│                                      │
│  [Siguiente →]                       │
└──────────────────────────────────────┘

Sub-paso 3: DEMO EN VIVO
┌──────────────────────────────────────┐
│  "Probalo con tu producto"           │
│                                      │
│  [Selector de producto de TN]        │
│  Muestra 3-4 productos de la tienda  │
│  con foto, nombre y precio           │
│                                      │
│  [Selector de plantilla]             │
│  Las 4-6 plantillas generadas        │
│                                      │
│  [Generar Imagen IA]                 │
│  → Loading con animacion             │
│  → Muestra la imagen generada        │
│  → "Esta es una de las 10 imagenes   │
│     gratuitas de tu plan"            │
│                                      │
│  [Siguiente →]                       │
└──────────────────────────────────────┘
```

---

## GENERACION DE PLANTILLAS PERSONALIZADAS

Las plantillas se generan usando la info de la conversacion con Nova:

**Input**: step_data del onboarding (identidad, tono, rubro, cliente ideal, diferencial)

**Proceso** (backend):
1. Toma `step_data.step_3.identidad` → extrae rubro, productos, estilo
2. Genera 4-6 plantillas con prompts detallados especificos al negocio
3. Cada plantilla tiene un `prompt_suffix` (como los de creative_studio.py pero personalizado)

**Ejemplo para H-Sports (indumentaria deportiva)**:
```json
[
    {
        "id": "custom_cancha",
        "name": "Cancha de Futbol",
        "description": "Camiseta en el cesped de una cancha profesional, iluminacion de estadio",
        "prompt_suffix": "Professional football/soccer jersey laid flat on pristine green grass of a stadium pitch. Dramatic stadium floodlight illumination from above. Crisp focus on fabric details, double stitching visible. Dew drops on grass surrounding the jersey. Night match atmosphere..."
    },
    {
        "id": "custom_vestuario",
        "name": "Vestuario Premium",
        "description": "Conjunto deportivo en un vestuario premium con casilleros",
        "prompt_suffix": "Complete sportswear set (jersey + shorts) hanging in a premium locker room. Dark wood lockers, soft dramatic lighting..."
    },
    {
        "id": "custom_atleta",
        "name": "Atleta en Accion",
        "description": "Modelo deportista usando la prenda en movimiento",
        "prompt_suffix": "Athletic model wearing the sportswear during intense training. Dynamic action pose, sweat droplets, determination..."
    },
    {
        "id": "custom_flatlay",
        "name": "Flat Lay Deportivo",
        "description": "Vista superior con accesorios deportivos",
        "prompt_suffix": "Overhead flat-lay of sportswear with complementary athletic accessories: cleats, shin guards, water bottle, whistle..."
    }
]
```

**Para una tienda de ropa femenina seria diferente**:
```json
[
    {"name": "Pasarela", "prompt_suffix": "Fashion runway presentation..."},
    {"name": "Street Style", "prompt_suffix": "Urban street photography..."},
    {"name": "Probador", "prompt_suffix": "Fitting room mirror selfie aesthetic..."},
    {"name": "Editorial", "prompt_suffix": "Magazine editorial spread..."}
]
```

**Endpoint**: `POST /admin/onboarding/generate-templates`
- Input: `{ step_data, tenant_id }`
- Output: `{ templates: [...] }`
- Usa la API key global de OpenAI (gpt-4o) para generar los prompts
- Guarda las plantillas en `business_assets` con `asset_type: "custom_template"`

---

## DEMO DE IMAGEN

### Flujo:
1. Usuario selecciona un producto de su Tienda Nube (fetch desde API TN con las credenciales guardadas)
2. Selecciona una de las plantillas personalizadas
3. Toca "Generar Imagen IA"
4. Backend: toma la foto del producto de TN + el prompt de la plantilla → genera imagen con Google Gemini
5. Muestra resultado con animacion de reveal
6. Registra uso: 1/10 imagenes del free trial

### Endpoint: `POST /admin/onboarding/demo-image`
- Input: `{ product_id, product_image_url, template_id, template_prompt, tenant_id }`
- Usa Google Gemini API key GLOBAL (la empresa paga)
- Reutiliza la funcion `generate_image` de `app/core/image_utils.py`
- Guarda la imagen generada en `business_assets`
- Incrementa contador de imagenes usadas en el trial

### Limite Free Trial: 10 imagenes
- Almacenar en `onboarding_progress.step_data.creative_studio.images_used`
- O en una tabla de usage similar a `voice_usage_records`
- Al llegar a 10: "Has usado tus 10 imagenes gratuitas. Suscribite para generar ilimitadas."

---

## API KEY DE GOOGLE GEMINI

- Se almacena como variable de entorno: `GOOGLE_API_KEY` (ya existe en config.py linea 70)
- La empresa la paga — es inversion en conversion (el usuario ve resultados tangibles)
- El costo por imagen con Gemini es ~$0.01-0.05
- 10 imagenes free trial = ~$0.50/usuario maximo

---

## ARCHIVOS A CREAR

- Ningun archivo nuevo — todo se integra en archivos existentes

## ARCHIVOS A MODIFICAR

- `orchestrator_service/app/api/onboarding.py` — Endpoints: generate-templates, demo-image
- `frontend_react/src/views/OnboardingWizard.tsx` — Nuevo sub-paso con 3 vistas internas
- `orchestrator_service/app/services/creative_studio.py` — Reutilizar templates + generacion

---

## GHERKIN

```gherkin
Feature: Creative Studio en Onboarding

  Scenario: Plantillas personalizadas se generan del contexto
    Given el usuario completo los pasos 3-5 (identidad, reglas, diccionario)
    And su rubro es "indumentaria deportiva"
    When entra al paso Creative Studio
    Then se generan 4-6 plantillas especificas para indumentaria deportiva
    And cada plantilla tiene nombre, descripcion y prompt detallado
    And se muestran en un grid visual

  Scenario: Demo de imagen funciona
    Given el usuario tiene productos en Tienda Nube
    When selecciona un producto y una plantilla
    And toca "Generar Imagen IA"
    Then se genera una imagen con Google Gemini
    And se muestra con animacion de reveal
    And el contador marca 1/10 imagenes usadas

  Scenario: Limite de 10 imagenes
    Given el usuario ya uso 10 imagenes
    When intenta generar otra
    Then ve "Has usado tus 10 imagenes gratuitas"
    And un CTA "Suscribite para generar ilimitadas"

  Scenario: Plantillas quedan guardadas post-wizard
    Given el usuario completo el onboarding
    When entra a Business Forge / Creative Studio
    Then las plantillas personalizadas del onboarding estan disponibles
    And puede usarlas para generar mas imagenes (si tiene plan pago)

  Scenario: Sub-pasos explicativos
    Given el usuario entra al paso Creative Studio
    Then ve sub-paso 1: intro con 3 cards explicativas
    When toca "Siguiente"
    Then ve sub-paso 2: plantillas personalizadas generadas
    When toca "Siguiente"
    Then ve sub-paso 3: demo interactiva con selector de producto
```

---

## CRITERIOS DE ACEPTACION

- [ ] Paso Creative Studio se inserta entre Diccionario y Revision (sin romper pasos existentes)
- [ ] 3 sub-pasos internos: Intro → Plantillas → Demo
- [ ] Plantillas generadas desde el contexto de la conversacion con Nova
- [ ] Plantillas especificas al rubro del negocio (no genericas)
- [ ] Demo: seleccionar producto de TN + plantilla → imagen generada
- [ ] Imagen generada con Google Gemini API key global
- [ ] Contador de imagenes: 10 en free trial
- [ ] Plantillas persisten en DB y son usables en Business Forge post-wizard
- [ ] Explicaciones visuales con cards animadas
- [ ] Mobile responsive
- [ ] No interrumpe el flujo de los 7 pasos existentes
