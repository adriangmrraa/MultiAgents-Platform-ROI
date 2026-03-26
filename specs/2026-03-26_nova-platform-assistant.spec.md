# SPEC: Nova — Asistente Inteligente de Plataforma

## Fecha: 2026-03-26
## Prioridad: P0 — Feature diferenciadora central de Future Platform
## Estado: Diseño inicial

---

## VISION

Nova es el asistente de IA omnipresente de Future Platform. Aparece como un botón flotante en TODA la plataforma. Puede hacer TODO lo que el usuario hace por UI, pero por voz. Es proactiva: no espera que le pregunten, DICE qué hacer. Cada página adapta su contexto pero Nova puede operar en toda la plataforma desde cualquier lugar.

**Nova NO es un chatbot genérico. Es una co-piloto de negocio que:**
- Sabe el estado completo del negocio del usuario en todo momento
- Detecta qué falta y lo dice sin que pregunten
- Ejecuta acciones reales (no solo responde preguntas)
- Aprende de las conversaciones del agente de ventas y sugiere mejoras

---

## ARQUITECTURA

### Widget flotante (bottom-right, toda la plataforma)

```
┌─────────────────────────────────────────┐
│  [Cualquier pagina de Future]           │
│                                         │
│  contenido de la pagina...              │
│                                         │
│                                         │
│                              ┌────┐     │
│                              │ 🎙 │     │
│                              │Nova│     │
│                              └────┘     │
└─────────────────────────────────────────┘
```

Al tocar el botón:
```
┌─────────────────────────────────────────┐
│  [Pagina actual]                        │
│                                    ┌────────────┐
│                                    │ Nova       │
│                                    │            │
│                                    │ "Hola! Vi  │
│                                    │ que no     │
│                                    │ tenes      │
│                                    │ productos  │
│                                    │ cargados.  │
│                                    │ Queres que │
│                                    │ arranquemos│
│                                    │ con eso?"  │
│                                    │            │
│                                    │ [🎙 Hablar]│
│                                    │ [⌨ Escribir]│
│                                    └────────────┘
└─────────────────────────────────────────┘
```

### Contexto por página

Nova siempre tiene acceso a TODO, pero prioriza el contexto de la página actual:

| Página | Contexto prioritario de Nova |
|--------|------------------------------|
| `/` (Dashboard) | Métricas, alertas, sugerencias generales |
| `/products` | Catálogo, stock, precios, productos sin foto |
| `/agents` | System prompt, performance del agente, errores recientes |
| `/chats` | Conversaciones activas, satisfacción, temas frecuentes |
| `/analytics` | ROI, conversión, tendencias |
| `/knowledge` | Documentos, colecciones, gaps de conocimiento |
| `/voice-widget` | Config del widget, minutos usados |
| `/onboarding-wizard` | Progreso del wizard, secciones pendientes |
| `/billing` | Plan actual, uso, upgrade suggestions |
| `/settings` | Conexiones, credenciales, canales |

---

## PROACTIVIDAD — QUÉ DICE NOVA SIN QUE LE PREGUNTEN

### Al abrir Nova en cada página, dice algo relevante:

**Dashboard**: "Hoy tuviste 23 conversaciones. 3 clientes preguntaron por envíos a Catamarca y el agente no supo responder. Queres que agreguemos esa info?"

**Products** (vacío): "Veo que no tenes productos cargados. Puedo ayudarte a cargar los primeros 5 ahora mismo. Dictamelos o subi un Excel."

**Products** (con datos): "Tenes 3 productos sin foto. Las fotos aumentan 40% las ventas. Queres que generemos fotos con IA?"

**Chats**: "El cliente Juan preguntó 3 veces por talle XL de la remera negra y el agente dijo que no hay stock. Verifico el stock real?"

**Agents**: "El agente derivó a humano 8 veces hoy. 5 fueron por preguntas de envío. Si agregamos reglas de envío al prompt, se reducen esas derivaciones."

**Knowledge**: "Tenes un documento de políticas pero no incluye la política de cambios. Queres que la agreguemos?"

---

## TOOLS DE NOVA (completas)

### Productos
| Tool | Descripción |
|------|-------------|
| `agregar_producto` | Crear producto: nombre, precio, descripción, categoría, variantes, stock |
| `editar_producto` | Modificar cualquier campo de un producto |
| `eliminar_producto` | Borrar producto (con confirmación) |
| `listar_productos` | Ver catálogo resumido (nombre, precio, stock) |
| `agregar_imagen` | Adjuntar foto a un producto |
| `actualizar_stock` | Cambio rápido de stock ("llegaron 20 remeras M") |
| `crear_categoria` | Organizar productos en categorías |

### Agente de ventas
| Tool | Descripción |
|------|-------------|
| `modificar_prompt` | Agregar/editar sección del system prompt |
| `agregar_regla` | Agregar regla de negocio al prompt |
| `agregar_sinonimo` | Agregar entrada al diccionario |
| `ver_prompt_actual` | Leer el system prompt actual |
| `ver_errores_agente` | Listar las últimas derivaciones/errores del agente |

