import os
import structlog
from fastapi_mail import FastMail, ConnectionConfig, MessageSchema, MessageType

logger = structlog.get_logger()

# Config
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465")) # Port 465 is implicit SSL
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

# Anti-Spoofing: Prioritize specialized env vars, fallback to authenticated user
SENDER_EMAIL = os.getenv("EMAILS_FROM_EMAIL") or os.getenv("SENDER_EMAIL") or SMTP_USER or "noreply@future-platform.com"
SENDER_NAME = os.getenv("SENDER_NAME", "Future Platform")

FRONTEND_URL = os.getenv("FRONTEND_URL")
if not FRONTEND_URL:
    logger.error("CRITICAL: FRONTEND_URL is not set. Email verification links will be broken.")
    # Fallback to a clear placeholder to avoid sending valid-looking but broken links
    FRONTEND_URL = "http://CONFIGURE_FRONTEND_URL_IN_ENV"

# Dynamic security based on port
USE_SSL = (SMTP_PORT == 465)
USE_STARTTLS = (SMTP_PORT == 587)

conf = ConnectionConfig(
    MAIL_USERNAME=SMTP_USER,
    MAIL_PASSWORD=SMTP_PASS,
    MAIL_FROM=SENDER_EMAIL,
    MAIL_PORT=SMTP_PORT,
    MAIL_SERVER=SMTP_HOST,
    MAIL_FROM_NAME=SENDER_NAME,
    MAIL_STARTTLS=USE_STARTTLS,
    MAIL_SSL_TLS=USE_SSL,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False # CAPTAIN: Set to False to avoid SSL cert issues in Docker environments
)

