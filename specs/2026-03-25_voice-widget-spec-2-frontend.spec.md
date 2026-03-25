# SPEC 2: Voice Widget — Frontend Configuration Page

## Fecha: 2026-03-25
## Prioridad: P0 — Página de configuración del Voice Widget
## Dependencias: SPEC 1 (Backend & Data Layer), tabla `agents` existente

---

## OBJETIVO DE NEGOCIO

Crear la página `/voice-widget` dentro del dashboard de Future donde el usuario pueda:
1. Seleccionar un agente desplegado existente para usarlo como agente de voz
2. Configurar modelo de voz (TTS), modelo de transcripción (STT), idioma
3. Personalizar la apariencia del widget (colores, avatar, botón, posición, texto)
4. Opcionalmente sobreescribir el system prompt o temperatura del agente
5. Obtener un snippet `<script>` listo para copiar y pegar en su Tienda Nube
6. Previsualizar en vivo cómo se verá el widget

---

## CLARIFICACIONES INCORPORADAS

- **Múltiples widgets**: La página muestra una lista de widgets existentes + botón "Crear nuevo widget". Cada widget se configura individualmente.
- **Plan guard**: Si el tenant tiene plan Free, la página muestra un bloqueo con CTA a upgrade (como otras features premium).
- **BYOK mode**: Toggle en la sección de voz: "Usar API de la plataforma (X min/mes incluidos)" vs "Usar mi propia API Key (ilimitado)". Si elige BYOK y selecciona NVIDIA, aparece textarea para NGC API Key.
- **Dominios**: NO hay sección de dominios permitidos. Se hereda automáticamente de la URL pública de la tienda configurada en el agente.
- **Uso**: Se muestra un mini-dashboard de consumo arriba: "23.5 / 60 minutos usados este mes".
- **Abuso**: No se configura en frontend — es lógica automática del backend+system prompt.

---

## DISEÑO DE LA PÁGINA

### Estructura General (2 columnas en desktop, 1 en mobile)

```
┌──────────────────────────────────────────────────────────────┐
│  🎙 Voice Widget — Asistente de Voz para tu Tienda          │
│  Configura un asistente de voz embebible en tu web.          │
│  Los visitantes podrán hablar directamente con tu agente IA. │
└──────────────────────────────────────────────────────────────┘

┌─────────────── LEFT COLUMN ──────┐  ┌──── RIGHT COLUMN ────┐
│                                  │  │                      │
│  📦 1. Seleccionar Agente        │  │  👁 PREVIEW EN VIVO   │
│  ┌─────────────────────────┐     │  │                      │
│  │ Dropdown: Agentes activos│     │  │  ┌──────────────┐   │
│  │ [Ventas Bot ▼]           │     │  │  │  TU TIENDA   │   │
│  └─────────────────────────┘     │  │  │              │   │
│  Info: modelo, tools, channels   │  │  │              │   │
│                                  │  │  │         🎙   │   │
│  🎤 2. Configuración de Voz      │  │  │  "¡Hola!     │   │
│  ┌─────────────────────────┐     │  │  │   Toca para  │   │
│  │ Proveedor TTS: [OpenAI▼]│     │  │  │   hablar"    │   │
│  │ Voz: [alloy ▼]          │     │  │  └──────────────┘   │
│  │ STT: [Whisper ▼]        │     │  │                      │
│  │ Idioma: [Español ▼]     │     │  │                      │
│  │ Duración max: [5 min]   │     │  │  ───────────────────  │
│  └─────────────────────────┘     │  │                      │
│                                  │  │  📋 CÓDIGO EMBED     │
│  🎨 3. Personalización Visual    │  │  ┌──────────────┐   │
│  ┌─────────────────────────┐     │  │  │ <script>...  │   │
│  │ Color: [■ #8B5CF6]      │     │  │  │              │   │
│  │ Tamaño botón: ○sm ●md ○lg│    │  │  │   [Copiar]   │   │
│  │ Posición: ○Izq ●Der     │     │  │  └──────────────┘   │
│  │ Icono: ○📞 ●🎙 ○🎧     │     │  │                      │
│  │ Avatar URL: [________]   │     │  │  💡 Instrucciones:  │
│  │ Mensaje: [Hola! Toca...] │     │  │  Pega este código   │
│  └─────────────────────────┘     │  │  antes de </body>   │
│                                  │  │  en tu Tienda Nube.  │
│  🧠 4. Override de Agente (Opt.) │  │                      │
│  ┌─────────────────────────┐     │  └──────────────────────┘
│  │ System Prompt Override:  │     │
│  │ [textarea - optional]    │     │
│  │ Temperatura: [0.3]       │     │
│  └─────────────────────────┘     │
│                                  │
│  🌐 5. Dominios Permitidos       │
│  ┌─────────────────────────┐     │
│  │ mitienda.mitiendanube.com│     │
│  │ [+ Agregar dominio]      │     │
│  └─────────────────────────┘     │
│                                  │
│  [💾 Guardar Configuración]      │
│  [🔴 Desactivar Widget]         │
└──────────────────────────────────┘
```

