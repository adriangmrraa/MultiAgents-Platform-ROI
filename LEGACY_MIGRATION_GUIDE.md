# 🦅 Guía de Migración de UI (Legacy -> React)

> **Objetivo**: Recuperar la funcionalidad "Huérfana" de la antigua `platform_ui` e implementarla en `frontend_react` con estándares modernos (TypeScript, Tailwind/CSS Modules, Context API).

Esta guía divide la carga de trabajo en **Macro-Fases** y **Micro-Pasos** ejecutables.

---

## 🏗️ Fase 1: Fundamentos y Modales Globales
*El objetivo es preparar el escenario para funcionalidades complejas sin romper lo existente.*

- [ ] **1.1. Sistema de Modales Global (Context)**
    - [ ] Crear `src/contexts/ModalContext.tsx` para manejar el estado de apertura/cierre cualquier modal desde cualquier lugar.
    - [ ] Crear componente base `components/ui/Modal.tsx` con estilos glassmorphism (portados de `style.css`).
    - [ ] Implementar `NotificationModal` (para reemplazar `showNotification` de app.js).

- [ ] **1.2. Paridad en `useApi.ts`**
    - [ ] Portar la lógica completa de `detectApiBase` de `app.js` (líneas 13-35) a `useApi.ts`. La versión actual en React es demasiado simple.
    - [ ] Agregar soporte para `x-tenant-id` header dinámico en las peticiones.

---

## 💬 Fase 2: Módulo de Chats (Human Handoff)
*Esta es la funcionalidad más crítica que falta: la capacidad de ver conversaciones y tomar el control manual.*

- [ ] **2.1. Vista de Lista (`ChatList.tsx`)**
    - [ ] Crear endpoint dummy o real en backend para `GET /admin/chats/summary`.
    - [ ] Portar HTML de `view-chats` (líneas 200-211 de index.html).
    - [ ] Implementar polling (cada 5s) para actualizar lista.

- [ ] **2.2. Ventana de Chat (`ChatWindow.tsx`)**
    - [ ] Portar estructura de chat (burbujas, avatares) de CSS legacy.
    - [ ] Implementar `GET /admin/chats/{phone}/history`.
    - [ ] Implementar Toggle "Human Override" (`POST /admin/handoff/toggle`).

- [ ] **2.3. Input y Envío Manual**
    - [ ] Crear input de texto y botón enviar.
    - [ ] Conectar a `POST /admin/whatsapp/send` (Endpoint existente en backend, verificar acceso).

---

## ⚙️ Fase 3: Configuraciones Avanzadas (Orphaned Modals)
*Recuperar los "Settings" que permitían la autonomía del usuario.*

- [ ] **3.1. Modal de YCloud (`YCloudConfig.tsx`)**
    - [ ] Portar formulario de `view-ycloud`.
    - [ ] Endpoint: `POST /admin/credentials` (Category: YCloud).

- [ ] **3.2. Modal de Meta API (`MetaConfig.tsx`)**
    - [ ] Portar el Wizard de 7 pasos (UI puramente informativa + inputs finales).
    - [ ] Endpoint: `POST /admin/credentials` (Category: WhatsApp API).

- [ ] **3.3. Configuración de SMTP (Email)**
    - [ ] Crear formulario dentro de `Settings.tsx` o un modal dedicado.
    - [ ] Guardar en tabla `tenants` (columna `smtp_config` JSON).

---

## 📊 Fase 4: Analytics Profundo
*Actualmente solo tenemos "placeholders". Necesitamos los gráficos reales.*

- [ ] **4.1. Integración de Recharts**
    - [ ] Instalar `recharts`.
    - [ ] Implementar gráfico de "Conversaciones por Día" (`BarChart`).
    - [ ] Implementar gráfico de "Intents" (`PieChart`).

- [ ] **4.2. KPIs Reales**
    - [ ] Conectar `Dashboard.tsx` con endpoint real de agregación (`/admin/analytics/summary`).
    - [ ] Calcular "Tasa de Éxito" basada en `system_events`.

---

## 🛠️ Fase 5: Mantenimiento y Herramientas (Tooling)
*Gestión de las Tools que usa el Agente.*

- [ ] **5.1. CRUD de Tools**
    - [ ] Vista `Tools.tsx` ya existe, pero confirmar funcionalidad completa (Edit/Delete).
    - [ ] Agregar editor JSON para configuración de herramientas HTTP.

- [ ] **5.2. Consola de Streaming**
    - [ ] Mejorar `Logs.tsx` para usar SSE real (`/admin/diagnostics/events/stream`) en lugar de polling.
    - [ ] Portar filtros de severidad y tipo (Debug, Info, Error).

---

## 📝 Procedimiento de Ejecución Sugerido

Para cada **Micro-Paso**, sigue este ciclo:

1.  **Analyze**: Lee el código legacy (`app.js` + `index.html`) para entender INPUTS y OUTPUTS.
2.  **Scaffold**: Crea el componente React vacío con la estructura HTML portada.
3.  **Style**: Aplica las clases de `index.css` (Glassmorphism).
4.  **Logic**: Implementa `useApi` para conectar los datos.
5.  **Verify**: Compara visualmente con la versión legacy.
