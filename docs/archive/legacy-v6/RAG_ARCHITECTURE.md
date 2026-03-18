# 📘 Módulo RAG & Knowledge Base: Arquitectura y Troubleshooting (v6.0)

## 1. Arquitectura de Doble Base de Datos (Hybrid DB Strategy)
El sistema opera bajo una arquitectura de microservicios que consume dos fuentes de datos distintas. Es crucial entender esta separación para evitar errores de "Falso Negativo" en operaciones CRUD.

* **Base de Datos Primaria (Local/Postgres):**
    * **Uso:** Auth, Usuarios, Chats, Logs y **Metadata visual** de los archivos.
    * **Tabla:** `rag_documents` (Contiene ID, Filename, TenantID).
    * **Conexión:** Variable `POSTGRES_DSN` (Vía `db.pool` con driver `asyncpg`).
    * **Rol:** Persistencia de estado de la aplicación y UI.
* **Base de Datos Vectorial (Remota/Supabase):**
    * **Uso:** Almacenamiento de Embeddings (Vectores) y búsqueda semántica.
    * **Tabla:** `documents` (Contiene content, metadata jsonb, embedding).
    * **Conexión:** Variable `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (Vía HTTP/REST).
    * **Rol:** Motor de búsqueda vectorial para la IA.

---

## 2. Flujo de Eliminación de Documentos (The "Dual Delete")
Para eliminar un documento correctamente, el sistema ejecuta una operación en dos pasos para garantizar la consistencia entre ambas bases de datos.

1.  **Paso 1: Borrado Vectorial (Remoto)**
    * Se recupera el `UUID` del archivo desde la DB Local.
    * Se realiza una petición **HTTP DELETE** a la API REST de Supabase.
    * **Filtro:** `metadata->>source_id = {UUID}`.
    * **Protocolo:** HTTP (Puerto 443). *Nota: No usamos conexión SQL directa (Puerto 5432) hacia Supabase debido a bloqueos de firewall/timeout en el entorno Docker.*
2.  **Paso 2: Borrado Metadatos (Local)**
    * Se elimina la fila en la tabla `rag_documents` de la DB local usando SQL directo.
    * Se intenta eliminar el archivo físico del disco (`/app/storage`) en un bloque `try/except`.

---

## 3. "Paredes contra las que chocamos" (Troubleshooting History)
Registro de problemas críticos resueltos y lecciones aprendidas durante la implementación de la v6.0.

* **🛑 Error: "Ghost Delete" (0 rows affected)**
    * **Causa:** El código intentaba borrar vectores conectándose a la DB Local (`db.pool`) en lugar de Supabase. Al no encontrar la tabla `documents` localmente (o estar vacía), no borraba nada.
    * **Solución:** Implementación de enrutamiento de base de datos dual (Context Switch).
* **🛑 Error: SQL Timeout (60s)**
    * **Causa:** Intentar conectar a Supabase vía driver SQL (`asyncpg`) por el puerto 5432 desde el contenedor Docker. La red interna bloqueaba la conexión persistente.
    * **Solución:** Cambio de estrategia a **HTTP REST API** (`httpx`), que usa el puerto 443 y es más tolerante a entornos de contenedores.
* **🛑 Error: "UndefinedColumn: file_path"**
    * **Causa:** La query SQL local solicitaba una columna `file_path` que no existía en el esquema actual de `rag_documents`.
    * **Solución:** Simplificación de la query para pedir solo `id`, `filename` y `tenant_id`.
* **🛑 Error: Redis Serialization (UUID)**
    * **Causa:** Intentar enviar un objeto `UUID` crudo a través de Redis/Websockets.
    * **Solución:** Convertir explícitamente el ID a string (`str(doc_id)`) antes del envío.

---

## 4. Configuración de Seguridad en Supabase (RLS)
Para proteger la base de datos vectorial de accesos no autorizados (públicos), pero permitir que el Backend (Orchestrator) opere libremente, se aplica la siguiente configuración de **Row Level Security (RLS)**.

### Variables de Entorno Requeridas (Backend)
* `SUPABASE_URL`: Endpoint HTTPS del proyecto.
* `SUPABASE_SERVICE_KEY`: Llave de rol de servicio (**Service Role**). *Crucial: Esta llave se salta las reglas RLS.*

### Script SQL de "Blindaje" (Ejecutar en Supabase SQL Editor)
Este script revoca permisos públicos y garantiza acceso total solo al Backend.

```sql
-- 1. Activar Seguridad a Nivel de Fila
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 2. Revocar acceso a usuarios anónimos y autenticados (Frontend directo)
REVOKE INSERT, UPDATE, DELETE ON TABLE documents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE documents FROM authenticated;

-- 3. Garantizar acceso total al Backend (Service Role)
-- El backend usa la Service Key, por lo que ignora RLS, pero estos permisos aseguran la base.
GRANT ALL ON TABLE documents TO service_role;
GRANT ALL ON TABLE documents TO postgres;

-- 4. Limpieza de políticas antiguas (Reset)
DROP POLICY IF EXISTS "Permitir acceso total" ON documents;
DROP POLICY IF EXISTS "Permitir todo" ON documents;

-- NOTA: No es necesario crear una política "ALLOW" para service_role, 
-- ya que este rol tiene privilegios de superusuario por defecto.
```

## 5. Mapa de Conexiones (Endpoints & Libraries)

| Acción | Base de Datos Objetivo | Método / Librería | Credencial Usada |
| :--- | :--- | :--- | :--- |
| Listar Archivos (UI) | Local Postgres | SQL (`asyncpg`) | `POSTGRES_DSN` |
| Subir Archivo (Ingest) | Supabase | HTTP (`langchain`/`supabase`) | `SUPABASE_SERVICE_KEY` |
| Borrar Vectores | Supabase | HTTP REST (`httpx`) | `SUPABASE_SERVICE_KEY` |
| Borrar Metadata | Local Postgres | SQL (`asyncpg`) | `POSTGRES_DSN` |
