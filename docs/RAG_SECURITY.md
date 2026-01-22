# RAG Security - Isolation Protocol (Nexus v5.11)

Protocol for ensuring strict multi-tenancy and preventing cross-user data leaks.

## 1. Database Level (Supabase/pgvector)

Isolation is enforced by the `match_documents` SQL function. 

- **Mechanism**: Use of the `@>` operator to filter JSONB metadata.
- **Rule**: The function ignores any document fragment whose metadata does not contain the key-value pair provided in the search filter.

## 2. Application Level (Orchestrator & Agent)

The backend code is strictly bound by two "Mandamientos":

### Mandamiento de Guardado
> "Nunca guardarás un documento sin poner `user_id` en su metadata."

- **Execution**: Every ingestion routine (Catalog, Web, PDFs) automatically injects `current_user.id` into the metadata dictionary before sending it to the vector store.

### Mandamiento de Búsqueda
> "Nunca llamarás a `similarity_search` sin pasar `filter={'user_id': ...}`."

- **Execution**: Both the `search_rag` endpoint and the Agent Specialists are required to provide the session `user_id`. Any attempt to search without this context results in a blocked request or an empty response.

## 3. Identity Verification

- **UUIDs**: All `user_id` values are handled as v4 UUIDs to prevent enumeration attacks and ensure global uniqueness across the SaaS platform.
