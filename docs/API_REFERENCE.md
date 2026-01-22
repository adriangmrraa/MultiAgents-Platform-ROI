# API Reference: System & Management (Nexus v5.4)

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
        { "id": "gpt-5-mini", "tier": "economy", "ui_metadata": { ... } },
        { "id": "o3-high", "tier": "premium", "ui_metadata": { ... } }
      ]
    }
    ```

### 🔧 Inicialización de DB RAG
`GET /admin/system/init-db`

Disparador manual para el bootstrapper de Supabase/pgvector.
*   **Auth**: Requiere `X-Admin-Token`.
*   **Uso**: En caso de errores de "Table not found" o migraciones corruptas.

## Agentes (Gestión v5.4)

### 🤖 Crear Agente
`POST /admin/agents`
*   **Validación**: El campo `model_version` es validado contra el registry. Si el modelo no existe, se asigna `gpt-5-mini` automáticamente.

### 🔄 Actualizar Agente
`PUT /admin/agents/{id}`
*   **Intelligent Sync**: Si cambias a un modelo **Premium**, el sistema ajustará automáticamente los timeouts de respuesta en el `agent_service`.