---

## COMPONENTES Y ESTADOS

### Estado Principal

```typescript
interface VoiceWidgetPageState {
    // Data
    config: VoiceWidgetConfig | null;
    agents: Agent[];
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    copied: boolean;

    // Multi-widget list
    widgets: VoiceWidgetConfig[];
    selectedWidgetId: number | null;

    // Form
    formData: VoiceWidgetConfig;
    hasChanges: boolean;

    // Usage
    voiceUsage: {
        minutes_included: number;
        minutes_used: number;
        minutes_remaining: number;
        api_key_mode: 'platform' | 'byok';
    };

    // Dynamic providers (from GET /admin/voice-widget/providers)
    availableProviders: {
        realtime_providers: ('openai' | 'nvidia')[];
        tts_providers: ('openai' | 'nvidia' | 'elevenlabs' | 'deepgram')[];
        stt_providers: ('openai' | 'nvidia' | 'deepgram')[];
        voices: Record<string, string[]>;
    };
}
```

### Sección 1: Selector de Agente

- **Fuente de datos**: `GET /admin/agents` (ya existente)
- **Filtro**: Solo agentes con `is_active: true`
- **Al seleccionar un agente**: Mostrar card con info del agente:
  - Nombre, rol, modelo (ej: "GPT-4o"), tools habilitadas, canales
  - Badge: "Este agente será la inteligencia detrás de tu asistente de voz"
- **Si no hay agentes**: Mostrar CTA → "Primero crea un agente" → link a `/agents`

### Sección 2: Configuración de Voz

**Paso 2a — Modo de Pipeline**

| Campo | Tipo | Opciones | Default |
|-------|------|----------|---------|
| Pipeline de Voz | Toggle cards | Realtime (baja latencia) / Cascaded (multi-provider) | Realtime |
| Proveedor Realtime | Select (solo si pipeline=realtime) | OpenAI Realtime, NVIDIA Riva NIM | OpenAI |

**Card visual para cada modo:**
- **Realtime**: "Conversación fluida con latencia ultra-baja. El proveedor maneja audio completo." Badge: "Recomendado"
- **Cascaded**: "Máxima flexibilidad. Elige STT y TTS de diferentes proveedores." Badge: "Avanzado"

**Paso 2b — Config según pipeline**

**Si `pipeline = realtime`:**

| Campo | Tipo | Opciones | Default |
|-------|------|----------|---------|
| Proveedor Realtime | Card selector | OpenAI Realtime, NVIDIA Riva NIM | OpenAI |
| Voz | Select (varía por provider) | (ver abajo) | alloy / magpie-tts |
| Idioma | Select | Español, English, Português | es |
| Duración máx. | Number input | 60-600 seg | 300 |

**Si `pipeline = cascaded`:**

| Campo | Tipo | Opciones | Default |
|-------|------|----------|---------|
| Proveedor TTS | Select | OpenAI, ElevenLabs, Deepgram, NVIDIA Riva | OpenAI |
| Modelo de Voz | Select | (depende del proveedor) | alloy |
| Proveedor STT | Select | OpenAI (Whisper), Deepgram, NVIDIA Riva | OpenAI |
| Idioma | Select | Español, English, Português | es |
| Duración máx. | Number input | 60-600 seg | 300 |

**Voces por proveedor (TTS)**:
- **OpenAI**: alloy, echo, fable, onyx, nova, shimmer
- **NVIDIA Riva**: magpie-tts-es (español), magpie-tts-en (inglés), magpie-tts-fr (francés)
- **ElevenLabs**: (se cargan dinámicamente si el tenant tiene API key de ElevenLabs)
- **Deepgram**: aura-asteria, aura-luna, aura-stella, aura-athena, aura-hera, aura-orion, aura-arcas, aura-perseus, aura-angus, aura-orpheus, aura-helios, aura-zeus

**Providers dinámicos**: Los selectores solo muestran providers para los cuales el tenant tiene API key en Credentials. Se obtienen de `GET /admin/voice-widget/providers`.

**Info card por provider**:
- **OpenAI Realtime**: "Conversación unificada speech-to-speech. Latencia ~200-500ms. Soporta function calling nativo."
- **NVIDIA Riva NIM**: "ASR sub-25ms + TTS multilingüe natural. Usa tu propio LLM (NexusEngine). Ideal para español y privacidad de datos."

### Sección 3: Personalización Visual

