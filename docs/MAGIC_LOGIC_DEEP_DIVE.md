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

#### 1. Agente 0: El Explorador (Product Fetcher)
*   **Acción**: Conexión multi-vía con `tiendanube-service`. Descarga productos, precios y categorías.
*   **Fallback**: Resiliencia automática vía Proxy si el servicio interno está bajo presión.

#### 2. Agente 1: Extractor de ADN (Brand DNA Analysis)
*   **Proceso**: Un LLM analiza la semántica para definir la **Voz de Marca**, **Arquetipo** y **Propuesta Única de Valor (UVP)**.
*   **Persistencia**: Guarda el activo tipo `branding` en la tabla `business_assets`.

#### 3. Agente 2: El Bibliotecario (RAG Vectorization)
*   **Acción**: Indexa el catálogo en la partición correspondiente de **Supabase**.
*   **Soberanía**: Asegura que el catálogo sea accesible solo por el `tenant_id` propietario.

#### 4. Agente 3: Director Creativo (Multimodal Fusion)
*   **Tecnología**: Google Gemini 3 (Multimodal Vision).
*   **Proceso**: Analiza fotos reales de productos y genera un "Visual Style Concept" que inyecta en los futuros prompts de generación de imágenes.

#### 5. Agente 4: Copywriter Maestro (Framework Specialist)
*   **Output**: Genera Scripts de ventas basados en **AIDA** y **PAS**, adaptados al tono del ADN de Marca.
*   **Persistencia**: Guarda el activo tipo `scripts`.

#### 6. Agente 5 y 6: Growth Architect & Social Strategist
*   **Growth**: Proyecciones de ROI y paquetes de upselling basados en precios de catálogo.
*   **Social**: Guía de pauta publicitaria para IG/FB Ads. Guardado como `visuals` y `roi`.

#### 7. Agente 7: Guardián de la Verdad (Compliance Guardian)
*   **Inspección**: Cruza los scripts y planes generados contra la base de datos de productos real para detectar alucinaciones de precios o stock.
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

