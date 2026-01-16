# 🧠 Base de Conocimiento (RAG Logic Deep Dive)

Este documento detalla la lógica de `Knowledge.tsx`, la interfaz donde los usuarios "enseñan" al cerebro del agente subiendo documentos PDF, TXT o DOCX.

---

## 🏗️ Arquitectura de Ingesta

La "Base de Conocimiento" no es un file server. Es un pipeline de **ETL (Extract, Transform, Load)** que convierte documentos físicos en vectores matemáticos.

### Componentes Clave
1.  **Ingestion API**: Endpoint multipart para recepción de archivos.
2.  **Vector Store (ChromaDB)**: Base de datos vectorial donde vive el "conocimiento".
3.  **Indexing Worker**: Componente asíncrono que procesa el texto en segundo plano.

---

## 🔄 Flujo de Datos

### 1. Upload e Indexación
El usuario arrastra un archivo PDF.
1.  **Frontend**: Llamada a `POST /admin/knowledge/upload` con `FormData`.
2.  **Backend (Fase 1 - Recepción)**:
    -   Valida extensión y tamaño (<10MB).
    -   Guarda el archivo crudo en disco (`/storage/tenants/{id}/...`).
    -   Crea registro en SQL con status `processing`.
3.  **Backend (Fase 2 - Vectorización)**:
    -   Extrae texto (usando `PyPDF2` o `unstructured`).
    -   Divide en "chunks" de 500-1000 tokens (Token Splitter).
    -   Llama a OpenAI (`text-embedding-3-small` o `ada-002`) para generar vectores.
    -   Inserta vectores en ChromaDB con metadatos `{ source: filename, tenant_id: 123 }`.
4.  **Completion**: Actualiza el status SQL a `active`.

### 2. Eliminación (Olvido)
Cuando el usuario borra un archivo:
-   **Frontend**: `DELETE /admin/knowledge/{id}`.
-   **Backend**:
    -   Borra el registro SQL.
    -   Borra el archivo físico.
    -   **Crítico**: Ejecuta `chroma.delete(where={"source": filename})` para eliminar el "conocimiento" del cerebro. Si esto falla, el bot seguiría recordando el documento borrado (Zombie Knowledge).

---

## ⚡ Formatos Soportados

| Formato | Procesador | Uso Ideal |
| :--- | :--- | :--- |
| **PDF** | `PyPDF2` | Manuales de producto, políticas de envío. |
| **TXT** | Nativo | Listas de precios simples, scripts crudos. |
| **DOCX** | `python-docx` | Documentos internos editables. |
| **MD** | Nativo | Documentación técnica estructurada. |

---

## 🛡️ Soberanía de Datos

El sistema RAG implementa **Aislamiento Estricto**:
-   Cada Inquilino tiene su propia colección (o namespace) en ChromaDB.
-   Cuando el Agente Bibliotecario busca, agrega un filtro obligatorio: `where={"tenant_id": current_tenant_id}`.
-   Esto garantiza que el manual de "Tienda A" nunca aparezca en las respuestas de "Tienda B".

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

El sistema RAG es intensivo en recursos.

### 1. Manejo de Archivos
*   **Estado Frontend**: `uploading` (boolean). Deshabilita el botón mientras sube.
*   **Límite Backend**: 10MB por archivo (configurado en Nginx/Traefik y FastAPI).
    *   *Error*: `413 Request Entity Too Large` si se excede.

### 2. Endpoints Code-Level

#### A. Upload
*   **Request**: `POST /api/admin/knowledge/upload`
*   **Content-Type**: `multipart/form-data`
*   **Body Field**: `file` (Binary).
*   **Timeout**: Puede tardar hasta 30 segundos si el archivo es grande, ya que el backend hace la extracción de texto síncrona inicial antes de delegar la vectorización a BackgroundTasks.

#### B. List Files
*   **Request**: `GET /api/admin/knowledge/list`
*   **Response**:
    ```json
    [
      {
        "id": "uuid",
        "filename": "manual.pdf",
        "status": "active", // o "processing" / "error"
        "file_size": 102400
      }
    ]
    ```

### 3. Vector Database (Chroma)
*   **Internal Access**: El contenedor de ChromaDB corre en puerto 8000 internamente, pero NO está expuesto públicamente.
*   **Depuración**: Si los archivos quedan en `processing` eternamente:
    *   Revisar logs del pod `orchestrator`: `docker logs orchestrator`.
    *   Buscar `OpenAI Rate Limit` (error 429) o `ChromaDB Connection Error`.
    *   El Worker de vectorización no reintenta automáticamente en v5.1.

