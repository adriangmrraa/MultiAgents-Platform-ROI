# 🤝 Guía de Operaciones Nexus v3.3 (Manual de Vuelo)

Este documento es el manual operativo para el despliegue, mantenimiento y uso diario de la plataforma.

-------

## 1. Alta de Nuevos Clientes (Onboarding)

Gracias a la **UI Unificada**, ya no es necesario tocar la base de datos manualmente.

### Paso A: Registro en Dashboard
1.  Ingresa a tu dominio `https://app.tusistema.com`.
2.  Navega a **"Mis Tiendas"**.
3.  Click en **"New Store"**.
4.  Llena los datos esenciales:
    *   **Nombre de Tienda**: Identificador visual.
    *   **WhatsApp**: Número (sin `+`, ej `54911...`).
    *   **Tienda Nube ID & Token**: Credenciales API.
    *   **System Prompt**: Define la personalidad (ej. "Eres un vendedor experto en zapatos...").
5.  **Guardar**. El sistema validará y cifrará las credenciales automáticamente.

### Paso B: Conexión WhatsApp (YCloud)
1.  En el dashboard de YCloud, configura el **Webhook URL**:
    *   `https://api.tusistema.com/chat/webhook`
2.  Verifica que el `PHONE_NUMBER_ID` en YCloud coincida con el registrado en el Tenant.
3.  Envía un mensaje de prueba ("Hola"). Deberías ver respuesta en segundos.

---

## 2. Gestión de Credenciales

Si necesitas rotar claves o actualizar tokens:
1.  Ve a **"Credenciales"** en el menú lateral.
2.  Busca la credencial por nombre (ej. `TIENDANUBE_ACCESS_TOKEN`).
3.  Usa el botón **Editar** para actualizar el valor.
    *   *Nota*: Los valores se muestran enmascarados (`***`) por seguridad.
4.  Para eliminar, usa el icono de **Papelera**.

---

## 3. Monitorización y Telemetría

El sistema incluye herramientas de diagnóstico en tiempo real bajo el menú **"Live History"**.

*   **Live Telemetry**: Logs en vivo del sistema. Útil para ver si un webhook llegó o si OpenAI falló.
    *   *Nota*: Las contraseñas y API Keys se ocultan automáticamente (`***`).
*   **Thinking Log**: En el chat de prueba, verás un icono 🧠. Haz click para ver el "Razonamiento Oculto" del agente antes de responder.
*   **Estadísticas**: En "Métricas Avanzadas", verás latencias y códigos de estado (200, 401, 500).

---

## 4. Protocolo de Emergencia (Troubleshooting)

### Caso: "El bot no responde"
1.  Revisa **Live History**. ¿Llegó el evento `webhook_received`?
    *   **NO**: El problema es YCloud o el Webhook URL está mal.
    *   **SI**: El problema es interno.
2.  ¿Error `Redis Connection`?
    *   El sistema activará el "Modo Degradado" (DB directa). El bot seguirá funcionando pero más lento. Reinicia el contenedor de Redis.

### Caso: "Error 401 Unauthorized en Dashboard"
1.  Verifica que el `VITE_ADMIN_TOKEN` en las variables de entorno del Frontend COINCIDA con el `ADMIN_TOKEN` del Orchestrator.
2.  Redespliega ambos servicios si haces cambios.

### Caso: "Veo pantalla blanca"
*   Puede ser un problema de cache del navegador tras una actualización.
*   Pide al usuario hacer `Ctrl + Shift + R` (Hard Reload).

---

**© 2025 Platform AI Solutions - Operations Division**
