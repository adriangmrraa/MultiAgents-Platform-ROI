
# 🧠 Nexus Brain: Knowledge & Skills Map

Este archivo actúa como el índice maestro de capacidades para los Agentes Autónomos. Define qué Skill utilizar para cada tipo de tarea.

## 🌟 Core Skills (Infraestructura)
| Skill | Trigger Keywords | Uso Principal |
|-------|------------------|---------------|
| **[Backend_Sovereign](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Backend_Sovereign/SKILL.md)** | `backend`, `fastapi`, `db`, `auth` | Arquitectura, endpoints, seguridad y base de datos. |
| **[Frontend_Nexus](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Frontend_Nexus/SKILL.md)** | `frontend`, `react`, `ui`, `hooks` | Componentes React, llamadas API, estado y estilos. |
| **[DB_Evolution](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/DB_Evolution/SKILL.md)** | `schema`, `migration`, `sql`, `rag` | Cambios en DB, gestión de vectores y migraciones. |

## 💬 Communication & Integrations
| Skill | Trigger Keywords | Uso Principal |
|-------|------------------|---------------|
| **[Omnichannel_Chat_Operator](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Omnichannel_Chat_Operator/SKILL.md)** | `chats`, `whatsapp`, `meta`, `msg` | Lógica de mensajería, polling y human handoff. |
| **[Meta_Integration_Diplomat](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Meta_Integration_Diplomat/SKILL.md)** | `oauth`, `facebook`, `instagram` | Vinculación de cuentas Meta y gestión de tokens. |
| **[TiendaNube_Commerce_Bridge](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/TiendaNube_Commerce_Bridge/SKILL.md)** | `tiendanube`, `products`, `orders` | Sincronización de catálogo y OAuth de e-commerce. |

## 🤖 AI & Onboarding
| Skill | Trigger Keywords | Uso Principal |
|-------|------------------|---------------|
| **[Agent_Configuration_Architect](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Agent_Configuration_Architect/SKILL.md)** | `agents`, `prompts`, `tools` | Creación y configuración de agentes IA. |
| **[Magic_Onboarding_Orchestrator](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Magic_Onboarding_Orchestrator/SKILL.md)** | `magic`, `wizard`, `onboarding` | Proceso de "Hacer Magia" y generación de assets. |
| **[Business_Forge_Engineer](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Business_Forge_Engineer/SKILL.md)** | `forge`, `canvas`, `visuals` | Gestión de assets generados y Fusion Engine. |
| **[Skill_Forge_Master](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Skill_Forge_Master/SKILL.md)** | `crear skill`, `skill architect` | Generador y arquitecto de nuevas capacidades. |


## 🔒 Security
| Skill | Trigger Keywords | Uso Principal |
|-------|------------------|---------------|
| **[Credential_Vault_Specialist](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/skills/Credential_Vault_Specialist/SKILL.md)** | `credentials`, `vault`, `keys` | Gestión segura de secretos y encriptación. |

---

# 🏗 Sovereign Architecture Context

## 1. Project Identity
**Platform AI Solutions** es un sistema SaaS de Orquestación de IA Multi-Inquilino (Multi-Agent Platform with ROI tracking).

Cada tenant posee sus propias credenciales de IA encriptadas en la base de datos.

**Regla de Oro:** NUNCA usar `os.getenv("OPENAI_API_KEY")` para lógica de agentes. Siempre usar `credentials_service.get_tenant_credential(tenant_id)`.

## 2. Tech Stack & Standards

### Backend
- **Python 3.10+**: Lenguaje principal
- **FastAPI**: Framework web asíncrono
- **SQLAlchemy 2.0**: ORM con sintaxis async (`await session.execute(select(Model))`)
- **Pydantic v2**: Validación de datos y schemas
- **PostgreSQL 14**: Base de datos relacional
- **Supabase**: Vector database (pgvector) para RAG
- **Redis**: Cache y estado de conversaciones

### Frontend
- **React 18**: Framework UI
- **TypeScript**: Tipado estricto obligatorio
- **Vite**: Build tool y dev server
- **Tailwind CSS**: Sistema de estilos
- **Lucide Icons**: Iconografía

### Infrastructure
- **Docker Compose**: Orquestación local
- **Render / EasyPanel**: Deployment cloud
- **WhatsApp Business API**: Canal de comunicación
- **Meta Graph API**: Integración Facebook/Instagram

