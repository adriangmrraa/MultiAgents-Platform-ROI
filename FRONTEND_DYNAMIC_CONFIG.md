# Estrategia de Configuración Dinámica en Frontend (`frontend_react`)

> **Estado**: `Production Ready` | **Estrategia**: `Runtime Injection` | **Framework**: `Vite + React`

Para garantizar la portabilidad del contenedor Docker (`build once, deploy anywhere`), el frontend no "quema" las variables de entorno durante el build. En su lugar, las resuelve dinámicamente en el navegador del usuario.

## 1. El Problema: Docker vs. REACT_APP_
En un build tradicional de React, `import.meta.env.VITE_API_URL` se reemplaza por texto estático al ejecutar `npm run build`. Esto obliga a reconstruir la imagen para cada entorno (Staging, Prod, Cliente X).

## 2. La Solución: Triple Redundancia

El hook `useApi.ts` implementa una estrategia de resolución de 3 capas para encontrar al Backend:

### Capa 1: Inyección Explícita (Runtime)
Si el contenedor inyecta un objeto global `window.env` (usando un script `env.sh` al inicio de Nginx), este tiene prioridad absoluta.
```typescript
const RUNTIME_API = window.env?.API_BASE_URL;
```

### Capa 2: Variables de Entorno (Vite)
Si no hay inyección en runtime, se usa la variable definida en EasyPanel/Docker.
```typescript
const ENV_API = import.meta.env.VITE_API_BASE_URL;
```

### Capa 3: Inferencia Inteligente (Self-Hosting)
Si todo falla, el frontend "adivina" dónde está el backend basándose en su propio dominio.

*   Si estoy en `app.midominio.com` -> Backend en `api.midominio.com`
*   Si estoy en `frontend.midominio.com` -> Backend en `orchestrator.midominio.com`
*   Si estoy en `localhost` -> Backend en `http://localhost:3000` (BFF)

---

## 3. Implementación Actual (`src/hooks/useApi.ts`)

```typescript
function detectApiBase() {
    // 1. Localhost (Desarrollo)
    if (window.location.hostname === 'localhost') return 'http://localhost:3000';

    // 2. Legacy / EasyPanel Auto-Discovery
    const host = window.location.hostname;
    
    // Regla: "frontend" -> "orchestrator"
    if (host.includes('frontend')) {
        return window.location.protocol + '//' + host.replace('frontend', 'orchestrator');
    }

    // Default: Asumir que existe un proxy inverso en /api
    return '/api';
}
```

## 4. Guía para Nuevos Entornos

Si despliegas en un nuevo servidor, solo asegúrate de configurar estas variables en EasyPanel/Docker:

*   `VITE_ADMIN_TOKEN`: Debe coincidir con el `ADMIN_TOKEN` del backend.
*   `VITE_API_BASE_URL`: (Opcional) Solo si la inferencia automática falla.

---

> **Nota**: Esta arquitectura permite que el mismo contenedor `frontend_react:latest` funcione instantáneamente en cualquier despliegue nuevo sin reconfiguración manual.
