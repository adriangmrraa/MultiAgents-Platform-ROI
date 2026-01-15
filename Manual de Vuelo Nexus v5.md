Monitoreo global para dueños de plataforma:
- **Uso de Bóveda**: Verifica qué tiendas tienen llaves configuradas y cuáles usan el fallback global.
- **Salubridad CPU/DB**: Monitoreo de latencia en la recuperación de secretos.
- **Protocolo de Visibilidad**: Si el registro muestra un cuadro amarillo, lee el error técnico; usualmente es un bloqueo de IP o falta de verificación de remitente en Brevo.

### C. Despegue con Fallo SMTP (Plan de Emergencia)
Si el email de verificación no llega:
1.  **Logs**: Busca el mensaje `🔗 MANUAL VERIFICATION LINK` en los registros del orquestador.
2.  **Activación Manual**: Copia y pega ese link en el navegador para activar la cuenta sin depender del correo.
3.  **Configuración de Remitente**: Asegúrate de haber verificado tu email en el panel de Brevo (Senders & IP).

### B. Protocolo "Safe Detach"
Si eliminas una tienda:
- Las **Credenciales Soberanas** asociadas se borran permanentemente por seguridad. 
- Tu perfil de usuario permanece intacto para futuras gestiones.

---

## 6. Integraciones (Omnichannel Hub)

1. Ve a **Settings > Integraciones**.
2. Genera tu **Webhook URL**. El sistema aislará el flujo de mensajes usando tu token de WhatsApp Cloud API guardado en la bóveda.

---

**© 2026 Platform AI Solutions - Flight Operations - v5.1 Sovereign**