## 3. Architecture Map

### Core Services

#### `/orchestrator_service` - API Principal
- **Responsabilidad**: Orquestación de servicios, gestión de tenants, API REST principal
- **Archivos Críticos**:
  - `main.py`: FastAPI app principal con startup events
  - `app/core/credentials.py`: **The Vault** - Gestión de credenciales encriptadas (CRÍTICO)
  - `app/core/email.py`: Servicio de emails (verificación, notificaciones)
  - `app/services/meta/`: **The Diplomat** - Integración Facebook/WhatsApp
  - `app/api/v1/endpoints/`: Endpoints REST organizados por dominio
  - `app/models/`: Modelos SQLAlchemy (DB schema)
  - `app/schemas/`: Pydantic schemas (request/response)

#### `/agent_service` - Motor de Inferencia
- **Responsabilidad**: Ejecución de agentes LangChain, procesamiento RAG
- **Tecnologías**: LangChain, OpenAI, Anthropic

#### `/whatsapp_service` - Canal WhatsApp
- **Responsabilidad**: Recepción/envío de mensajes WhatsApp
- **Características**: Buffer de mensajes, manejo de media

#### `/meta_service` - Integración Meta
- **Responsabilidad**: Conexión con Facebook/Instagram APIs
- **Funciones**: Gestión de páginas, webhooks, tokens

#### `/tiendanube_service` - E-commerce Integration
- **Responsabilidad**: Integración con Tienda Nube (e-commerce platform)

#### `/frontend_react` - Dashboard SPA
- **Responsabilidad**: Interfaz de usuario web
- **Estructura**:
  - `src/views/`: Páginas completas (Chats, Settings, Marketplace, Vault)
  - `src/components/`: Componentes reutilizables
  - `src/hooks/`: Custom hooks (incluye `useApi` para autenticación)
  - `src/services/`: Cliente API

### Data Layer

#### PostgreSQL (Local)
- **Tablas Críticas**:
  - `tenants`: Inquilinos del sistema
  - `users`: Usuarios con relación a tenant_id
  - `credentials`: API keys encriptadas por tenant
  - `rag_documents`: Metadata de documentos RAG
  - `conversations`: Historial de chats
  - `messages`: Mensajes individuales

#### Supabase (Remote)
- **Colecciones Vectoriales**: Embeddings para búsqueda semántica
- **Conexión**: Vía `app/services/rag/vector_store.py`

## 4. Development Workflow (Standard v6.1)

El ciclo de desarrollo en Nexus requiere validación obligatoria:

1. **Skill Check:** Antes de codificar, invoca la skill correspondiente (`Frontend_Nexus` o `Backend_Sovereign`).
2. **Implementation:** Escribe el código siguiendo estrictamente los tipos.
3. **Sovereign Audit (NUEVO):** Antes de confirmar la tarea, invoca a **Sovereign Code Auditor** para verificar que no halla fugas de `tenant_id`.
4. **Test Gen (NUEVO):** Solicita a **Nexus QA Engineer** que genere un test unitario para la nueva función.
5. **Zero Migrations:** Nexus usa "Auto-Healing". Si modificas un modelo en `models.py`, asegúrate de que el script de inicio (`migration_steps.py`) lo contemple.

### Spec-Driven Development (SDD) v2.0
- **SSOT**: La especificación (`.spec.md`) es la Única Fuente de Verdad.
- **Workflow Estricto**: `specify` -> `plan` -> `tasks` -> `implement` -> `verify`.
- **Constitución**: Obedecer siempre `.antigravity_rules`.
- **Desviación**: Todo cambio de código no especificado es "Spec Drift" y debe corregirse.
- **Ver docs**: `.docs/SDD_MASTER_GUIDE.md`


## 5. Project-Specific Patterns

### RAG Hybrid Architecture
- **PostgreSQL**: Metadata (`rag_documents` table)
- **Supabase**: Vectores (embeddings)
- **Sincronización**: Ambas deben mantenerse coherentes en create/delete

### WhatsApp Message Flow
1. Usuario envía mensaje → `whatsapp_service` (webhook)
2. `whatsapp_service` → Redis buffer (prevenir duplicados)
3. Buffer → `orchestrator_service` (procesamiento)
4. `orchestrator_service` → `agent_service` (inferencia)
5. Respuesta → `whatsapp_service` (envío)

