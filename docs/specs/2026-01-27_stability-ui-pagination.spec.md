# Especificación Técnica: Estabilidad del Agente + UI Message Pagination (v6.2.8)

**Fecha**: 2026-01-27  
**Prioridad**: 🔴 CRÍTICA (Estabilidad) / 🟡 MEDIA (UX)  
**Estado**: Borrador para aprobación  

---

## 1. Objetivos de Negocio

### A. Estabilidad del Agente (Bug Fix)
Resolver el error `422 Unprocessable Entity` residual en el Agent Service que impide la entrega de respuestas a pesar de ser generadas. Asegurar que la comunicación entre Orchestrator y Agent sea 100% resiliente.

### B. Optimización de UI (Feature)
Implementar carga diferida (paginación) en el historial de chats. 
- **Problema**: El sistema carga todos los mensajes de una vez, lo que degrada el performance en conversaciones largas.
- **Solución**: Cargar de a 20-50 mensajes con opción de "Ver más" o scroll infinito inverso.

---

## 2. Análisis Técnico & Diagnóstico

### 2.1 El Error 422 Residual
A pesar de haber corregido los tipos de datos en la v6.2.7, persisten errores 422. Esto sugiere:
1.  **Fallo de Validación en el Stream**: Errores durante el `astream_events` que el Orchestrator no maneja correctamente.
2.  **Mismatch de Cabeceras**: El `X-Internal-Secret` podría estar fallando en ráfagas.
3.  **Esquema Pydantic**: Alguna variante de modelo (ej. `gpt-5-mini`) podría estar enviando flags no contempladas.

### 2.2 Paginación de Mensajes
- **Backend (Orchestrator)**: Modificar `GET /admin/chats/{chat_id}/messages` para aceptar `limit` y `offset`.
- **Frontend (React)**: 
  - Estado `offset` para mensajes.
  - Botón "Cargar mensajes anteriores" al tope de la lista.
  - Mantener posición de scroll al cargar.

---

## 3. Esquemas de Datos

### 3.1 API Orchestrator (Modificado)
`GET /admin/chats/{chat_id}/messages?limit=50&offset=0`

**Response (JSON)**:
```json
[
  {
    "id": "uuid",
    "role": "user | assistant | system",
    "content": "text...",
    "timestamp": "ISO-8601",
    "attachments": [...]
  }
]
```

---

## 4. Lógica de Negocio (Gherkin)

### Escenario: El usuario ve una conversación larga
```gherkin
Dado que una conversación tiene 200 mensajes
Cuando el usuario selecciona el chat
Entonces el frontend solicita solo los últimos 50 mensajes
Y muestra un botón "Cargar anteriores" al inicio del chat.
```

### Escenario: El usuario carga más mensajes
```gherkin
Dado que el usuario está viendo los 50 mensajes más recientes
Cuando hace clic en "Cargar anteriores"
Entonces el frontend solicita los mensajes 51 al 100
Y los agrega al principio de la lista sin perder la posición de scroll actual.
```

---

## 5. Plan de Acción

### Fase 1: Hardening del Agent Service
1.  **Logging de Validación**: Implementar un `exception_handler` para `RequestValidationError` en el Agent Service que muestre el JSON exacto que causó el 422.
2.  **Robustez en Stream**: Asegurar que `execute_agent` maneje timeouts de herramientas sin romper el stream SSE.

### Fase 2: Paginación Backend
1.  Actualizar la query SQL en `orchestrator_service/admin_routes.py` para soportar `LIMIT` y `OFFSET`.

### Fase 3: UI Pagination
1.  Modificar `frontend_react/src/views/Chats.tsx`.
2.  Implementar estado para mensajes previos.

---

## 6. Criterios de Aceptación
1.  ✅ Agent Service no devuelve 422 en condiciones normales.
2.  ✅ Los logs muestran el error detallado si ocurre un 422.
3.  ✅ La UI carga inicialmente 50 mensajes.
4.  ✅ Se pueden cargar mensajes más antiguos exitosamente.
5.  ✅ Las respuestas de IG/FB aparecen en tiempo real en la UI (Confirmar fix v6.2.7).
