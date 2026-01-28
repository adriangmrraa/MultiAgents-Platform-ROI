# Guía Maestra de Despliegue en EasyPanel (Nexus v5.9)

Este documento detalla el proceso para desplegar la plataforma desde cero, asegurando la conectividad entre servicios y la integridad de la base de datos RAG.

## 1. Configuración de Variables de Entorno

La plataforma utiliza una arquitectura de "Doble Base de Datos" que debe configurarse correctamente en EasyPanel.

### A. La Dualidad de Supabase
Debes configurar estas dos variables en el servicio `orchestrator`:

1.  **`POSTGRES_DSN`**: Utilizada para la base de datos principal de la aplicación (Usuarios, Sesiones, Login). 
    *   *Formato*: `postgresql+asyncpg://postgres:[PASSWORD]@[IP_INTERNA]:5432/postgres`
2.  **`SUPABASE_DB_URL`**: Conexión SQL directa (Opcional/Legacy).
    *   *Formato*: `postgresql://postgres:[PASSWORD]@[IP_INTERNA]:5432/postgres?sslmode=disable`
3.  **Credenciales HTTP (CRÍTICAS)**: El motor de borrado e ingesta (RAG) opera vía **REST API** (Puerto 443) para evitar bloqueos.
    *   **`SUPABASE_URL`**: Endpoint HTTPS.
    *   **`SUPABASE_SERVICE_KEY`**: Llave maestra (`service_role`).

### B. El Problema de la Red (IP vs Hostname)
En entornos EasyPanel, los nombres de host como `db` o `supabase-db` a veces no se resuelven correctamente desde el inicio.
*   **Solución**: Identifica la IP interna del contenedor de base de datos.
*   **Comando**: Entra a la consola del servicio de DB y ejecuta `hostname -i`.
*   **Acción**: Reemplaza el nombre de host en tus URLs por esa IP (ej. `172.18.0.5`).

## 2. Configuración de CORS
Para que el Frontend pueda hablar con el Backend:
1.  Busca la variable **`ALLOWED_ORIGINS`** en el servicio `orchestrator`.
2.  Agrega la URL de tu frontend **sin barra final**.
    *   *Ejemplo*: `https://multiagents-frontend.yn8wow.easypanel.host`
3.  El sistema incluye por defecto `localhost:3000` y `localhost:5173` para desarrollo.

## 3. Auto-Inicialización (Self-Healing)
A partir de la versión v5.9, el sistema intentará crear las tablas automáticamente en segundo plano. 
*   No bloquea el inicio del servidor.
*   Realiza hasta 10 intentos automáticos.
*   Si falla, revisa los logs buscando `background_db_setup_failed`.

## 4. Verificación Post-Despliegue
Una vez desplegado, visita esta URL para verificar manualmente el estado de la base de datos de vectores:
`https://[TU-ORCHESTRATOR-URL]/admin/system/init-db`

Si recibes un JSON con `status: ok`, la plataforma está lista para procesar conocimiento.