### Frontend API Consumption
- **Hook Universal**: `useApi` (auto-inyecta `X-Admin-Token`)
- **Loading States**: Siempre usar `isLoading` para feedback visual
- **Error Handling**: Mostrar mensajes claros al usuario

## 6. Anti-Patterns (Prohibido)

❌ **NO hacer**:
- Usar `console.log` en producción (usar `logger`)
- Omitir `tenant_id` en queries
- Hardcodear API keys en código
- Ignorar errores con `try/except: pass`
- Mezclar lógica de negocio en routes (usar services)
- Componentes monolíticos en frontend (descomponer)

## 7. Workflows Disponibles

Los workflows definen procesos estandarizados para tareas repetitivas. Se encuentran en `.agent/workflows/`.

### 🛠 Core Development
| Workflow | Descripción |
|----------|-------------|
| **[new_feature](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/new_feature.md)** | Proceso end-to-end para crear nuevas funcionalidades (Backend First). |
| **[bug_fix](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/bug_fix.md)** | Diagnóstico, reproducción y solución de errores con aislamiento multi-tenant. |
| **[implement](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/implement.md)** | Ejecución autónoma del plan de implementación (escribir código y tests). |
| **[verify](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/verify.md)** | Ciclo de auto-verificación y corrección de errores. |
| **[review](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/review.md)** | Revisión técnica multi-perspectiva (Seguridad, Performance, Clean Code). |
| **[finish](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/finish.md)** | Cierre de sprint/hito y registro de éxito. |
| **[push](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/push.md)** | Sincronización con repositorio remoto (GitHub). |

### 🧠 Planning & Strategy
| Workflow | Descripción |
|----------|-------------|
| **[plan](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/plan.md)** | Transforma especificaciones en un plan técnico detallado. |
| **[specify](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/specify.md)** | Genera especificaciones técnicas rigurosas análisis de 3 pilares. |
| **[clarify](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/clarify.md)** | Ronda de preguntas para eliminar ambigüedades antes de planificar. |
| **[advisor](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/advisor.md)** | Consultor estratégico (Ciencia, Mercado, Comunidad). |
| **[gate](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/gate.md)** | Umbral de calidad: evalúa viabilidad antes de ejecutar. |
| **[tasks](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/tasks.md)** | Desglose de planes complejos en tickets individuales. |

