# Estrategia de Configuración Dinámica en Frontend (`platform_ui`)

Para eliminar la dependencia de variables "hardcodeadas" y permitir que una misma imagen de Docker funcione en cualquier entorno (Local, Dev, Prod) sin recompilar, se implementó una estrategia de **Inyección de Configuración en Tiempo de Ejecución**.

## 1. El Problema Original
En aplicaciones React/SPA tradicionales, las variables de entorno (como `REACT_APP_API_URL`) se "comen" (se reemplazan) en el momento del **Build**. Esto significa que si construyes la imagen en tu PC, la URL queda fija para siempre. Si luego despliegas en EasyPanel, la app intentará conectar a `localhost` o a lo que tenías al compilar.

## 2. La Solución Implementada: `window.env`

La solución consta de dos partes principales:

### Parte A: Script de Arranque (`env.sh`)
En lugar de servir solo archivos estáticos, el contenedor Docker ejecuta un pequeño script (`platform_ui/env.sh`) justo antes de iniciar Nginx.

Este script:
1.  Lee las variables de entorno reales del servidor/pod (`API_BASE`, `ADMIN_TOKEN`).
2.  Genera un archivo `env.js` en vivo y lo guarda en la carpeta pública del servidor web.
3.  El contenido de este archivo es algo como:
    ```javascript
    window.API_BASE = "https://orchestrator.tudominio.com";
    window.ADMIN_TOKEN = "tu_token_secreto";
    ```

**Resultado:** Cuando el navegador del usuario carga tu página, primero carga este `env.js` y el navegador "aprende" cuál es la URL correcta *en ese momento*.

### Parte B: Auto-Detección Inteligente (`app.js`)
Como capa de seguridad adicional (fallback), si por alguna razón `window.API_BASE` no está definido, el archivo `app.js` tiene una función inteligente `detectApiBase()`:

```javascript
function detectApiBase() {
    // 1. Prioridad: Lo que inyectó env.sh
    if (window.API_BASE) return window.API_BASE;

    const host = window.location.hostname;
    
    // 2. Si estoy en local, asumo puerto 8000
    if (host === 'localhost') return 'http://localhost:8000';

    // 3. Inferencia por nombre de dominio (Magia de EasyPanel)
    // Si la UI es "platform-ui.dominio.com", asume que la API es "orchestrator-service.dominio.com"
    if (host.includes('platform-ui')) {
        return window.location.protocol + '//' + host.replace('platform-ui', 'orchestrator-service');
    }
    
    // ... otras reglas de inferencia
}
```

## Beneficios
1.  **Build Once, Deploy Anywhere:** Puedes mover tu imagen Docker de un servidor a otro sin tocar el código.
2.  **EasyPanel Friendly:** Aprovecha las variables de entorno que configuras en el panel de control.
3.  **Resiliente:** Si olvidas configurar la variable, intenta "adivinar" la ubicación de la API basándose en convenciones de nombres comunes.
