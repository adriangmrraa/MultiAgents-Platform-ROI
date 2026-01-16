# 🪄 Lógica de "Hacer Magia" (Nexus Generic Flow)

Este documento detalla el flujo técnico extremo a extremo de la funcionalidad `MagicOnboarding` ("Hacer Magia"). Describe cómo el sistema transforma una URL y credenciales básicas en una fuerza de ventas de IA completamente configurada.

---

## 🏗️ Resumen Arquitectónico

La "Magia" no es un solo script, sino una orquestación compleja de **7 Agentes Especializados** coordinados por el `NexusEngine` bajo el **Protocolo Omega** (Streaming en tiempo real).

### Actores Principales
1.  **Frontend (`MagicOnboarding.tsx`)**: Interfaz reactiva que consume eventos SSE (Server-Sent Events).
2.  **API (`admin_routes.py`)**: Punto de entrada de ignición.
3.  **NexusEngine (`app/core/engine.py`)**: El cerebro que ejecuta la secuencia lógica.
4.  **RAG Core (`app/core/rag.py`)**: El bibliotecario vectorial.
5.  **Redis (Pub/Sub)**: El canal de comunicación en tiempo real.

---

## 🔄 Flujo Paso a Paso

### Paso 1: La Ignición (Frontend -> Backend)
El usuario ingresa ID de Tienda, Token y hace clic en "Ignition".
*   **Request**: `POST /admin/onboarding/magic`
*   **Payload**: `{ store_name, tiendanube_store_id, tiendanube_access_token, ... }`
*   **Lógica Backend**:
    1.  **Encriptación**: Cifra el token de acceso con AES-256 (`Fernet`).
    2.  **Upsert Tenant**: Crea o actualiza el registro en la tabla `tenants`.
    3.  **Spawn Agents**: Inserta los 5 agentes estándar ("Ventas", "Soporte", "Talles", "Logística", "Supervisor") en la tabla `agents`.
    4.  **Background Task**: Lanza `NexusEngine(tenant_id).ignite()` en segundo plano para no bloquear la UI.

### Paso 2: El Enlace Omega (Frontend Stream)
Inmediatamente después del POST, el frontend se conecta al flujo de datos:
*   **Conexión**: `EventSource /api/admin/engine/stream/v2/{tenant_id}`.
*   **Mecanismo**: El frontend se queda escuchando. El backend publicará logs ("Thinking...") y activos ("Asset Generated") a través de Redis.

### Paso 3: Ejecución Secuencial ("The Magnificent Seven")
El `NexusEngine` toma el control y ejecuta la siguiente secuencia:

#### 0. Preparación de Contexto (Sovereign Chek)
*   Recupera las credenciales de **OpenAI** y **Google** específicas del inquilino desde la Bóveda de Credenciales (`credentials` table).
*   Si no existen, usa las del sistema (si está configurado el fallback).

#### 1. Agente 0: El Explorador (Product Fetch)
*   Intenta conectar con el microservicio `tiendanube-service` via red interna Docker.
*   Si falla, intenta conexión directa a la API de Tienda Nube.
*   **Resultado**: Un JSON con el catálogo de productos (Nombre, Precio, Imágenes).

#### 2. Agente 1: Extractor de ADN (Brand Analysis)
*   **Input**: Nombres de productos, descripción de la tienda.
*   **Proceso**: Un LLM (GPT-4o-mini) analiza la semántica para deducir:
    *   **Voz de Marca**: (Ej: "Sofisticada, Minimalista").
    *   **Arquetipo**: (Ej: "El Creador").
    *   **UVP**: Propuesta Única de Valor.
*   **Persistencia**: Se guarda en `business_assets` (type: `branding`) y se envía al Stream UI.

#### 3. Agente 2: El Bibliotecario (RAG Ingestion)
*   **Acción**: Toma los productos descargados y los convierte en vectores (embeddings).
*   **Almacenamiento**: ChromaDB (local/persistente).
*   **Optimización**: Si ya existen vectores para este tenant, salta este paso para velocidad ("Smart Skip").

#### 4. Agente 3: Director Creativo (Multimodal)
*   **Tecnología**: Google Gemini 2.5 + Imagen 3.
*   **Proceso**:
    1.  Toma las imágenes de los productos (Top 3).
    2.  Lee el ADN de Marca (Paso 2).
    3.  Genera un "Prompt de Fusión" (Producto + Estilo de Marca).
    4.  Crea assets visuales simulados o mejorados.

#### 5. Agente 4: Copywriter Maestro
*   **Tecnología**: GPT-4o.
*   **Frameworks**: Aplica fórmulas AIDA (Atención, Interés, Deseo, Acción) y PAS (Problema, Agitación, Solución).
*   **Output**: Genera Scripts de ventas y mensajes de bienvenida personalizados.

#### 6. Agente 5 y 6: Estrategia (Growth & Social)
*   **Paralelismo**: Se ejecutan simultáneamente.
*   **Growth**: Calcula proyecciones de ROI basadas en precios.
*   **Social**: Define formatos óptimos para IG/FB/WA.

#### 7. Agente 7: Guardián de la Verdad (Compliance)
*   **Misión**: Filtro final de calidad.
*   **Verificación**: Asegura que no se inventaron precios (alucinaciones) cruzando los datos generados contra el catálogo real.
*   **Señal Final**: Envía el evento `compliance` que le dice al frontend "Proceso Terminado, redirigir al Dashboard".

---

## 💾 Persistencia de Datos

Todos los artefactos generados ("Magia") se guardan doblemente:
1.  **Bóveda SSOT (`business_assets`)**: Persistencia dura en PostgreSQL.
2.  **Stream Efímero**: Para visualización inmediata en la UI.

Esto asegura que si el usuario recarga la página, la "Magia" no se pierde, sino que se recupera de la base de datos.
    
---

## 🔬 Especificaciones Técnicas (Debugging Guide)

### 1. Protocolo SSE (Server-Sent Events)
*   **Conexión Frontend**: `new EventSource('/api/admin/engine/stream/v2/{tenant_id}')`.
*   **Eventos Escuchados**:
    *   `log`: Mensaje de texto plano del proceso (ej: "Analizando productos...").
    *   `asset_generated`: Payload JSON complejo con el activo creado.
    *   `error`: Notificación de fallo crítico.
    *   `done`: Señal de finalización para detener el spinner.

### 2. Endpoints & Payloads

#### A. Disparo Inicial (Ignite)
*   **Request**: `POST /api/admin/onboarding/magic`
*   **Body**:
    ```json
    {
      "tiendanube_token": "...",
      "tiendanube_user_id": 123
    }
    ```
*   **Respuesta Inmediata**: `202 Accepted` (Background Task iniciada).

#### B. Flujo de Datos (Stream)
*   **Formato de Evento**:
    ```text
    event: asset_generated
    data: {"type": "branding", "content": {"mission": "..."}}
    
    event: log
    data: {"step": 2, "message": "Creando estrategias..."}
    ```
*   **Punto de Falla Crítico**: Si Nginx/Traefik tiene buffering activado, los eventos llegarán todos juntos al final en lugar de una a uno.
    *   *Solución*: Header `X-Accel-Buffering: no` en el backend.

### 3. Errores Comunes
*   `EventSource failed`: Error de red o CORS.
*   `429 Resource Exhausted`: La API de Google Gemini/OpenAI rechazó la solicitud por exceso de cuota. El frontend mostrará un toast rojo.
*   **Canvas en Blanco**: Si el stream termina pero no hay assets, es probable que `JSON.parse(event.data)` haya fallado en un payload malformado.

