# API Reference: System & Management (Nexus v6.0)

## Infraestructura y Control

### 🌐 Registro de Modelos 2026
`GET /admin/system/available-models`

Devuelve la lista de modelos de IA soportados, categorizados por su capacidad.
*   **Auth**: Requiere `X-Admin-Token`.
*   **Respuesta**:
    ```json
    {
      "default_model": "gpt-5-mini",
      "models": [
        { "id": "gpt-5.2", "tier": "flagship", "name": "GPT-5.2 (Flagship)" },
        { "id": "gpt-5-mini", "tier": "economy", "name": "GPT-5 Mini" },
        { "id": "gpt-5.2-pro", "tier": "premium", "name": "GPT-5.2 Pro" },
        { "id": "gpt-5.2-codex", "tier": "advanced", "name": "GPT-5.2 Codex" },
        { "id": "gemini-3-pro", "tier": "advanced", "name": "Gemini 3 Pro" },
        { "id": "gemini-3-flash", "tier": "economy", "name": "Gemini 3 Flash" }
      ]
    }
    ```

### 🔧 Inicialización de DB RAG
`GET /admin/system/init-db`

Disparador manual para el bootstrapper de Supabase/pgvector.
*   **Auth**: Requiere `X-Admin-Token`.
*   **Uso**: En caso de errores de "Table not found" o migraciones corruptas.

## Agentes (Gestión v6.0)

### 🤖 Crear Agente
`POST /admin/agents`
*   **Validación**: El campo `model_version` es validado contra el registry. Si el modelo no existe, se asigna `gpt-5-mini` automáticamente.

### 🔄 Actualizar Agente
`PUT /admin/agents/{id}`
*   **Evolución v6.0 Payload**:
    *   `model_provider`, `model_version` y `enabled_tools` viven en la **raíz** del JSON.
    *   `config` (JSONB) encapsula parámetros dinámicos: `reasoning_effort`, `text_verbosity`, `agent_tone`.
*   **Intelligent Sync**: Si cambias a un modelo **Premium/Flagship**, el sistema ajustará automáticamente los timeouts y filtros de razonamiento.

## Gestión de Conocimiento (Knowledge v6.0)

### 📤 Upload Document (RAG)
`POST /admin/knowledge/upload`
*   **Content-Type**: `multipart/form-data`
*   **Parámetros**:
    *   `file`: (Binary) Archivo PDF, DOCX, TXT.
    *   `collection`: (String) Nombre de la colección (ej. 'General', 'ADN Personal').
    *   `hero_name`: (String, Opcional) Nombre del Héroe para el `WhatsAppParser` si la colección es de identidad.

### 🗑️ Delete Document
`DELETE /admin/knowledge/{id}`
*   **Comportamiento Destructivo**: Esta operación es **irreversible** en Supabase.
*   **Performance**: Puede tardar 1-2 segundos en retornar mientras limpia los vectores embebidos del clúster de Supabase (pgvector).