### Knowledge
| Tool | Descripción |
|------|-------------|
| `subir_documento` | Subir archivo al RAG (texto dictado o archivo) |
| `listar_documentos` | Ver documentos activos |
| `buscar_conocimiento` | Consultar el RAG por un tema |

### Analytics (read-only, bajo consumo de tokens)
| Tool | Descripción |
|------|-------------|
| `resumen_del_dia` | Métricas: conversaciones, derivaciones, temas frecuentes |
| `problemas_detectados` | Lista de issues del agente (respuestas erróneas, temas sin cobertura) |

### Configuración
| Tool | Descripción |
|------|-------------|
| `ver_conexiones` | Estado de TiendaNube, Meta, YCloud |
| `ver_plan` | Plan actual + uso + días restantes |

### Navegación
| Tool | Descripción |
|------|-------------|
| `ir_a_pagina` | Navegar a otra página de la plataforma |
| `mostrar_tutorial` | Mostrar un mini-tutorial de la feature actual |

---

## INTELIGENCIA PROACTIVA — CÓMO FUNCIONA SIN GASTAR TOKENS DE MÁS

### Batch analysis (1 vez al día, barato)

Un cron job diario que analiza:
1. Las últimas 50 conversaciones del agente
2. Cuenta: derivaciones, temas sin respuesta, errores
3. Guarda un JSON resumen en Redis (key: `nova_daily:{tenant_id}`)
4. Cuando Nova se abre, lee ESE resumen (no re-analiza)

Costo: ~$0.02/día por tenant (1 llamada GPT-4o-mini con 50 mensajes resumidos)

### Checks estáticos (0 tokens)

Nova puede verificar SIN usar IA:
- Productos sin foto → query SQL
- Stock en 0 → query SQL
- Prompt sin sección de envíos → string search
- Días restantes de trial → query SQL
- Canales no conectados → query SQL
- Knowledge vacío → query SQL

Estos checks se hacen al abrir Nova — instant, gratis.

### Análisis de conversaciones (moderado)

NO analizar cada mensaje en tiempo real. En cambio:
- Cada 24h, tomar las últimas 50 conversaciones
- Resumir con GPT-4o-mini (barato): "temas frecuentes, errores, sugerencias"
- Guardar resumen
- Nova presenta el resumen cuando el usuario abre la página de analytics o chats

Costo total por tenant/día: ~$0.05 máximo.

---

## IMPLEMENTACIÓN POR FASES

### Fase 1: Widget flotante + contexto por página
- Botón flotante en Layout (bottom-right)
- Al tocar: panel slide-in con chat + voz
- Nova lee el contexto de la página actual
- Tools básicas: `ir_a_pagina`, `ver_conexiones`, `ver_plan`
- Checks estáticos (sin tokens)

### Fase 2: Tools de productos
- CRUD completo de productos por voz
- `agregar_producto`, `editar_producto`, `listar_productos`, etc.
- Integración con la página `/products`

### Fase 3: Tools de agente
- `modificar_prompt`, `agregar_regla`, `agregar_sinonimo`
- `ver_errores_agente`
- Actualizaciones al prompt en producción

### Fase 4: Proactividad inteligente
- Batch analysis diario (cron)
- Checks estáticos al abrir Nova
- Sugerencias contextuales basadas en datos reales

### Fase 5: Análisis de conversaciones
- Resumen diario de las últimas 50 conversaciones
- Detección de temas sin cobertura
- Sugerencias de mejora al prompt

---

## CRITERIOS DE ACEPTACIÓN

### Widget
- [ ] Botón flotante visible en TODAS las páginas (excepto onboarding fullscreen)
- [ ] Panel slide-in con chat + botón de voz
- [ ] Nova habla en español argentino con voseo
- [ ] Se puede minimizar sin perder contexto

### Contexto
- [ ] Nova sabe en qué página está el usuario
- [ ] Primer mensaje adaptado a la página actual
- [ ] Puede hacer cosas de cualquier página desde cualquier lugar

### Proactividad
- [ ] Al abrir, dice algo útil basado en datos reales (no genérico)
- [ ] Checks estáticos sin consumo de tokens
- [ ] Batch analysis diario con costo controlado (~$0.05/tenant/día)

### Tools
- [ ] Productos: CRUD completo por voz
- [ ] Agente: modificar prompt, agregar reglas, ver errores
- [ ] Knowledge: subir docs, buscar, listar
- [ ] Analytics: resumen del día, problemas detectados
- [ ] Config: ver conexiones, plan, uso
- [ ] Navegación: ir a página, mostrar tutorial

### Costos
- [ ] Checks estáticos: $0 (SQL queries)
- [ ] Proactividad diaria: ~$0.05/tenant/día (GPT-4o-mini)
- [ ] Voz Realtime: ~$0.06-0.24/min (OpenAI Realtime, solo cuando habla)
- [ ] Total máximo estimado: ~$2/tenant/mes de costo operativo de Nova
