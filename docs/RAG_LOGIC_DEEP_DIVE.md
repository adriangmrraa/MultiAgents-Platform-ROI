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

### 2. Eliminación (Olvido - Hard Delete)
Cuando el usuario borra un archivo, se ejecuta un proceso atómico de 3 pasos (Hard Delete Sincronizado):
1.  **Supabase Vector Delete**: Se eliminan los vectores filtrando por `metadata={'source': filename}`. Esto es crítico para evitar "Zombie Knowledge".
2.  **File System Purge**: Se borra el archivo físico del disco.
3.  **SQL Delete**: Solo si los pasos anteriores tienen éxito, se elimina el registro de la base de datos PostgreSQL.

Este flujo asegura que no queden datos huérfanos ni en el vector store ni en el disco.

---

## 3. Arquitectura de Colecciones

El sistema ahora organiza los documentos en agrupaciones lógicas (`collection`) para segmentar el conocimiento:

*   **General**: Documentos técnicos, manuales y políticas generales (PDF/DOCX).
*   **ADN Personal (Chats)**: Historiales de conversación (.txt) usados para la clonación de estilo y entrenamiento de personalidad.

## 4. El Parser de WhatsApp (Identity Engine)

Al subir un archivo `.txt` a la colección **ADN Personal**, se dispara el `WhatsAppParser`.

*   **Input**: Archivo crudo + `hero_name` (Nombre del usuario/marca en el chat).
*   **Lógica**: El parser discrimina entre:
    *   **Contexto**: Lo que dijeron otros participantes.
    *   **Estilo**: Lo que dijo el Héroe (usado para entrenar al agente en mimetismo).
*   **Vectorización**: Se generan pares de contexto/respuesta para stored patterns.

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