| Campo | Tipo | Opciones | Default |
|-------|------|----------|---------|
| Color de marca | Color picker + text | Hex color | #8B5CF6 |
| Tamaño botón | Radio group | sm (48px), md (56px), lg (64px) | md |
| Posición | Radio group | bottom-right, bottom-left | bottom-right |
| Icono del botón | Radio group (visual) | phone, mic, headset | phone |
| Avatar URL | Text input | URL de imagen | null |
| Mensaje de bienvenida | Text input | Texto libre | "¡Hola! Toca para hablar conmigo." |

### Sección 4: Override de Agente (Colapsable)

- **System Prompt Override**: Textarea, placeholder: "Dejar vacío para usar el prompt del agente seleccionado"
- **Temperatura Override**: Range slider 0.0—1.0, step 0.1
- **Nota informativa**: "Estos campos son opcionales. Si los dejas vacíos, se usará la configuración del agente seleccionado."

### Sección 5: Modo de Billing (API Key)

- **Toggle visual** con 2 cards:
  - **"Usar API de Future"** (default): "Tus minutos de voz están incluidos en tu plan. Pro: 60 min/mes. Enterprise: 300 min/mes."
  - **"Usar mi propia API Key"** (BYOK): "Conecta tu propia API key para uso ilimitado. Ideal para desarrolladores."
- Si elige BYOK:
  - Si provider = OpenAI → no necesita key extra (ya tiene OPENAI_API_KEY en credentials)
  - Si provider = NVIDIA → textarea aparece para pegar NGC API Key
    - Placeholder: "Pega aquí tu NGC API Key (se almacenará encriptada)"
    - Helper: "Obtenla en org.ngc.nvidia.com/setup/api-keys"
    - Al guardar, se cifra con AES-256 y se guarda en credentials (category: nvidia, scope: tenant)
- **Mini-dashboard de consumo** (visible siempre arriba):
  - Barra de progreso: "23.5 / 60 minutos usados"
  - Si BYOK: "Modo BYOK activo — uso ilimitado con tu API Key"

### Preview en Vivo (Right Column)

- Mockup de una web genérica (similar a `WebSettings.tsx` existente)
- Botón circular flotante con el color, tamaño, posición e icono configurados
- Burbuja de mensaje de bienvenida
- Si hay avatar_url, mostrar la imagen en lugar del icono
- **Se actualiza en tiempo real** cuando el usuario cambia cualquier campo

### Snippet de Código

```html
<script>
  (function(d,t) {
    var s=d.createElement(t);
    s.src="https://TU_DOMINIO_FUTURE/voice-widget-sdk.js";
    s.defer=true;
    s.async=true;
    s.dataset.token="WIDGET_TOKEN_AQUI";
    d.getElementsByTagName(t)[0].parentNode.insertBefore(s,d.getElementsByTagName(t)[0]);
  })(document,"script");
</script>
```

- Botón "Copiar" con feedback visual (checkmark verde por 2 seg)
- Instrucciones: "Copia este código y pégalo antes de `</body>` en el HTML de tu Tienda Nube"

---

## LÓGICA DE NEGOCIO (Gherkin)

