# Guía Definitiva de Despliegue en EasyPanel (Arquitectura Microservicios)

Esta guía explica en profundidad cómo funciona el despliegue de este proyecto en EasyPanel, desmitificando conceptos de puertos, redes internas y variables de entorno. Puedes usar esta lógica para replicar la arquitectura en cualquier otro proyecto.

## 1. Conceptos Fundamentales

Para entender el despliegue, imagina que EasyPanel es un "Director de Orquesta" que gestiona varios contenedores Docker (tus servicios).

### A. Puertos: El Secreto Mejor Guardado
Hay dos tipos de puertos que debes distinguir claramente:

1.  **Puerto del Contenedor (Internal Port):** Es el puerto donde *escucha* tu aplicación dentro de su "burbuja".
    *   *Ejemplo:* Tu `orchestrator_service` está programado en Python/FastAPI para escuchar en el puerto `8000`.
    *   *En Dockerfile:* Verás `EXPOSE 8000` o en el comando de inicio `uvicorn ... --port 8000`.
    *   **En EasyPanel:** Se configura en la sección **"App Service" -> "Port"**. ¡Este número debe coincidir EXACTAMENTE con el de tu código!

2.  **Puerto Público (Public Domain):** Es la "puerta de entrada" desde internet.
    *   EasyPanel se encarga de esto automáticamente. Cuando asignas un dominio (ej. `api.tu-proyecto.com`), EasyPanel recibe el tráfico en el puerto 80/443 (estándar web) y lo redirige internamente al **Puerto del Contenedor**.

### B. Comunicación Interna vs. Externa
*   **Comunicación Interna (Red Docker):** Los servicios dentro del mismo "Project" en EasyPanel pueden hablarse por su **Nombre del Servicio**. Es más rápido y seguro porque el tráfico no sale a internet.
    *   *Sintaxis:* `http://[nombre-servicio-easypanel]:[puerto-interno]`
    *   *Ejemplo:* El `frontend` llama al `orchestrator` internamente (si usara SSR) o el `orchestrator` llama al `whatsapp_service` usando `http://whatsapp_service:8002`.

*   **Comunicación Externa (Public URL):** Cuando el navegador del usuario (Frontend React) necesita hablar con el Backend.
    *   Aquí NO puedes usar nombres internos. Debes usar la URL pública: `https://api.tu-proyecto.com`.

---

## 2. Tu Arquitectura Actual (Mapa de Despliegue)

Basado en tu `docker-compose.yml`, así es como se traslada a EasyPanel. Cada bloque a continuación debe ser un "Service" en EasyPanel.

### Servicio 1: `orchestrator_service` (El Cerebro)
*   **Tipo:** App Service
*   **Imagen/Build:** Dockerfile en `./orchestrator_service`
*   **Puerto del Contenedor:** `8000`
*   **Dominios:** Asigna uno, ej. `server.tudominio.com`
*   **Variables Clave:**
    *   `POSTGRES_DSN`: `postgresql://user:pass@postgres:5432/db` (Nota el uso del nombre de servicio `postgres`)
    *   `REDIS_URL`: `redis://redis:6379`
    *   `WHATSAPP_SERVICE_URL`: `http://whatsapp_service:8002` (Comunicación interna)
    *   `META_SERVICE_URL`: `http://meta_service:8000`

### Servicio 2: `platform_ui` (Frontend React)
*   **Tipo:** App Service
*   **Imagen/Build:** Dockerfile en `./frontend_react`
*   **Puerto del Contenedor:** `80` (Nginx suele servir en el 80)
*   **Dominios:** Tu dominio principal, ej. `app.tudominio.com`
*   **Variables BUILD (Muy Importante):** En React/Vite, estas variables se "queman" en el código al momento de construir (Build). En EasyPanel, agrégalas en la pestaña "Environment" pero asegúrate de que esten disponibles durante el "Build".
    *   `VITE_API_BASE_URL`: La URL **PÚBLICA** de tu orchestrator (ej. `https://server.tudominio.com`). *El navegador del usuario no tiene acceso a la red interna de Docker, por eso necesita la pública.*

