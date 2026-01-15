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
SENDER_EMAIL = os.getenv("EMAILS_FROM_EMAIL") or os.getenv("SENDER_EMAIL") or SMTP_USER or "noreply@nexus-platform.com"
SENDER_NAME = os.getenv("SENDER_NAME", "Nexus Protocol")

FRONTEND_URL = os.getenv("FRONTEND_URL")
if not FRONTEND_URL:
    logger.error("CRITICAL: FRONTEND_URL is not set. Email verification links will be broken.")
    # Fallback to a clear placeholder to avoid sending valid-looking but broken links
    FRONTEND_URL = "http://CONFIGURE_FRONTEND_URL_IN_ENV"

# ConnectionConfig updated per USER request for Port 465 / SSL
conf = ConnectionConfig(
    MAIL_USERNAME=SMTP_USER,
    MAIL_PASSWORD=SMTP_PASS,
    MAIL_FROM=SENDER_EMAIL,
    MAIL_PORT=SMTP_PORT,
    MAIL_SERVER=SMTP_HOST,
    MAIL_FROM_NAME=SENDER_NAME,
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False # CAPTAIN: Set to False to avoid SSL cert issues in Docker environments
)

class EmailService:
    @staticmethod
    async def send_verification_email(to_email: str, token: str):
        # DEBUG PRINTS
        print(f"DEBUG: Intentando enviar email a {to_email}", flush=True)
        print(f"DEBUG: Host={SMTP_HOST}, User={SMTP_USER}, Port={SMTP_PORT}", flush=True)

        if not SMTP_HOST or not SMTP_USER:
            err_msg = f"CONFIG ERROR: Falta SMTP_HOST ({SMTP_HOST}) o SMTP_USER ({SMTP_USER})"
            logger.error("smtp_config_invalid", host=SMTP_HOST, user=SMTP_USER)
            raise Exception(err_msg)

        logger.info("smtp_attempt_send", to=to_email, server=SMTP_HOST, port=SMTP_PORT, sender=SENDER_EMAIL)

        subject = "Activa tu Fábrica de Negocios - Nexus"
        verify_link = f"{FRONTEND_URL}/verify?token={token}"
        
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
                    max_width: 600px;
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
                    PROTOCOL OMEGA
                </div>
                <div class="content">
                    <h2>Identidad Requerida</h2>
                    <p>Has solicitado acceso a la plataforma Nexus.</p>
                    <p>Para activar tu entorno soberano, verifica que este canal de comunicación es seguro.</p>
                    
                    <a href="{verify_link}" class="btn">INITIALIZE PROTOCOL</a>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #cbd5e1;">
                        O copia este enlace de seguridad:<br>
                        {verify_link}
                    </p>
                </div>
                <div class="footer">
                    &copy; 2025 MultiAgents Platform. Zero Trust Architecture.
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

            fm = FastMail(conf)
            await fm.send_message(message)
            logger.info("email_sent_success", to=to_email)

        except Exception as e:
            error_msg = f"❌ SMTP ERROR DETAILED: {str(e)}"
            print(error_msg, flush=True) # Immediate visibility in container logs
            logger.error("email_delivery_failed", error=str(e), host=SMTP_HOST)
            raise e # RE-RAISE for explicit debugging per user request