```gherkin
Feature: Voice Widget Configuration Page

  Scenario: Primera vez — no hay configuración
    Given el usuario entra a /voice-widget
    And no tiene voice_widget_configs
    Then ve el formulario vacío con valores default
    And el snippet muestra "Guarda primero para obtener tu código"

  Scenario: Cargar configuración existente
    Given el usuario tiene un voice_widget_config guardado
    When entra a /voice-widget
    Then el formulario se carga con los valores guardados
    And el snippet muestra el código con su widget_token real

  Scenario: Seleccionar agente muestra info
    Given el usuario tiene 3 agentes activos
    When selecciona "Ventas Bot" del dropdown
    Then ve una card con: modelo=GPT-4o, tools=[search_products, check_stock], canales=[whatsapp, web]

  Scenario: Cambiar color actualiza preview en vivo
    Given el usuario cambia brand_color a "#FF5733"
    Then el botón en el preview cambia a ese color inmediatamente

  Scenario: Guardar configuración
    Given el usuario llenó el formulario y hace clic en "Guardar"
    Then se envía POST (si es nuevo) o PUT (si existe) a /admin/voice-widget/config
    And muestra toast "Configuración guardada"
    And el snippet se actualiza con el widget_token

  Scenario: Sin agentes activos
    Given el usuario no tiene agentes con is_active=true
    Then la sección de selección muestra "No tienes agentes activos"
    And un botón "Crear Agente" que lleva a /agents
    And el botón "Guardar" está deshabilitado

  Scenario: Providers dinámicos según credenciales
    Given el tenant tiene NGC_API_KEY y OPENAI_API_KEY en credentials
    When entra a /voice-widget
    Then la sección de pipeline muestra OpenAI y NVIDIA como opciones
    And al seleccionar NVIDIA, las voces cambian a magpie-tts-es, magpie-tts-en

  Scenario: Tenant sin NVIDIA key
    Given el tenant NO tiene NGC_API_KEY
    When entra a /voice-widget
    Then NVIDIA Riva aparece deshabilitado con tooltip "Agrega tu NGC API Key en Credenciales"
    And link directo a /credentials

  Scenario: Cambiar de OpenAI a NVIDIA actualiza voces
    Given pipeline=realtime y proveedor=OpenAI (mostrando alloy, echo, fable...)
    When el usuario cambia proveedor a NVIDIA Riva NIM
    Then las voces cambian a magpie-tts-es, magpie-tts-en
    And la info card cambia: "ASR sub-25ms + TTS multilingüe. Usa tu propio LLM."

  Scenario: Múltiples widgets — lista y selección
    Given el tenant tiene 3 widgets creados
    When entra a /voice-widget
    Then ve una lista/grid de sus widgets con nombre, agente, estado (activo/inactivo)
    And un botón "+ Nuevo Widget"
    And al hacer clic en un widget, carga su config en el formulario

  Scenario: Plan Free bloqueado
    Given el usuario tiene plan Free
    When entra a /voice-widget
    Then ve un overlay: "Voice Widget disponible en Pro y Enterprise"
    And botón "Ver Planes" → /billing

  Scenario: BYOK — pegar NGC API Key
    Given el usuario selecciona provider NVIDIA y mode BYOK
    Then aparece textarea "Pega tu NGC API Key"
    When pega la key y guarda
    Then la key se envía al backend cifrada
    And aparece "✓ API Key guardada de forma segura"

  Scenario: Consumo de minutos visible
    Given el tenant usa mode=platform y tiene 60 min/mes
    And ha usado 23.5 minutos
    Then el mini-dashboard muestra barra: "23.5 / 60 minutos usados"
    And color verde si < 80%, amarillo si < 95%, rojo si >= 95%

  Scenario: Dominio se hereda del agente
    Given el usuario selecciona agente "Ventas Bot"
    And el agente tiene url_publica="mitienda.mitiendanube.com"
    Then debajo del selector aparece: "Widget se mostrará en: mitienda.mitiendanube.com"
    And no hay campo editable de dominios
```

---

## ARCHIVOS A CREAR

- `frontend_react/src/views/VoiceWidget.tsx` — Página completa de configuración

## ARCHIVOS A MODIFICAR

- `frontend_react/src/App.tsx` — Agregar ruta `/voice-widget`
- `frontend_react/src/components/Sidebar.tsx` — Agregar NavItem para Voice Widget (icono: `Phone` o `Mic` de lucide)

---

## ESTILO VISUAL

- Seguir el mismo patrón que `WebSettings.tsx`:
  - Header con gradient `from-violet-600/20 to-indigo-600/20`
  - Cards con clase `glass` y border `border-white/5`
  - Inputs con `bg-white/5 border-white/10`
  - Labels con `text-xs font-bold text-slate-400`
  - Botón principal con `bg-violet-600 hover:bg-violet-700`
- Iconografía: `Phone`, `Mic`, `Headphones`, `Palette`, `Globe`, `Settings` de lucide-react
- Animación: `animate-fade-in` en el contenedor principal

---

## CRITERIOS DE ACEPTACIÓN

- [ ] Página accesible en `/voice-widget` (ruta protegida)
- [ ] Selector de agente muestra solo agentes activos del tenant
- [ ] Preview en vivo refleja cambios inmediatamente
- [ ] Snippet de código se genera correctamente con widget_token
- [ ] Botón copiar funciona y da feedback visual
- [ ] Formulario valida campos requeridos antes de guardar
- [ ] Responsive: en mobile las columnas se apilan
- [ ] Si no hay agentes, muestra CTA para crear uno
- [ ] Nav item visible en Sidebar (desktop y mobile)
- [ ] Providers se cargan dinámicamente desde /admin/voice-widget/providers
- [ ] NVIDIA Riva NIM aparece como opción cuando el tenant tiene NGC_API_KEY
- [ ] Providers sin API key aparecen deshabilitados con CTA a /credentials
- [ ] Al cambiar provider, las voces disponibles se actualizan automáticamente
- [ ] Toggle Pipeline (Realtime/Cascaded) cambia los campos visibles
- [ ] Lista de múltiples widgets con botón "+ Nuevo Widget"
- [ ] Plan Free muestra overlay de upgrade
- [ ] Mini-dashboard de consumo de minutos visible arriba
- [ ] Toggle BYOK/Platform con textarea para NGC API Key si NVIDIA+BYOK
- [ ] Dominio se hereda automáticamente de la URL pública del agente (no editable)
- [ ] NGC API Key se envía cifrada al backend al guardar