### Servicio 3: `whatsapp_service`
*   **Tipo:** App Service
*   **Puerto del Contenedor:** `8002`
*   **Variables:**
    *   `ORCHESTRATOR_URL`: `http://orchestrator_service:8000` (Interna está bien aquí porque es backend-to-backend).

### Servicios de Base de Datos
*   **Postgres y Redis:** En EasyPanel, simplemente crea servicios de tipo "Database" (Postgres y Redis). EasyPanel te dará la URL de conexión interna automáticamente.

---

## 3. Detección Automática de URLs (Cómo hacerlo dinámico)

Para que no tengas que cambiar configuraciones manualmente entre Local y Producción, usa estas estrategias:

### En el Backend (Python/Node)
Usa variables de entorno con valores por defecto.

```python
import os

# Intenta obtener la variable del entorno (EasyPanel), si no existe, usa localhost (Local)
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8000")
```

Muchos frameworks como FastAPI permiten usar archivos `.env`. EasyPanel inyecta estas variables automáticamente si las configuras en la pestaña "Environment".

### En el Frontend (React/Vite)
Aquí es un poco más truculento porque el código se ejecuta en el navegador del cliente.

1.  **Detección Relativa (Mejor Opción si están en el mismo dominio):**
    Si tu frontend y backend están servidos por el mismo Nginx (reverse proxy), puedes hacer peticiones a `/api/...` y el navegador usará el dominio actual automáticamente.

2.  **Variables de Entorno (Tu caso actual):**
    Usas `VITE_API_BASE_URL`. Para automatizarlo, puedes tener un script de entrada (`entrypoint.sh`) en tu Dockerfile de Nginx que reemplace un placeholder en los archivos `.js` compilados justo antes de iniciar.
    
    *Truco Pro para Frontend en Docker:*
    En lugar de quemar la URL en el build, haz que Nginx sirva un archivo `config.js` generado al vuelo que contenga `window.ENV = { API_URL: "..." }`. Así, cambiar la variable en EasyPanel cambia la configuración sin reconstruir.

---

## 4. Checklist para Aplicarlo a Otro Proyecto

Si vas a desplegar un nuevo proyecto, sigue estos pasos:

1.  **Dockeriza todo:** Asegúrate de que cada servicio tenga un `Dockerfile` que exponga un puerto (EXPOSE).
2.  **Crea el Project en EasyPanel.**
3.  **Crea la Base de Datos primero:** (Postgres/Redis/MySQL) para obtener sus URLs de conexión internas.
4.  **Despliega el Backend:**
    *   Configura el puerto (ej. 3000, 8000).
    *   Pega la URL de la base de datos en las variables de entorno.
    *   Asigna un dominio público si el Frontend lo necesita.
5.  **Despliega el Frontend:**
    *   Configura la variable `API_URL` apuntando al dominio público del Backend que acabas de desplegar.
6.  **Red Interna:**
    *   Si tienes microservicios que solo hablan entre ellos (ej. un worker que procesa imágenes), NO les asignes dominio público. Deja que se comuniquen por la red interna de Docker (`http://nombre-servicio:puerto`). Esto es mucho más seguro.

## Resumen de Variables de Entorno Comunes

| Variable | Dónde se usa | Valor Típico en EasyPanel |
| :--- | :--- | :--- |
| `PORT` | En tu código | El puerto donde escucha tu app (ej. 8000). |
| `DATABASE_URL` | Backend | `postgres://user:pass@nombre-servicio-db:5432/db` |
| `REDIS_URL` | Backend | `redis://nombre-servicio-redis:6379` |
| `API_URL` | Frontend | `https://api.tudominio.com` (Pública) |
| `INTERNAL_API_URL` | Backend-to-Backend | `http://nombre-servicio:puerto` (Privada) |
