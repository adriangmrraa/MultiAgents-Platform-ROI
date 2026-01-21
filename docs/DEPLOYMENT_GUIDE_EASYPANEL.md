# Guía de Despliegue en EasyPanel (Arquitectura de Microservicios)

Esta guía explica cómo replicar el despliegue de **Platform AI Solutions** en **EasyPanel** para un nuevo proyecto. La arquitectura se basa en microservicios dockerizados orquestados que se comunican internamente.

## 1. Concepto General

En EasyPanel, no desplegamos un solo "monolito", sino que creamos un **Proyecto** que contiene múltiples **Servicios (Apps)**. Cada servicio de nuestro `docker-compose.yml` se convierte en una "App" dentro de EasyPanel.

*   **Red Interna**: EasyPanel conecta automáticamente todos los servicios dentro del mismo proyecto, permitiendo que se hablen entre sí usando su nombre de servicio (ej: `http://orchestrator_service:8000`).
*   **Base de Datos**: Usamos los servicios de base de datos nativos de EasyPanel (Postgres y Redis).

---

## 2. Estructura de Servicios

Para replicar este proyecto, deberás crear las siguientes aplicaciones en tu proyecto de EasyPanel:

### A. Base de Datos e Infraestructura (Crear primero)

1.  **PostgreSQL 14+**
    *   **Nombre**: `postgres`
    *   **Uso**: Base de datos principal y Bóveda de Credenciales.
    *   **Configuración**: Anota la `Internal Connection URL` (ej: `postgres://postgres:password@postgres:5432/postgres`).

2.  **Redis**
    *   **Nombre**: `redis`
    *   **Uso**: Cache, Colas de mensajes (Celery/RQ) y PubSub para eventos en tiempo real.
    *   **Configuración**: Anota la `Internal Connection URL` (ej: `redis://redis:6379`).

---

### B. Microservicios (Backend)

Para cada uno, crea una **App** en EasyPanel, selecciona "GitHub" (o tu fuente de código) y configura:

#### 1. Orchestrator Service (Cerebro Central)
*   **Source Path / Context**: `./orchestrator_service` (o raíz si es repo único)
*   **Dockerfike Path**: `Dockerfile`
*   **Build Type**: Dockerfile
*   **Port**: `8000` (Exponer al público si recibe webhooks directos, o mantener interno y usar `bff` si existe).
*   **Environment Variables**:
    *   `POSTGRES_DSN`: URL interna de Postgres.
    *   `REDIS_URL`: URL interna de Redis.
    *   `ADMIN_TOKEN`: Token para asegurar endpoints administrativos.
    *   `ENCRYPTION_KEY`: Clave Fernet generada para la bóveda de secretos.
    *   `WHATSAPP_SERVICE_URL`: `http://whatsapp_service:8002`
    *   `META_SERVICE_URL`: `http://meta_service:8000`

#### 2. WhatsApp Service (Comunicación)
*   **Source Path**: `./whatsapp_service`
*   **Port**: `8002`
*   **Environment Variables**:
    *   `ORCHESTRATOR_URL`: `http://orchestrator_service:8000`
    *   `REDIS_URL`: URL interna de Redis.
    *   `YCLOUD_API_KEY`, `META_VERIFY_TOKEN`: Credenciales específicas.

#### 3. Meta Service (Diplomático)
*   **Source Path**: `./meta_service`
*   **Port**: `8000` (Interno) / `8004` (Externo si se mapea diferente, pero en EasyPanel el puerto contenedor es lo que importa).
*   **Environment Variables**:
    *   `ORCHESTRATOR_URL`: `http://orchestrator_service:8000`
    *   `INTERNAL_SECRET_KEY`: Token compartido con el orquestador.

---

### C. Frontend (UI)

#### Platform UI (React/Vite)
*   **Source Path**: `./frontend_react` (o raíz del front)
*   **Build Method**: Dockerfile (Recomendado) o Nixpacks.
*   **Port**: `80` (El contenedor expone 80, EasyPanel lo mapea a 443 HTTPS).
*   **Environment Variables (Build Time)**:
    *   A diferencia del backend, estas variables se "cocinan" en la imagen al construir.
    *   `VITE_API_BASE_URL`: URL pública de tu Orchestrator (ej: `https://api.tu-proyecto.com`) o del BFF. **Importante**: El navegador del usuario no puede acceder a `http://orchestrator_service:8000`, necesita la URL pública (dominio HTTPS).

---

## 3. Configuración de Dominios

En la pestaña "Domains" de cada servicio en EasyPanel:

1.  **Frontend**: Asigna tu dominio principal (ej: `app.tu-dominio.com`).
2.  **Orchestrator**: Asigna el dominio de API (ej: `api.tu-proyecto.com`).
    *   Habilita HTTPS/SSL.
3.  **Otros servicios**: Si reciben webhooks externos (ej: WhatsApp), asigna dominio (ej: `wa.tu-proyecto.com`). Si son solo internos, no hace falta dominio público.

## 4. Diferencias Clave Docker-Compose vs EasyPanel

| Docker Compose Dev | EasyPanel Prod |
| :--- | :--- |
| `API_BASE_URL=http://localhost:8000` | `API_BASE_URL=https://api.tu-dominio.com` |
| Red `bridge` local | Red del Proyecto (aislada) |
| Volúmenes locales (`./data`) | Volúmenes Persistentes (Configurar en pestaña "Storage") |

### Persistencia (Volúmenes)
Para el **Orchestrator** (si usa RAG local o logs) y **Postgres**, asegúrate de configurar "Mounts" en EasyPanel para que los datos no se pierdan al redesplegar:
*   Postgres: `/var/lib/postgresql/data`
*   Orchestrator: `/app/data` (si guarda bases vectoriales locales).

---

## Resumen para aplicar a otro proyecto

1.  Crea un **Proyecto** en EasyPanel.
2.  Levanta **Postgres** y **Redis** desde Plantillas.
3.  Agrega cada microservicio como **App**, apuntando a su carpeta en el repo (`./service-name`).
4.  Carga las **Variables de Entorno** apuntando a los nombres de servicio internos (`postgres`, `redis`, `orchestrator_service`).
5.  Asigna **Dominios** públicos al Frontend y al Backend.