### ⚙️ Specialized Ops
| Workflow | Descripción |
|----------|-------------|
| **[rag_management](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/rag_management.md)** | Gestión de documentos RAG (Upload, Index, Delete) en arquitectura híbrida. |
| **[audit](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/audit.md)** | Detector de Spec Drift (código vs intención). |
| **[newproject](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/newproject.md)** | Scaffolding para nuevos proyectos con estructura Antigravity. |
| **[secuency](file:///C:/Users/Asus/Downloads/Platform%20AI%20Solutions/.agent/workflows/secuency.md)** | Mapa de ruta secuencial para SDD (Spec-Driven Development). |

## 5. Available Skills Index

| Skill Name | Trigger | Descripción |
| :--- | :--- | :--- |
| **[Agent Configuration Architect](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Agent_Configuration_Architect/SKILL.md)** | *agents, agentes, AI, tools, templates, models, prompts, system prompt, wizard* | Especialista en configuración de agentes de IA: templates, tools, models, prompts y seed data. |
| **[Sovereign Backend Engineer](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Backend_Sovereign/SKILL.md)** | *python, backend, endpoints, base de datos, credenciales, agents, tools* | Experto en FastAPI y gestión segura de credenciales multi-tenant para Platform AI Solutions. |
| **[Business Forge Engineer](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Business_Forge_Engineer/SKILL.md)** | *forge, business forge, assets, fusion, canvas, catalog, visuals, images* | Especialista en Business Forge: gestión de assets post-magia, Fusion Engine y generación de visuales. |
| **[Credential Vault Specialist](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Credential_Vault_Specialist/SKILL.md)** | *credentials, credenciales, vault, api keys, tokens, encriptación, settings, sovereign* | Especialista en gestión segura de credenciales multi-tenant: encriptación, scope, categorías y The Vault. |
| **[DB Schema Surgeon](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/DB_Evolution/SKILL.md)** | *base de datos, modelos, migraciones, tablas, RAG, schema, SQL* | Gestión del esquema PostgreSQL, Auto-Healing y arquitectura RAG híbrida. |
| **[Deep Researcher](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Deep_Research/SKILL.md)** | *Antes de usar una librería nueva, al enfrentar un error desconocido, o cuando el usuario diga 'investiga esto'.* | Investiga documentación oficial y valida soluciones en internet antes de implementar. |
| **[EasyPanel DevOps](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/DevOps_EasyPanel/SKILL.md)** | *Cuando toque Dockerfile, docker-compose.yml o variables de entorno.* | Experto en Dockerización, Docker Compose y despliegue en EasyPanel. |
| **[Smart Doc Keeper](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Doc_Keeper/SKILL.md)** | *Cuando el usuario diga 'actualiza la doc', 'documenta este cambio' o tras editar código importante.* | Actualiza documentación y skills usando el protocolo 'Non-Destructive Fusion'. Garantiza que el contenido previo se preserve. |
| **[Nexus UI Developer](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Frontend_Nexus/SKILL.md)** | *frontend, react, tsx, componentes, UI, vistas, hooks* | Especialista en React 18, TypeScript, Tailwind CSS y conexión con API multi-tenant. |
| **[Magic Onboarding Orchestrator](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Magic_Onboarding_Orchestrator/SKILL.md)** | *magia, magic, onboarding, hacer magia, wizard, sse, stream, assets, branding* | Especialista en el proceso 'Hacer Magia': orquestación de agentes IA, SSE streaming y generación de assets de negocio. |
| **[Meta Integration Diplomat](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Meta_Integration_Diplomat/SKILL.md)** | *meta, facebook, instagram, whatsapp, oauth, integration, waba, pages* | Especialista en OAuth Meta (Facebook, Instagram, WhatsApp Business) y gestión de activos de negocio. |
| **[Omnichannel Chat Operator](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Omnichannel_Chat_Operator/SKILL.md)** | *chats, conversaciones, mensajes, whatsapp, instagram, facebook, human override, templates* | Especialista en gestión de conversaciones multi-canal (WhatsApp, Instagram, Facebook) para Platform AI Solutions. |
| **[AI Behavior Architect](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Prompt_Architect/SKILL.md)** | *Cuando edite system prompts, plantillas de agentes o lógica de RAG.* | Ingeniería de prompts para los Agentes de Ventas, Soporte y Business Forge. |
| **[Skill_Forge_Master](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Skill_Forge_Master/SKILL.md)** | *crear skill, nueva habilidad, skill architect, forge skill, capability, nueva skill* | Arquitecto y generador de Skills. Define, estructura y registra nuevas capacidades para el agente Antigravity. |
| **[Skill Synchronizer](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Skill_Sync/SKILL.md)** | *Después de crear o modificar una skill, o cuando el usuario diga 'sincronizar skills'.* | Lee los metadatos de todas las skills y actualiza el índice en AGENTS.md. |
| **[Sovereign Code Auditor](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Sovereign_Auditor/SKILL.md)** | *Antes de hacer commit, o cuando pida revisar seguridad o aislamiento.* | Experto en ciberseguridad y cumplimiento del Protocolo de Soberanía Nexus. |
| **[Spec Architect](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Spec_Architect/SKILL.md)** | *Cuando el usuario diga 'crea una especificación', 'planifica esta feature' o use el comando '/specify'.* | Genera y valida archivos de especificación (.spec.md) siguiendo el estándar SDD v2.0. |
| **[Nexus QA Engineer](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/Testing_Quality/SKILL.md)** | *Cuando pida crear tests, probar una feature o corregir bugs.* | Especialista en Pytest Asyncio y Vitest para arquitecturas aisladas. |
| **[TiendaNube Commerce Bridge](file:///C:/Users/Asus/Downloads/Platform AI Solutions/.agent/skills/TiendaNube_Commerce_Bridge/SKILL.md)** | *tiendanube, tienda nube, e-commerce, products, orders, oauth, catalog, store* | Especialista en integración con Tienda Nube: OAuth, sincronización de catálogo, órdenes y gestión de productos. |
