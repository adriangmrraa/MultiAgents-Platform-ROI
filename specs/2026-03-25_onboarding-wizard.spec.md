# SPEC: Onboarding Wizard — Experiencia de Bienvenida Obligatoria

## Fecha: 2026-03-25
## Prioridad: P0 — Reemplaza MagicOnboarding, flujo critico de conversion
## Dependencias: OnboardingChat backend existente, Meta OAuth existente, Tienda Nube connection existente

---

## OBJETIVO DE NEGOCIO

Crear un wizard de onboarding obligatorio (popup/modal fullscreen) que guie al usuario paso a paso desde el registro hasta tener un agente IA funcional y listo para vender. Cada paso configura una pieza real del sistema. El wizard termina con una pantalla de pricing donde el usuario elige plan o inicia free trial.

**Reemplaza**: `MagicOnboarding.tsx` y la ruta `/magic`
**Mantiene**: `OnboardingChat.tsx` como feature separada (5 usos gratis, luego suscripcion)
**Meta**: Que el usuario vea resultados tangibles durante el wizard, entienda el valor, y se suscriba.

---

## CLARIFICACIONES CLAVE

### Modelo de negocio para millones de usuarios
- **Free Trial**: 10 dias, 50 mensajes, 1 agente, 1 tienda — suficiente para completar el wizard y ver resultados
- **Wizard usa API key de la plataforma** (no del tenant) — costo controlado:
  - ~5 llamadas a OpenAI por wizard completion = ~$0.02 por usuario
  - A 1M usuarios = $20,000 costo de onboarding → conversion rate 3% = 30K pagos × $49 = $1.47M/mes
- **OnboardingChat** (fuera del wizard): 5 sesiones gratis con TTL 30 dias en Redis
- **Cada paso del wizard es bloqueante** — no se puede saltar
- **Progreso se persiste** en DB (no se pierde si cierra el browser)

### API Key global de la empresa — Inversion en marketing
La `OPENAI_API_KEY` del entorno del orchestrator (`os.getenv("OPENAI_API_KEY")`) es la key global que la empresa paga. Se usa para:
- **Onboarding Wizard** (pasos 3-4-5 chat conversacional + paso 6 prueba del agente)
- **OnboardingChat** (5 sesiones gratis fuera del wizard)
- **Voice Widget modo `platform`** (minutos incluidos en plan Pro/Enterprise)
- **Super admin** (acceso completo sin restriccion)
- **Free Trial** (50 mensajes del agente en produccion)

Esto NO es un costo del tenant — es inversion de la empresa en:
1. **Conversion**: Que el usuario vea resultados tangibles y se suscriba
2. **UX**: Experiencia futurista de crear un agente conversando
3. **Retencion**: Que entienda el valor antes de pagar

El tenant paga con su propia key (BYOK) solo cuando quiere uso ilimitado o providers premium (NVIDIA). Los limites por plan (mensajes, minutos de voz) son el mecanismo de control de costo.

**CRITICO**: NUNCA pedir al usuario su API key durante el onboarding wizard. La experiencia debe ser frictionless. La key de la plataforma paga todo el flujo de bienvenida.

---

## CLARIFICACIONES RESUELTAS (Ronda 2)

### C1: Wizard obligatorio hasta paso 7 + notificaciones contextuales
**Decision**: El usuario NO puede salir del wizard hasta llegar al paso 7 y elegir "Probar Gratis" (o suscribirse). No hay X para cerrar, no hay sidebar, no hay navegacion. Es fullscreen inmersivo.

**Notificaciones durante el wizard**: Mientras el usuario esta configurando cada paso, aparecen tarjetas/popups/toast laterales cada ~30 segundos con tips como:
- "Sabias que tu agente puede agendar citas automaticamente?"
- "Con el Voice Widget, tus clientes pueden hablar por voz con tu agente"
- "Los comercios que usan IA venden 3x mas en los primeros 30 dias"
- "Tu agente puede responder en WhatsApp, Instagram y Facebook al mismo tiempo"

Estas notificaciones son educativas — van mostrando al usuario las features que tendra disponibles al terminar, generando anticipacion y entendimiento del valor.

