# 🦅 Manual de Vuelo Nexus v5.1

> **Guía de Operaciones para Administradores de Plataforma**
> *Gestión Soberana, Monitoreo y Mantenimiento.*

---

## 1. Gestión de la Bóveda Soberana (Sovereign Vault)

El corazón de la v5.1 es la independencia de credenciales. Ya no toques el código para cambiar una llave.

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

Nexus v5.1 usa dos rutas de correo para evitar el SPAM y asegurar la entrega.

### A. System Path (Notificaciones Críticas)
*   **Uso:** Alertas de servidor, recuperación de contraseña de admin.
*   **Configuración:** Variables `SMTP_*` en el `docker-compose.yml`.
*   **Proveedor Recomendado:** Brevo o Resend (Puerto 587).

### B. Agent Path (Conversación con Clientes)
*   **Uso:** El bot envía resúmenes de pedido, tickets de soporte o handoffs.
*   **Configuración:** Cada tienda configura su propio SMTP en **Settings > Handoff**.
*   **Visibilidad Omega:** Si ves un cuadro amarillo "SMTP Error" en el dashboard, significa que la tienda tiene credenciales inválidas o su IP está en lista negra.

---

## 3. Meta Uplink (Conexión WhatsApp/FB/IG)

La integración con Meta ahora es visual y segura.

### A. Wizard de Onboarding
1.  Clic en **Conectar con Meta**.
2.  Completa el flujo en el popup de Facebook (usa "Embedded Signup" para crear WABAs nuevos si lo necesitas).
3.  Al cerrar, se abrirá el **Wizard de Selección**.
4.  Marca las casillas de las Páginas, Cuentas de IG y Números de WhatsApp que quieres activar.
5.  **Confirmar:** Solo los activos seleccionados serán escuchados por el bot.

### B. Regeneración de Tokens
Si Meta invalida tu token (pasa cada 60 días o por seguridad):
1.  Solo haz clic en "Conectar con Meta" nuevamente.
2.  El sistema detectará que es una re-autenticación y actualizará la credencial en la bóveda sin duplicar activos.

---

## 4. Monitoreo y Salubridad

### Tablero de Control
*   **RAG Status:** Verde = Base de conocimiento vectorizada y lista. Amarillo = Indexando.
*   **Nexus Engine:** Verifica que el "Ignition" haya sido exitoso tras conectar TiendaNube.

### Logs de Auditoría
El sistema registra cada uso de herramienta y error crítico.
*   Ve a `/admin/logs` (si tienes acceso técnico) o revisa el **Activity Stream** en el Dashboard.

---

**© 2026 Platform AI Solutions - Flight Operations**
