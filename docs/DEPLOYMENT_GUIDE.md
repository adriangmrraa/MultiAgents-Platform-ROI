# Deployment Guide - Nexus v5.12 (EasyPanel + Supabase)

This guide details the definitive environment configuration for the Nexus RAG system.

## 1. Supabase Connection (Vector Storage)

The connection to the Supabase vector database requires a specific configuration to avoid resolution issues within a private network.

- **Variable**: `SUPABASE_DB_URL`
- **Use**: Direct SQL Access (Debugging/Maintenance).
- **Critical Configuration**: 
  - **DO NOT** use the container hostnames (e.g., `db`, `supabase`).
  - You **MUST** use the internal IP of the `db` container.
- **Format**:
  ```text
  postgresql://postgres:REAL_PASSWORD@INTERNAL_IP:5432/postgres?sslmode=disable
  ```

### 1.1 HTTP REST API (Active Operations)
The system primarily uses the **HTTPS Interface** for Vector Ingestion and Deletion to bypass port blocks.
- **Variable**: `SUPABASE_URL` (e.g., `https://supabase.your-domain.com`)
- **Variable**: `SUPABASE_SERVICE_KEY` (The `service_role` key, bypasses RLS).

## 2. Main Application Database (Users & Metadata)

- **Variable**: `POSTGRES_DSN`
- **Configuration**: This connection can use the internal hostname (e.g., `multiagents_postgres`).
- **Security**: Ensure `POSTGRES_PASSWORD` matches the actual database password, not the dashboard login.

## 3. Large File Uploads (413 Payload Too Large)

To allow uploads up to **50MB** (required for large PDFs/Documents), you must configure the ingress/proxy.

### EasyPanel / Traefik
Add the following labels to your `orchestrator_service` in EasyPanel:
```text
traefik.http.middlewares.limit.buffering.maxRequestBodyBytes=50000000
```
Then, ensure the middleware is applied to the service's router.

### Nginx (Internal)
If you have an internal Nginx proxy:
```nginx
client_max_body_size 50M;
```

## 3. Deployment Summary

1. Configure `SUPABASE_DB_URL` with the internal IP.
2. Configure `POSTGRES_DSN` for the orchestrator.
3. Verify that all AI provider keys (OpenAI/Google) are set in the environment.
4. Deploy the services via EasyPanel.