### C2: Tienda Nube obligatoria + mensaje listo para el dev
**Decision**: Conectar Tienda Nube es **obligatorio**. El cliente ideal es Tienda Nube, la plataforma esta diseñada para eso.

- El paso 1 NO tiene opcion "No tengo Tienda Nube"
- En su lugar tiene un boton **"Necesito ayuda para conectar"** que muestra:
  - Instrucciones paso a paso para obtener Store ID y Access Token de Tienda Nube
  - Boton **"Copiar mensaje para tu desarrollador"** con texto listo para pegar:
    ```
    Hola! Estoy configurando un asistente de IA para nuestra tienda.
    Necesito que me compartas el Store ID y Access Token de Tienda Nube.

    Como obtenerlo:
    1. Ingresa al admin de Tienda Nube
    2. Ve a Configuracion > Aplicaciones > Mis aplicaciones
    3. Crea una app o usa una existente
    4. Copia el Store ID y el Access Token

    Solo necesito esos dos datos. Gracias!
    ```
- **Edge case "no tiene Tienda Nube"**: Un link pequeño "No uso Tienda Nube" que explica:
  - "Future esta optimizado para Tienda Nube. Sin conexion, no tendras acceso a: buscar productos, consultar stock, crear ordenes, sincronizar catalogo."
  - "Funciones disponibles sin tienda: chat de atencion al cliente, agendar citas, responder preguntas frecuentes."
  - Permite continuar pero los pasos 3-4-5 se adaptan: preguntas sobre atencion/FAQ en vez de productos.

### C3: Tenant se crea al entrar al wizard (post-registro)
**Decision**: El flujo es:
1. Usuario se registra (se crea `users` row)
2. Inmediatamente despues de verificar email → entra al wizard
3. En el wizard paso 0 (bienvenida): se crea el `tenant` con datos minimos (nombre del usuario como store_name provisional)
4. En paso 1 (Tienda Nube): se actualiza el tenant con store_id y token reales
5. El `tenant_id` existe desde paso 0, lo que permite guardar progreso y datos en todos los pasos

### C4: Corte de audio — boton manual + silencio 15 seg + multitarea
**Decision**: En los pasos de chat (3-4-5):
- **Boton de microfono**: Toggle on/off. El usuario lo enciende cuando quiere hablar.
- **Corte por silencio**: Si pasan 15 segundos sin audio detectado, se corta automaticamente el mic y se envia lo capturado.
- **Corte manual**: El usuario presiona el boton de nuevo para cortar y enviar.
- **Multitarea con audio activo**: Mientras el mic esta grabando, el usuario puede:
  - Scrollear por la conversacion
  - Ver respuestas previas del agente
  - Navegar entre la vista de chat y la vista de resumen
  - El audio se sigue capturando en background
- **Agente de onboarding como checklist inteligente**: El agente tiene un checklist interno (basado en la plantilla Pointe Coach) de toda la info que necesita. Cada respuesta del usuario va completando items del checklist. El agente sabe que falta y pregunta especificamente por lo que no tiene.
- **Experiencia personalizada desde minuto 0**: Cada pregunta del agente se adapta al tipo de negocio que el usuario describio. Si dijo "vendo ropa", las preguntas son sobre tallas, cambios por higiene, temporadas. Si dijo "vendo comida", pregunta sobre delivery, tiempos de preparacion, alergenos.

### C5: Usuarios existentes vs nuevos
**Decision**: Los usuarios existentes (registrados antes del deploy) ya tienen su Free Trial vencido (>10 dias). No pasan por el wizard — van directo al dashboard con su estado actual (trial expirado → pantalla de suscripcion).

El wizard obligatorio solo aplica a **usuarios nuevos** (registrados despues del deploy). Logica:
- Si `onboarding_progress` no existe para el user_id Y `users.created_at` es posterior al deploy → mostrar wizard
- Si el usuario ya tiene agentes activos (pre-existente) → NO mostrar wizard, ir al dashboard (con trial expirado si corresponde)
- Si `onboarding_progress.completed_at != null` → ya completo el wizard, ir al dashboard
- Si tiene `onboarding_progress` pero sin completar → retomar donde lo dejo
- `super_admin` → nunca ve el wizard

---

## ESTRUCTURA DEL WIZARD — 7 PASOS

