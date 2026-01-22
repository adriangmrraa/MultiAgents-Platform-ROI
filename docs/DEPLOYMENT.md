# Nexus v5.4 Deployment Guide (EasyPanel + Supabase)

Este documento detalla el proceso de puesta en marcha del Core en entornos de producción soberanos.

## 1. Infraestructura Base

### Base de Datos RAG (Supabase)
Nexus requiere una instancia de Supabase con `pgvector` habilitado.
1.  En EasyPanel, crea un servicio de Supabase o utiliza uno externo.
2.  **Identificación de IP**: Si el orquestador no resuelve el hostname, entra a la consola del servicio DB y ejecuta `hostname -i`. Usa esa IP en `SUPABASE_DB_URL`.
3.  **Credenciales**: Necesitarás la `service_role_key` y la contraseña de `postgres`.

## 2. Configuración de Servicios

### Bootstrapper Automático
Al arrancar el servicio **Orchestrator**, el sistema ejecutará automáticamente:
*   Creación de la extensión `vector` si no existe.
*   Generación de la tabla `documents` optimizada para el `tenant_id`.
*   Migración de esquemas de agentes y credenciales.

### Zero-Dependency Startup
El sistema arrancará aunque no configures `OPENAI_API_KEY`. Esto permite que el Admin entre al dashboard y configure las llaves de los clientes de forma segura.

## 3. Troubleshooting (Solución de Problemas)

| Error | Causa Probable | Solución |
| :--- | :--- | :--- |
| `could not translate host name` | Fallo de DNS interno en Docker/EasyPanel. | Cambia el hostname por la **IP Interna** en el `.env`. |
| `RAG_DB_ERROR: 404` | Credenciales de Supabase inválidas o servicio Kong caído. | Verifica `SUPABASE_URL` y la `SERVICE_KEY`. |
| `Execution Paused: Missing...` | El agente no tiene una API Key asignada (Tenant o Global). | Carga la credencial en Settings o añade un fallback al `.env`. |

## 4. Reparación Manual
Si algo falla en la base de datos RAG, puedes forzar una reinicialización limpia llamando a:
`GET /admin/system/init-db?token=tu_admin_token`