class EmailService:
    @staticmethod
    async def get_connection_config(tenant_id: int = None, mode: str = "system"):
        """
        Builds a ConnectionConfig.
        - 'system': Always uses Platform Global SMTP (env vars).
        - 'agent': Prioritizes Tenant Credentials from DB.
        """
        if mode == "agent" and tenant_id:
            from app.core.credentials import get_tenant_credential
            
            # Fetch custom SMTP settings
            host = await get_tenant_credential(tenant_id, "smtp", "%host%")
            user = await get_tenant_credential(tenant_id, "smtp", "%user%")
            password = await get_tenant_credential(tenant_id, "smtp", "%pass%")
            port_str = await get_tenant_credential(tenant_id, "smtp", "%port%")
            sender = await get_tenant_credential(tenant_id, "smtp", "%sender%")
            
            if host and user and password:
                port = int(port_str) if port_str and port_str.isdigit() else 465
                use_ssl = (port == 465)
                use_starttls = (port == 587)
                
                return ConnectionConfig(
                    MAIL_USERNAME=user,
                    MAIL_PASSWORD=password,
                    MAIL_FROM=sender or user,
                    MAIL_PORT=port,
                    MAIL_SERVER=host,
                    MAIL_FROM_NAME="Future Platform",
                    MAIL_STARTTLS=use_starttls,
                    MAIL_SSL_TLS=use_ssl,
                    USE_CREDENTIALS=True,
                    VALIDATE_CERTS=False
                )
        
        # Fallback for 'system' mode or missing 'agent' credentials
        return conf 

    @staticmethod
    async def send_verification_email(to_email: str, token: str, tenant_id: int = None):
        """Standard System Communication. Always Uses Global SMTP."""
        # Verification is a Platform/System event. Use global config.
        dynamic_conf = await EmailService.get_connection_config(tenant_id, mode="system")
        
        # DEBUG PRINTS
        print(f"DEBUG: Intentando enviar email a {to_email}", flush=True)
        print(f"DEBUG: Host={dynamic_conf.MAIL_SERVER}, User={dynamic_conf.MAIL_USERNAME}, Port={dynamic_conf.MAIL_PORT}", flush=True)

        logger.info("smtp_attempt_send", to=to_email, server=dynamic_conf.MAIL_SERVER, port=dynamic_conf.MAIL_PORT, sender=dynamic_conf.MAIL_FROM)

        subject = "Activa tu cuenta - Future Platform"
        verify_link = f"{FRONTEND_URL}/verify?token={token}"
        
        # PROTOCOL OMEGA: Fallback log for manual verification if SMTP is blocked
        logger.info("verification_link_generated", link=verify_link)
        print(f"🔗 MANUAL VERIFICATION LINK: {verify_link}", flush=True)

        # Dark Mode / Cyberpunk HTML Template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Courier New', monospace;
                    background-color: #0f172a;
                    color: #e2e8f0;
                    margin: 0;
                    padding: 40px;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background: rgba(30, 41, 59, 0.7);
                    border: 1px solid #334155;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }}
                .header {{
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    padding: 20px;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    letter-spacing: 2px;
                }}
                .content {{
                    padding: 30px;
                    text-align: center;
                }}
                .btn {{
                    display: inline-block;
                    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white !important;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: bold;
                    margin-top: 20px;
                    box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
                }}
                .footer {{
                    margin-top: 30px;
                    font-size: 12px;
                    color: #94a3b8;
                    border-top: 1px solid #334155;
                    padding-top: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    FUTURE PLATFORM
                </div>
                <div class="content">
                    <h2>Verifica tu cuenta</h2>
                    <p>Gracias por registrarte en Future.</p>
                    <p>Hace click en el boton para activar tu cuenta y comenzar a usar la plataforma.</p>

                    <a href="{verify_link}" class="btn">ACTIVAR MI CUENTA</a>

                    <p style="margin-top: 30px; font-size: 12px; color: #cbd5e1;">
                        O copia este enlace:<br>
                        {verify_link}
                    </p>
                </div>
                <div class="footer">
                    &copy; 2026 Future Platform. Todos los derechos reservados.
                </div>
            </div>
        </body>
        </html>
        """

        try:
            message = MessageSchema(
                subject=subject,
                recipients=[to_email],
                body=html_content,
                subtype=MessageType.html
            )

            fm = FastMail(dynamic_conf)
            await fm.send_message(message)
            logger.info("email_sent_success", to=to_email)

        except Exception as e:
            error_msg = f"❌ SMTP ERROR DETAILED: {str(e)}"
            print(error_msg, flush=True) # Immediate visibility in container logs
            logger.error("email_delivery_failed", error=str(e), host=dynamic_conf.MAIL_SERVER)
            raise e

    @staticmethod
    async def send_password_reset_email(to_email: str, token: str):
        """Send password reset email with Future Platform aesthetic."""
        dynamic_conf = await EmailService.get_connection_config(mode="system")

        subject = "Restablecer contrasena - Future Platform"
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

        logger.info("password_reset_link_generated", link=reset_link)

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Courier New', monospace;
                    background-color: #0f172a;
                    color: #e2e8f0;
                    margin: 0;
                    padding: 40px;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background: rgba(30, 41, 59, 0.7);
                    border: 1px solid #334155;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }}
                .header {{
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    padding: 20px;
                    text-align: center;
                    color: white;
                    font-weight: bold;
                    letter-spacing: 2px;
                }}
                .content {{
                    padding: 30px;
                    text-align: center;
                }}
                .btn {{
                    display: inline-block;
                    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
                    color: white !important;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: bold;
                    margin-top: 20px;
                    box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
                }}
                .footer {{
                    margin-top: 30px;
                    font-size: 12px;
                    color: #94a3b8;
                    border-top: 1px solid #334155;
                    padding-top: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    FUTURE PLATFORM
                </div>
                <div class="content">
                    <h2>Restablecer contrasena</h2>
                    <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta.</p>
                    <p>Hace click en el boton para crear una nueva contrasena.</p>

                    <a href="{reset_link}" class="btn">RESTABLECER CONTRASENA</a>

                    <p style="margin-top: 30px; font-size: 12px; color: #cbd5e1;">
                        O copia este enlace:<br>
                        {reset_link}
                    </p>
                    <p style="margin-top: 20px; font-size: 11px; color: #64748b;">
                        Si no solicitaste este cambio, ignora este email. Tu contrasena no sera modificada.
                    </p>
                </div>
                <div class="footer">
                    &copy; 2026 Future Platform. Todos los derechos reservados.
                </div>
            </div>
        </body>
        </html>
        """

        try:
            message = MessageSchema(
                subject=subject,
                recipients=[to_email],
                body=html_content,
                subtype=MessageType.html
            )
            fm = FastMail(dynamic_conf)
            await fm.send_message(message)
            logger.info("password_reset_email_sent", to=to_email)
        except Exception as e:
            logger.error("password_reset_email_failed", error=str(e))
            raise e

    @staticmethod
    async def send_handoff_notification(to_email: str, tenant_name: str, customer_info: str, reason: str, tenant_id: int):
        """
        Notify Admin about Human Request.
        """
        # Always use system/global config for notifications FROM the platform TO the tenant admin
        # Or should we use tenant config if they brought their own SMTP? 
        # Protocol Omega: Notifications are System -> Tenant. So System SMTP.
        dynamic_conf = await EmailService.get_connection_config(tenant_id, mode="system")
        
        subject = f"🚨 Solicitud de Humano: {tenant_name}"
        
        # Dashboard URL
        dashboard_url = "https://app.nexus-ai.com/chat" # Generic or env based
        if FRONTEND_URL and "localhost" not in FRONTEND_URL:
             dashboard_url = f"{FRONTEND_URL}/chat"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 20px; }}
                .card {{ background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 600px; margin: 0 auto; }}
                .header {{ border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px; }}
                .tag {{ background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }}
                .btn {{ background: #ef4444; color: white !important; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h2 style="margin:0; color: #1f2937;">👤 Intervención Requerida</h2>
                    <span class="tag">PRIORIDAD ALTA</span>
                </div>
                <p>El cliente <strong>{customer_info}</strong> ha solicitado hablar con un humano.</p>
                
                <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                    <strong>Motivo Detectado:</strong><br>
                    {reason}
                </div>
                
                <a href="{dashboard_url}" class="btn">Ir al Chat</a>
                
                <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
                    Enviado por Future Platform • {tenant_name}
                </p>
            </div>
        </body>
        </html>
        """
        
        try:
            message = MessageSchema(
                subject=subject,
                recipients=[to_email],
                body=html_content,
                subtype=MessageType.html
            )
            fm = FastMail(dynamic_conf)
            await fm.send_message(message)
            logger.info("handoff_email_sent", to=to_email)
        except Exception as e:
            logger.error("handoff_email_failed", error=str(e))
            # Don't crash the flow, just log