### Paso 0: Bienvenida + Creacion de Tenant
- **Pantalla**: Animacion de bienvenida con nombre del usuario
- **Texto**: "Bienvenido a Future, {nombre}. En los proximos minutos vamos a crear tu asistente de IA perfecto para tu negocio."
- **Backend**: Crea el `tenant` con datos minimos (nombre del usuario como store_name provisional)
- **Auto-avanza** en 5 segundos o con tap/click
- **Resultado**: `tenant_id` disponible para todos los pasos siguientes

### Paso 1: Conectar Tienda Nube (OBLIGATORIO)
- **Que configura**: `tenants.tiendanube_store_id` + `credentials.TIENDANUBE_ACCESS_TOKEN`
- **UI**:
  - Input para Store ID + Access Token
  - Boton "Conectar Tienda"
  - Al conectar exitosamente: muestra nombre de la tienda, cantidad de productos, check verde
  - Boton **"Necesito ayuda para conectar"** → expande instrucciones paso a paso + boton "Copiar mensaje para tu desarrollador" con texto listo para WhatsApp/email
  - Link pequeno "No uso Tienda Nube" → expande panel con explicacion de funciones limitadas vs disponibles, permite continuar pero con advertencia permanente
- **Backend**: Usa endpoint existente de creacion/update de tenant + validacion contra API Tienda Nube
- **Validacion**: GET a la API de Tienda Nube para verificar token. Si falla → error claro
- **Notificacion contextual** (30 seg): "Tu agente podra buscar productos, consultar stock y crear ordenes automaticamente"

### Paso 2: Conectar Meta (WhatsApp/Instagram/Facebook)
- **Que configura**: Meta OAuth tokens, paginas, numeros de WhatsApp
- **UI**:
  - Boton "Conectar con Meta" → popup OAuth (flujo existente de MetaSettings.tsx)
  - Al volver del OAuth: muestra paginas/numeros conectados con checks verdes
  - Opcion "Configurar despues" → permite continuar con advertencia
- **Backend**: Usa el flujo OAuth existente de `meta_service`
- **Validacion**: Se verifican los tokens recibidos
- **Notificacion contextual**: "Con Meta conectado, tu agente respondera en WhatsApp, Instagram y Facebook al mismo tiempo"

### Paso 3: Identidad del Negocio (Chat conversacional + audio)
- **Que configura**: Seccion TONO Y PERSONALIDAD del system_prompt
- **UI**: Chat embebido dark theme con agente especializado
- **Checklist interno del agente** (basado en Pointe Coach):
  - [ ] Nombre del negocio y que vende
  - [ ] Que lo hace especial/diferente
  - [ ] Pronombres (vos/tu/usted)
  - [ ] Nivel de formalidad
  - [ ] Uso de emojis si/no
  - [ ] Frases prohibidas
  - [ ] Muletillas del sector
- **El agente se adapta**: Si dijo "vendo ropa" → pregunta sobre tallas, temporadas, estilos. Si dijo "comida" → delivery, alergenos, tiempos.
- **Audio**: Boton microfono toggle (on/off). Corte por silencio 15 seg o manual. Multitarea: puede scrollear/ver mientras graba.
- **Al completar** (boton "Listo" o checklist completo): Muestra resumen editable del tono generado
- **Notificacion contextual**: "Los agentes con personalidad definida tienen 40% mas engagement"

### Paso 4: Reglas de Negocio (Chat conversacional + audio)
- **Que configura**: Seccion REGLAS DE NEGOCIO del system_prompt
- **UI**: Mismo chat embebido, nueva sesion
- **Checklist interno del agente**:
  - [ ] Politica de envios (gratis? desde que monto? zonas?)
  - [ ] Politica de cambios/devoluciones (plazo, excepciones)
  - [ ] Horarios de atencion
  - [ ] Formas de pago (MercadoPago, tarjeta, transferencia, efectivo)
  - [ ] Que cosas el agente NO debe hacer nunca
  - [ ] Politica de precios (descuentos? negociacion? mayorista?)
- **Audio**: Misma mecanica que paso 3
- **Al completar**: Muestra reglas generadas como lista editable con toggles on/off
- **Notificacion contextual**: "Las reglas claras reducen 60% las consultas repetitivas"

