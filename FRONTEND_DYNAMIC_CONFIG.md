# Estrategia de Inyección de Configuración (Nexus v4.0)

> **Estado**: `Stable` | **Estrategia**: `Build-Time Injection` | **Framework**: `Vite + Docker`

Para garantizar la seguridad y el rendimiento, Nexus v4.0 utiliza una inyección de variables durante la fase de construcción (Build Time). Esto evita que el frontend "adivine" configuraciones y asegura que el token de administración esté sellado dentro del bundle de JavaScript.

## 1. El Flujo de Construcción

1. **Easypanel** envía los `Build Arguments` al `Dockerfile`.
2. El `Dockerfile` captura estos argumentos (`ARG`) y los exporta como variables de entorno (`ENV`).
3. **Vite** lee estas variables y las reemplaza estáticamente en el código fuente durante `npm run build`.
4. El servidor **Nginx** sirve los archivos resultantes.

## 2. Variables Requeridas

| Variable | Descripción |
| :--- | :--- |
| `VITE_ADMIN_TOKEN` | El token secreto para autenticar peticiones al Orquestador. |
| `VITE_API_BASE_URL` | La URL pública (HTTPS) donde vive el Orquestador. |

## 3. Resolución de API (`useApi.ts`)

Aunque se use inyección en build-time, el hook `useApi` mantiene mecanismos de resiliencia:

1. **Prioridad Local**: Si detecta `localhost`, apunta automáticamente al puerto `3000` (BFF local).
2. **Prioridad Inyectada**: Usa `VITE_API_BASE_URL` para despliegues de producción.
3. **Fallback Relativo**: Usa `/api` si no hay URL definida, delegando el ruteo al proxy inverso de Nginx.

## 4. Guía de Reparación de Errores 401

Si ves "Invalid Admin Token" en la consola:
1. Verifica que el `ADMIN_TOKEN` en el Orquestador sea idéntico al `VITE_ADMIN_TOKEN` del Frontend.
2. Asegúrate de haber agregado los valores en la sección **Build Arguments** de Easypanel, no solo en Environment.
3. Realiza un **Redeploy** manual del frontend para reconstruir el bundle con los nuevos valores.

---

**© 2025 Platform AI Solutions - Nexus Frontend Architecture**
