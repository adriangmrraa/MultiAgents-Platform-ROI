# 🦅 Informe de Migración de UI (Legacy -> React)

> **Estado**: ✅ Completado (100%)
> **Fecha**: 2025-12-25
> **Versión**: Nexus v3.4

Este documento detalla la lógica transferida, endpoint por endpoint, desde la antigua `platform_ui` (HTML/JS) hacia la nueva `frontend_react` (React/TypeScript). Muestra la equivalencia técnica exacta para fines de auditoría.

---

## 1. Módulo de Agentes (Agents)
**Propósito**: Gestión completa de los Agentes IA (prompts, modelos, herramientas).

| Característica | Legacy (`app.js`) | React (`Agents.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **Listar Agentes** | `loadAgents()` hace fetch a `/admin/agents` | `useApi('/admin/agents')` en `useEffect` | `GET /admin/agents` |
| **Crear/Editar** | Modal HTML `#modal-agent` + `saveAgent()` | Componente `<Modal>` + `handleSubmit` con `POST/PUT` | `POST /admin/agents`, `PUT /admin/agents/{id}` |
| **System Prompt** | Textarea plano | Textarea con fuente monoespaciada para código | Columna `system_prompt_template` en DB |
| **Tool Config** | Checkboxes manuales en HTML | Array `enabled_tools` gestionado en estado React | Columna `enabled_tools` (JSONB) |

**Lógica de Negocio Transferida**:
- Se mantuvo la distinción entre `provider` (OpenAI/Anthropic) y `model_version`.
- Se implementó la lógica de "Lazy Init" en backend: la tabla `agents` se crea automáticamente si no existe al hacer la primera petición GET.

---

## 2. Consola de Sistema (Console)
**Propósito**: Visualización en tiempo real de logs y eventos del sistema.

| Característica | Legacy (`view-console`) | React (`Console.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **Stream de Logs** | `EventSource` a `/admin/events/stream` | Simulación Robustez: Polling Inteligente a `/admin/logs` (Adaptado para entornos sin SSE estable) | `GET /admin/logs?limit=50` |
| **Filtros** | JS `filter()` sobre DOM elements | React State `filter` aplicado a array `events` | N/A (Client Side) |
| **Auto-Scroll** | JS `div.scrollTop = div.scrollHeight` | `useRef` + `scrollIntoView({ behavior: 'smooth' })` | N/A |
| **Colores** | Clases CSS `log-error`, `log-info` | Tailwind CSS Condicional (`text-red-500`, etc.) | N/A |

**Mejora React**:
- Se añadió un botón "Stream/Stop" para controlar el tráfico de red.
- Se añadió un input de búsqueda/filtro en tiempo real que no existía en Legacy con tanta fluidez.

---

## 3. Derivación Humana (Handoff)
**Propósito**: Configuración de reglas para cuando el bot cede el control a un humano.

| Característica | Legacy (`view-tools`) | React (`Handoff.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **Configuración** | Mezclado en "Tools" | Vista dedicada `/handoff` | `GET/POST /admin/handoff/{tenant_id}` |
| **Políticas (Rules)** | Checkboxes "Fitting", "Reclamo" | State `triggers` en objeto JSON | Columna `triggers` (JSONB) |
| **SMTP Config** | Inputs de texto plano | Campos con validación y mascara de password | Columna `smtp_password_encrypted` |

**Lógica de Negocio Transferida**:
- La lógica de "Policies" (triggers) se mantiene intacta: `rule_fitting`, `rule_reclamo`, etc.
- Se preserva la seguridad: El password SMTP nunca se devuelve al frontend (se muestra `********`).

---

## 4. Chats & Mensajería
**Propósito**: Interfaz tipo WhatsApp para el operador humano.

| Característica | Legacy (`view-chats`) | React (`Chats.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **Lista Chats** | `loadChats()` renderiza `<li>` | `chats.map()` con componente visual | `GET /admin/chats` |
| **Historial** | `loadChatHistory(phone)` inyecta HTML | `selectedPhone` state dispara fetch | `GET /admin/chats/{id}/messages` |
| **Envío Manual** | `sendMessage()` fetch a API | `handleSendMessage` con actualización optimista | `POST /admin/whatsapp/send` |
| **Human Override** | Botón "Take Control" | Toggle Switch "Modo Humano" | `POST /admin/conversations/{id}/human-override` |

**Mejora React**:
- **Actualización Optimista**: El mensaje aparece instantáneamente en la UI antes de la confirmación del servidor.
- **Indicadores Visuales**: Badges de estado (Bloqueado/Abierto) mucho más claros.

---

## 5. Analytics & KPIs
**Propósito**: Dashboard de métricas.

| Característica | Legacy (`view-analytics`) | React (`Analytics.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **Gráficos** | Librería externa o placeholders | CSS Grid/Flexbox Chart (Sin dependencias pesadas) | `GET /admin/analytics/summary` |
| **KPI Cards** | `loadAnalytics()` inyecta números | Componentes funcionales reusables | `GET /admin/analytics/summary` |

---

## 6. Configuraciones (Settings)
**Propósito**: Credenciales de YCloud y Meta.

| Característica | Legacy (`view-ycloud`) | React (`YCloudSettings.tsx` / `MetaSettings.tsx`) | Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **YCloud** | Formulario monolítico | Vista dedicada con validación | `POST /admin/credentials` |
| **Meta API** | Wizard parcial | Vista dedicada con estado de conexión | `POST /admin/credentials` |

---

## Conclusión

Se ha transferido el **100% de la lógica de negocio**. La aplicación React ahora es un superconjunto funcional de la antigua `platform_ui`, manteniendo la compatibilidad con los endpoints del backend (`orchestrator_service`) y mejorando significativamente la experiencia de usuario (UX), la mantenibilidad del código (TypeScript) y la robustez (Manejo de estados y errores).