### Paso 5: Diccionario de Sinonimos (Chat conversacional + audio)
- **Que configura**: Seccion DICCIONARIO del system_prompt
- **UI**: Chat embebido, nueva sesion
- **Checklist interno del agente**:
  - [ ] Sinonimos de categorias de productos
  - [ ] Jerga del sector / barrio / pais
  - [ ] Abreviaciones comunes de clientes
  - [ ] Nombres alternativos de metodos de pago
- **Audio**: Misma mecanica
- **Al completar**: Muestra tabla de sinonimos editable (categoria → sinonimos)
- **Notificacion contextual**: "Con el diccionario, tu agente entiende cuando le dicen 'remera' o 'playera' o 'franela'"

### Paso 6: Revision y Activacion
- **Que configura**: Nada nuevo — revisa todo lo anterior
- **UI**:
  - Dashboard de resumen con cards:
    - Tienda conectada (nombre, productos) o "Pendiente"
    - Canales conectados (WhatsApp, IG, FB) o "Pendiente"
    - Tono (resumen 2 lineas, boton "Editar")
    - Reglas (resumen 2 lineas, boton "Editar")
    - Diccionario (X sinonimos configurados, boton "Editar")
  - System prompt completo expandible y editable
  - **Boton "Probar Agente"**: Input donde escribe un mensaje de prueba → el agente responde con el system prompt creado → el usuario ve en vivo como va a sonar
  - **Boton "Activar Agente"** → crea el agente en DB y lo activa
- **Backend**: `POST /admin/onboarding/complete`
- **Notificacion contextual**: "Tu agente esta casi listo. Pruebalo antes de activarlo!"

### Paso 7: Pricing + Free Trial
- **Que configura**: Suscripcion o inicio de Free Trial
- **UI**:
  - Animacion especial: "Tu agente esta listo!" (confetti/particulas)
  - 3 opciones estilo pricing cards:
    1. **Pro** ($49/mes) — Badge "Popular" — CTA "Suscribirme" → checkout Stripe/MP
    2. **Enterprise** ($199/mes) — Badge "Todo incluido" — CTA "Suscribirme" → checkout
    3. **Probar Gratis** (10 dias, 50 msgs) — CTA "Iniciar prueba gratuita"
  - Toggle mensual/anual con -20% descuento
  - Comparativa de features entre planes
  - Al elegir cualquiera → wizard se cierra, redirige a Dashboard con toast de bienvenida
- **Backend**: Usa endpoints de billing existentes (`POST /billing/checkout` o `POST /billing/start-trial`)

### Sistema de Notificaciones Contextuales (cross-step)
- **Tipo**: Toast/card lateral que aparece cada ~30 segundos
- **No bloquea**: El usuario puede descartarla o ignorarla
- **Pool de mensajes** por paso (5-8 mensajes rotativos por paso)
- **Proposito**: Educar sobre features, generar anticipacion, mostrar valor
- **Ejemplos generales**:
  - "Con el Voice Widget, tus clientes hablan con tu agente por voz desde tu web"
  - "Los comercios con IA venden 3x mas en los primeros 30 dias"
  - "Tu agente nunca duerme — atiende 24/7 los 365 dias del ano"
  - "Cada conversacion se registra y analiza en tu dashboard de analytics"

---

## PERSISTENCIA DEL PROGRESO

### Nueva tabla: `onboarding_progress`

```sql
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id),
    current_step INTEGER DEFAULT 0,        -- 0-7
    step_data JSONB DEFAULT '{}',          -- datos parciales de cada paso
    system_prompt_draft TEXT DEFAULT '',    -- prompt acumulado
    completed_at TIMESTAMPTZ DEFAULT NULL, -- null si no completo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_onboarding_user ON onboarding_progress(user_id);
```

### `step_data` estructura:
```json
{
    "step_1": { "completed": true, "tiendanube_connected": true, "store_name": "Mi Tienda" },
    "step_2": { "completed": true, "meta_connected": true, "pages": ["Mi Pagina"], "whatsapp": "+54..." },
    "step_3": { "completed": true, "tone_draft": "## TONO Y PERSONALIDAD..." },
    "step_4": { "completed": false },
    "step_5": { "completed": false },
    "step_6": { "completed": false },
    "step_7": { "completed": false }
}
```

