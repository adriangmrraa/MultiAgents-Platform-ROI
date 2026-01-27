# Rol: Product Owner (Propietario del Producto)

**Proyecto:** Platform AI Solutions (Nexus v6.0)  
**Enfoque Principal:** Ejecución, Priorización del Backlog y Calidad del Entregable.

El Product Owner es la voz del cliente dentro del equipo de desarrollo. Su aporte clave es traducir la visión de la "Fábrica de Negocios Autónoma" en requerimientos técnicos ejecutables y asegurar que lo que se construye aporte valor inmediato.

## Aportes Clave y Responsabilidades

### 1. Gestión del Backlog y Priorización
*   **Tarea:** Mantener el backlog de `orchestrator_service`, `agent_service` y `frontend` ordenado por valor.  
*   **Acción:** Decidir qué características entran en el Sprint (ej. "¿Hacemos primero la integración con Chatwoot o la generación de imágenes?"). Priorizar features que eliminen la fricción de contexto.

### 2. Definición de Historias de Usuario (User Stories)
*   **Tarea:** Desglosar requerimientos grandes en tareas pequeñas y claras.
*   **Ejemplo:** Transformar "El sistema debe generar anuncios" en:
    *   "Como usuario, quiero que el sistema descargue las fotos de mis productos..."
    *   "Como sistema, debo convertir imágenes a Base64 y enviarlas a Gemini..."
*   **Acción:** Definir los **Criterios de Aceptación** (Definition of Done) para cada tarea.

### 3. Validación y Aceptación (QA Funcional)
*   **Tarea:** Probar las funcionalidades apenas son entregadas por los desarrolladores.
*   **Acción:** Verificar que el "Magic Onboarding" realmente tarde < 60 segundos y que la identidad de marca generada sea coherente. Rechazar tareas que no cumplan los criterios.

## Flujo de Trabajo en ClickUp
*   **Vista:** Tablero Kanban (Sprints) y Lista de Backlog.
*   **Interacción:**
    *   **Creación:** Redacta los tickets/tareas con descripciones detalladas, adjuntando los documentos técnicos (`TECHNICAL_DEEP_DIVE_V6_0.md`).
    *   **Estado:** Mueve tareas de "Backlog" a "To Do" y valida las que están en "Review" para pasarlas a "Done".
    *   **Comunicación:** Responde dudas de los desarrolladores en los comentarios de las tareas para clarificar requerimientos.
