# 🤝 Guía de Operaciones Nexus v3.1 (Manual de Vuelo)

Este documento es el manual operativo para el despliegue, mantenimiento y uso diario de la plataforma. Está diseñado para Operadores y Administradores de Sistema.

### 3. Onboarding Ultra-Rápido & Business Ignition (v3.2)
*El "Manual de Vuelo" para el despliegue automático de valor.*

1.  **Conexión (The Trigger)**: Usuario conecta Tienda Nube.
2.  **Escaneo Multimodal**: El sistema "lee" la tienda (API) y el sitio web (HTML) para entender el ADN de la marca.
3.  **Activación Paralela**: Se disparan los 5 Iniciadores de Negocio simultáneamente:
    *   **Branding**: Extrae paleta y tipografía.
    *   **Guiones**: Redacta textos de venta persuasivos.
    *   **Visuals**: Genera conceptos para RRSS.
    *   **ROI**: Analiza el nicho de mercado.
    *   **Memoria**: Indexa todo en ChromaDB (RAG).
4.  **Entrega**: Los activos se materializan en la UI en tiempo real.

### 4. Flujo de Handoff (Derivación Humana)
*   **Trigger**: Usuario pide hablar con humano o Agente detecta frustración/incertidumbre.
*   **Acción**: `trigger_handoff` (Admin Ops).

---0----

## 1. Alta de Nuevos Clientes (Onboarding)

Gracias a la **UI Unificada (Nexus v3)**, ya no es necesario tocar la base de datos manualmente.

### Paso A: Registro en Dashboard
1.  Ingresa a tu dominio `https://app.tusistema.com`.
2.  Navega a **"Tenants"** (Tiendas).
3.  Click en **"New Tenant"**.
4.  Llena los datos esenciales:
    *   **Nombre de Tienda**: Identificador visual.
    *   **WhatsApp**: Número (sin `+`, ej `54911...`).
    *   **Tienda Nube ID & Token**: Credenciales API.
    *   **System Prompt**: Define la personalidad (ej. "Eres un vendedor experto en zapatos...").
5.  **Guardar**. El sistema validará y cifrará las credenciales automáticamente.

### Paso B: Ignite the Engine (v3.2)
1.  Navigate to `http://<your-domain>/nexus-setup`.
2.  Enter User Token (`admin-secret-99` or custom).
3.  Click **"Iniciar Motores"**.
4.  **Observe**:
    *   **Startup**: Maintenance Robot checks `business_assets` table.
    *   **Ingestion**: "Smart RAG" transforms `productsall` JSON into Semantic Vectors (check logs).
    *   **Visualization**: Progress bar hits 100% and Assets appear instantly (Redis Cache).

### Paso C: Conexión WhatsApp (YCloud)
1.  En el dashboard de YCloud, configura el **Webhook URL**:
    *   `https://api.tusistema.com/chat/webhook`
2.  Verifica que el `PHONE_NUMBER_ID` en YCloud coincida con el registrado en el Tenant.
3.  Envía un mensaje de prueba ("Hola"). Deberías ver respuesta en segundos.

---

## 2. Gestión de Agentes (Cerebro IA)

Ahora puedes tener múltiples agentes por tienda (Ventas, Soporte, Post-venta).

*   Ve a la pestaña **"Agents"**.
*   Edita el agente activo.
*   **Temperatura**: `0.3` para respuestas precisas (Ventas), `0.7` para creativas (Marketing).
*   **Herramientas**: Selecciona qué capacidades tiene (ej. `search_specific_products`).

---

## 3. Monitorización y Telemetría

El sistema incluye herramientas de diagnóstico en tiempo real bajo el menú **"Status"**.

*   **Analytics Summary**: Muestra conversaciones activas y tasa de derivación humana. (Cache 5 min).
*   **Live Telemetry**: Logs en vivo del sistema. Útil para ver si un webhook llegó o si OpenAI falló.
    *   *Nota*: Las contraseñas y API Keys se ocultan automáticamente (`***`).
*   **Thinking Log**: En el chat de prueba, verás un icono 🧠. Haz click para ver el "Razonamiento Oculto" del agente antes de responder.

---

## 4. Protocolo de Emergencia (Troubleshooting)

### Caso: "El bot no responde"
1.  Revisa **Telemetry**. ¿Llegó el evento `inbound_message`?
    *   **NO**: El problema es YCloud o el Webhook URL está mal.
    *   **SI**: El problema es interno.
2.  ¿Error `Redis Connection`?
    *   El sistema activará el "Modo Degradado" (DB directa). El bot seguirá funcionando pero más lento. Reinicia el contenedor de Redis.
3.  ¿Error `OpenAI Rate Limit`?
    *   Verifica tu crédito en OpenAI Platform. El sistema usará la Key del Tenant si existe, o la Global si no.

### Caso: "Error 502 Bad Gateway en Frontend"
*   El contenedor `orchestrator_service` se está reiniciando. El Nginx (Protocolo Omega) reintentará la conexión automáticamente cada 30 segundos. **Espera 1 minuto.**

### Caso: "Veo datos viejos o pantalla blanca"
*   Hemos actualizado la versión. Nginx debería forzar la recarga, pero si persiste, pide al usuario hacer `Ctrl + Shift + R` (Hard Reload).

--------

## 5. Mantenimiento de Base de Datos

El sistema use **Auto-Reparación (Schema Drift Prevention)**.
*   **Al reiniciar**, el orquestador verifica si faltan tablas o columnas (`customers`, `uuid`, etc.) y las crea.
*   **No necesitas correr scripts SQL manuales** para actualizaciones normales.

**© 2025 Platform AI Solutions - Operations Division**