---

## ENDPOINTS NUEVOS

### `GET /admin/onboarding/progress`
- Retorna el progreso del usuario actual
- Si no existe, crea uno con step=0

### `PUT /admin/onboarding/progress`
- Body: `{ step: number, step_data: object, system_prompt_draft?: string }`
- Actualiza el paso actual y los datos parciales
- Valida que no se salten pasos (step_n requiere step_n-1 completed)

### `POST /admin/onboarding/interview-step`
- Similar a `/interview` pero scoped a una seccion del prompt
- Body: `{ session_id, user_message, step: 3|4|5, tenant_id }`
- Usa prompts diferentes segun el step (tono, reglas, diccionario)
- Retorna: `{ ai_message, section_complete: bool, extracted_draft: string }`

### `POST /admin/onboarding/complete`
- Marca wizard como completado
- Crea el agente con el system_prompt acumulado
- Retorna: `{ agent_id, status: "active" }`

---

## LOGICA DE NEGOCIO (Gherkin)

```gherkin
Feature: Onboarding Wizard

  Scenario: Usuario nuevo ve el wizard al primer login
    Given un usuario recien registrado sin onboarding_progress
    When accede a cualquier ruta protegida
    Then se redirige a /onboarding-wizard (o se muestra como modal fullscreen)
    And no puede navegar a ninguna otra pagina hasta completar o iniciar trial

  Scenario: Progreso se persiste entre sesiones
    Given un usuario completo hasta el paso 3
    When cierra el browser y vuelve a entrar
    Then el wizard abre en el paso 4 (el siguiente pendiente)

  Scenario: No se puede saltar pasos
    Given un usuario en el paso 2
    When intenta ir al paso 5
    Then el wizard lo mantiene en paso 2
    And muestra "Completa este paso primero"

  Scenario: Paso 1 — Conectar Tienda Nube
    Given el usuario esta en paso 1
    When ingresa Store ID y Access Token validos
    Then la plataforma verifica contra la API de Tienda Nube
    And muestra "Tienda conectada: Mi Tienda (234 productos)"
    And habilita el boton "Siguiente"

  Scenario: Paso 1 — Sin Tienda Nube
    Given el usuario no tiene Tienda Nube
    When hace clic en "No tengo Tienda Nube"
    Then ve un aviso: "Algunas funciones no estaran disponibles"
    And puede avanzar al paso 2

  Scenario: Paso 2 — Conectar Meta OAuth
    Given el usuario esta en paso 2
    When hace clic en "Conectar con Meta"
    Then se abre popup de OAuth de Meta
    And al volver muestra paginas y numeros conectados

  Scenario: Paso 3 — Chat de Identidad
    Given el usuario esta en paso 3
    When conversa con el agente sobre su negocio
    Then el agente extrae tono, personalidad, pronombres
    And al terminar muestra resumen editable
    And el usuario puede editar y confirmar

  Scenario: Paso 6 — Prueba del agente
    Given el usuario esta en paso 6 con todo configurado
    When hace clic en "Probar Agente"
    Then se envia un mensaje de prueba al agente
    And se muestra la respuesta generada con el system prompt creado
    And el usuario ve como sonara su agente

  Scenario: Paso 7 — Elige plan
    Given el usuario esta en paso 7
    When hace clic en "Probar Gratis"
    Then se inicia Free Trial (10 dias, 50 msgs)
    And el wizard se cierra
    And redirige al Dashboard

  Scenario: Paso 7 — Elige Pro
    Given el usuario esta en paso 7
    When hace clic en "Suscribirme" al plan Pro
    Then se redirige al checkout de Stripe/MercadoPago
    And al completar pago, el wizard se cierra

  Scenario: OnboardingChat separado — limite de 5
    Given un usuario con Free Trial fuera del wizard
    When abre OnboardingChat por 6ta vez
    Then ve "Limite alcanzado. Suscribite para continuar creando agentes."

  Scenario: Super admin no ve wizard
    Given un super_admin
    When accede a la plataforma
    Then no ve el wizard obligatorio
```

---

## AUDIO OPCIONAL EN PASOS 3-4-5

