# 🏬 Hangar: Gestión de Tiendas (Stores Logic Deep Dive)

Este documento detalla la lógica de `Stores.tsx`, el panel de administración donde se crean y configuran las unidades de negocio (Tenants).

---

## 🏗️ Arquitectura Multi-Tenant

En Nexus, una "Tienda" no es solo un registro en una tabla. Es un **Contexto de Ejecución Aislado**.
-   Tiene sus propios Agentes.
-   Tiene su propia Memoria Vectorial (RAG).
-   Tiene su propia configuración de Herramientas.

### Componentes Clave
1.  **Deployment Wizard**: Formulario de alta de nueva tienda.
2.  **Prompt Refiner (AI)**: Asistente que reescribe descripciones humanas pobres en instrucciones de sistema robustas.
3.  **Tool Configurator**: Sub-sistema para personalizar el comportamiento de las tools por tienda.

---

## 🔄 Flujo de Datos

### 1. Gestión del Ciclo de Vida (CRUD)
-   **Endpoint**: `/admin/tenants` (`GET`, `POST`, `PUT`, `DELETE`).
-   **Dato Crítico**: `bot_phone_number`. Este es el ID único para la red de WhatsApp. Si dos tiendas comparten número, el sistema colapsará (violación de uniqueness en DB).

### 2. Refinamiento de Prompt con IA
Los usuarios suelen escribir descripciones cortas ("Vendo zapatos"). Nexus lo arregla:
-   **Acción**: Click en botón "IA: Refinar".
-   **Endpoint**: `POST /admin/ai/improve-prompt`
-   **Lógica**:
    -   Backend llama a LLM con: `context: 'catalog', input: "Vendo zapatos"`.
    -   LLM devuelve: "Somos una boutique especializada en calzado... Marcas: Nike, Adidas...".
    -   **Resultado**: El frontend actualiza el estado `store_description` o `store_catalog_knowledge` automáticamente.

### 3. Configuración de Herramientas (The Tuning Fork)
Cada tienda vende distinto. El modal de herramientas permite ajustar la táctica.
-   **Endpoint**: `GET/POST /admin/tenants/{id}/tools/config`
-   **Estructura JSONB**:
    ```json
    {
      "search_products": {
        "tactical": "Priorizar productos en oferta.",
        "response_guide": "Mencionar siempre el envío gratis."
      }
    }
    ```
-   **Inyección en Runtime**: Cuando el agente de esta tienda invoca una herramienta, el orquestador inyecta estas instrucciones tácticas en el prompt de la herramienta ("System Injection").

### 4. Human Handoff (Email)
-   **Configuración**: `handoff_enabled` + `handoff_target_email`.
-   **Dependencia**: Requiere que exista una credencial SMTP válida asignada a esta tienda (o global). De lo contrario, la derivación fallará silenciosamente o logueará error en backend.

---

## ⚠️ Puntos Críticos

1.  **Tienda Nube Token**: No se valida en tiempo real al guardar, pero si es inválido, el "Magic Onboarding" fallará más adelante.
2.  **Eliminación en Cascada**: Borrar una tienda (`DELETE`) triggera un borrado en cascada en la DB:
    -   Borra Agentes asociados.
    -   Borra Historial de Chats.
    -   Borra Assets generados.
    -   **Irreversible**.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

### 1. Formulario Crítico (`Stores.tsx`)
El formulario de alta/edición maneja mucha data sensible.
*   **Estado Frontend**: `formData` (tipo `Tenant`).
*   **Validaciones**:
    *   `bot_phone_number`: Debe ser único.
    *   `tiendanube_store_id`: Debe ser numérico (string parseable).

### 2. Endpoints & Payloads

#### A. AI Prompt Refinement
*   **Request**: `POST /api/admin/ai/improve-prompt`
*   **Body**: `{ "text": "vendo zapatillas", "context": "catalog" }`
*   **Response**: `{ "refined_text": "Tienda especializada en footwear..." }`
*   **Timeout**: Esta llamada invoca a GPT-4, puede tardar 5-10 segundos. El botón se deshabilita (`improving !== null`) para evitar doble click.

#### B. Tool Configuration
*   **Request**: `POST /api/admin/tenants/{id}/tools/config`
*   **Body (JSONB)**: Se guarda tal cual en la columna `tool_config` de PostgreSQL.
    ```json
    {
      "search_products": { "tactical": "..." }
    }
    ```
*   **Error Potencial**: Enviar un JSON inválido (aunque `JSON.stringify` lo previene en JS).

#### C. Handoff Email
*   **Trigger**: No hay endpoint específico, se guarda en el `PUT /tenants/{id}` principal.
*   **Backend Logic**: Al recibir `handoff_enabled: true`, el backend NO valida SMTP en ese instante. El error surgirá solo en tiempo de ejecución (cuando el usuario pida "hablar con humano").

### 3. Errores de Base de Datos (Integridad Referencial)
*   **Error 500 al Borrar**: `Foreign key violation`.
    *   Aunque el backend implementa `cascade`, a veces tablas externas (como logs) no tienen la FK configurada.
    *   *Fix*: Asegurar que todas las relaciones en `models.py` tengan `cascade="all, delete"`.

