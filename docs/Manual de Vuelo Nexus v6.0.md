# 🦅 Manual de Vuelo Nexus v6.0

> **Guía de Operaciones para Administradores de Plataforma**
> *Gestión Soberana, Monitoreo y Mantenimiento.*

---

## 1. Gestión de la Bóveda Soberana (Sovereign Vault)

El corazón de la v6.0 es la independencia de credenciales. Ya no toques el código para cambiar una llave.

### A. Rotación de Llaves (Key Rotation)
1.  Ve a **Settings > Credenciales**.
2.  Busca la categoría (ej: `openai`, `google`, `meta`).
3.  Edita la llave. El sistema la encriptará inmediatamente (AES-256).
4.  **Efecto:** Los agentes comenzarán a usar la nueva llave en su próxima interacción (Hot-Swap).

### B. Auto-Sedimentación (Primer Arranque)
Si es tu primera vez desplegando:
1.  Pon tus llaves maestras en el `.env` (solo por esta vez).
2.  Arranca los contenedores.
3.  Verifica los logs: `INFO: Auto-sedimentation complete for tenant 1`.
4.  **Limpieza:** Borra las llaves del `.env` para dejar el servidor "limpio".

---

## 2. Protocolo de Correo (Omega Hybrid)

Nexus v6.0 usa dos rutas de correo para evitar el SPAM y asegurar la entrega.

### A. System Path (Notificaciones Críticas)
*   **Uso:** Alertas de servidor, recuperación de contraseña de admin.
*   **Configuración:** Variables `SMTP_*` en el `docker-compose.yml`.
*   **Proveedor Recomendado:** Brevo o Resend (Puerto 587).

### B. Agent Path (Conversación con Clientes)
*   **Uso:** El bot envía resúmenes de pedido, tickets de soporte o handoffs.
*   **Configuración:** Cada tienda configura su propio SMTP en **Settings > Handoff**.
*   **Visibilidad Omega:** Si ves un cuadro amarillo "SMTP Error" en el dashboard, significa que la tienda tiene credenciales inválidas o su IP está en lista negra.

---

## 3. Meta & Web Uplink (Conexión Multicanal)

La integración ahora es omnicanal y se gestiona desde **Settings > Conexiones**.

### A. WhatsApp, FB e Instagram
1.  Clic en **Conectar con Meta**.
2.  El sistema sincroniza tus activos. Si es una re-autenticación, actualizará los tokens sin perder configuraciones.

### B. Web Widget (Nuevo en v6.0) 🌐
Si quieres un chat en tu página web:
1.  Ve a **Settings > Canal Web**.
2.  Configura el estilo (Colores, Radio de bordes, Mensaje de bienvenida).
3.  Copia el **Script de Instalación** y pégalo en el `<head>` de tu sitio.
4.  **Activación:** El widget aparecerá solo si el agente asignado tiene el canal "Web" encendido en el Wizard.

---

## 4. El Nuevo Wizard del Agente (Cerebro 2.0)

El Wizard es ahora el punto de control absoluto de cada "empleado digital".

### A. Selección de Canales
Dentro del Wizard, verás la sección **"¿Dónde trabajará este agente?"**.
*   Puedes marcar/desmarcar WhatsApp, Instagram, Facebook y Web.
*   **Nota:** Si un canal aparece en rojo ("Desconectado"), primero debes integrarlo en Settings.

### C. Galería de Modelos 2026 (SOTA)
Nexus v6.0 ahora permite elegir el "cerebro" específico para cada agente:
- **GPT-5 (Flagship/Mini)**: Ideal para ventas complejas y razonamiento clínico.
- **Gemini 3 (Pro/Flash)**: El mejor para análisis multimodales y grandes volúmenes de contexto (1M tokens).
- **Codex 2026**: Optimizado para agentes que deben realizar tareas técnicas o de "patching" de datos.

### B. Persistencia de URL y ADN
Nexus v6.0 asegura que la **URL de tu Web** y las **Reglas de Negocio** se guarden instantáneamente. No más pérdida de datos al recargar.

### C. Simulación en Tiempo Real (Fixed) 🧪
Usa el panel derecho para chatear con el agente antes de guardarlo.
*   Ahora el chat es fluido (Streaming) y detecta errores de esquema automáticamente.
*   Usa el contexto real de tu tienda para dar respuestas precisas.

---

## 5. Monitoreo y Salubridad

### Tablero de Control
*   **RAG Status:** Verde = Base de conocimiento vectorizada y lista. Amarillo = Indexando.
*   **Nexus Engine:** Verifica que el "Ignition" haya sido exitoso tras conectar TiendaNube.

### Logs de Auditoría
El sistema registra cada uso de herramienta y error crítico.
*   Ve a `/admin/logs` (si tienes acceso técnico) o revisa el **Activity Stream** en el Dashboard.

---

**© 2026 Platform AI Solutions - Flight Operations**

---

## 📚 Biblioteca Técnica de Profundización (Deep Dives)

Para entender la lógica atómica de cada módulo, consulta los siguientes documentos técnicos:

### Frontend Logic & Data Flow
*   [🪄 Magic Onboarding Logic](MAGIC_LOGIC_DEEP_DIVE.md) - El cerebro detrás de la ignición inicial.
*   [💬 Chats & Messaging Logic](CHATS_LOGIC_DEEP_DIVE.md) - Sincronización híbrida y polling multicanal.
*   [🤖 Agents Engine Logic](AGENTS_LOGIC_DEEP_DIVE.md) - Configuración de cerebros y herramientas.
*   [⚒️ Business Forge Logic](FORGE_LOGIC_DEEP_DIVE.md) - Edición y generación (Fusion) de activos.
*   [🧠 RAG & Knowledge Logic](RAG_LOGIC_DEEP_DIVE.md) - Ingesta y vectorización de documentos.
*   [🗼 Platform Tower (Analytics) Logic](ANALYTICS_LOGIC_DEEP_DIVE.md) - "God Mode" y telemetría global.

### Infrastructure & Settings
*   [🔐 Credentials & Vault Logic](SETTINGS_LOGIC_DEEP_DIVE.md) - Cifrado y gestión de secretos soberanos.
*   [🔗 Integrations (Meta/YCloud) Logic](INTEGRATIONS_LOGIC_DEEP_DIVE.md) - Wizards de conexión y Auth flows.
*   [🏬 Stores & Tenants Logic](STORES_LOGIC_DEEP_DIVE.md) - Gestión de contextos aislados.