- Boton de microfono al lado del input de chat
- Usa `navigator.mediaDevices.getUserMedia` + Web Speech API (`SpeechRecognition`) para STT en browser
- El texto transcrito se envia como mensaje de chat normal
- NO requiere backend de voz — es STT del browser (gratis, sin API calls)
- Fallback: si el browser no soporta SpeechRecognition, el boton no aparece

---

## ARCHIVOS A CREAR

- `frontend_react/src/views/OnboardingWizard.tsx` — Wizard fullscreen (reemplaza MagicOnboarding)
- `orchestrator_service/app/routes/onboarding_wizard_routes.py` — Endpoints de progreso
- Migration SQL para tabla `onboarding_progress`

## ARCHIVOS A MODIFICAR

- `frontend_react/src/App.tsx` — Reemplazar ruta `/magic` por `/onboarding-wizard`, agregar redirect logic
- `frontend_react/src/components/Sidebar.tsx` — Cambiar NavItem de Magic a Onboarding Wizard
- `orchestrator_service/main.py` — Registrar nuevas rutas + migration step
- `orchestrator_service/app/api/onboarding.py` — Agregar endpoint `/interview-step` con prompts por seccion

---

## UX / UI SPECS

### Layout
- **Fullscreen modal** (no sidebar visible, no header)
- Barra de progreso arriba: 7 circulos con lineas, paso actual highlighted
- Animaciones suaves entre pasos (slide left)
- Mobile: misma experiencia, todo adaptado

### Estilo visual
- Background: gradient oscuro (coherente con el resto de la plataforma)
- Cards glass para cada seccion
- Colores de accent: violet para pasos completados, slate para pendientes
- Animaciones: fade-in, slide, pulse en botones importantes

### Paso de Chat (3, 4, 5)
- Chat embebido fullwidth dentro del paso
- Burbujas de chat con el mismo estilo del OnboardingChat existente pero adaptado al dark theme
- Boton microfono pulsante cuando esta grabando
- Al completar: transicion suave a vista de resumen

### Paso 7 (Pricing)
- Cards estilo pricing page existente pero dentro del wizard
- Animacion especial: "Tu agente esta listo" con confetti o particulas
- Toggle mensual/anual
- Badges: "Popular" en Pro, "Todo incluido" en Enterprise

---

## CRITERIOS DE ACEPTACION

- [ ] Wizard aparece obligatoriamente para usuarios nuevos sin onboarding completado
- [ ] No se puede navegar a otras paginas hasta completar o iniciar trial (paso 7)
- [ ] 7 pasos secuenciales, no se puede saltar ninguno
- [ ] Progreso persiste en DB (cerrar y reabrir mantiene el paso)
- [ ] Paso 1: Tienda Nube se conecta con validacion real de token
- [ ] Paso 2: Meta OAuth funciona con popup
- [ ] Pasos 3-4-5: Chat conversacional genera secciones del system prompt
- [ ] Pasos 3-4-5: Audio opcional con STT del browser
- [ ] Paso 6: Preview del agente con mensaje de prueba real
- [ ] Paso 7: 3 opciones (Pro, Enterprise, Free Trial) con checkout funcional
- [ ] Super admin no ve el wizard
- [ ] OnboardingChat mantiene limite de 5 sesiones gratis (separado del wizard)
- [ ] Mobile responsive fullscreen
- [ ] Reemplaza MagicOnboarding completamente (ruta /magic → /onboarding-wizard)
- [ ] Cada paso del wizard usa API key de la plataforma (no del tenant)
- [ ] Animaciones suaves entre pasos
- [ ] Tenant se crea en paso 0 (tenant_id disponible para todo el wizard)
- [ ] Tienda Nube obligatoria con instrucciones + "Copiar mensaje para tu dev"
- [ ] Notificaciones contextuales cada ~30 seg educando sobre features
- [ ] Audio: toggle mic on/off, corte por silencio 15 seg, multitarea
- [ ] Agente usa checklist interno tipo Pointe Coach (preguntas adaptadas al negocio)
- [ ] Usuarios existentes (pre-deploy) NO ven el wizard
- [ ] Solo usuarios nuevos (post-deploy) ven el wizard obligatorio
