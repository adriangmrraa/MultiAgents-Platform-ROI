import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

logger = logging.getLogger(__name__)

# Config
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_SECURITY = os.getenv("SMTP_SECURITY", "STARTTLS").upper() # SSL, STARTTLS, NONE

# Force security protocol based on common ports if not strictly specified
if SMTP_PORT == 465:
    SMTP_SECURITY = "SSL"
elif SMTP_PORT == 587 and SMTP_SECURITY != "SSL":
    SMTP_SECURITY = "STARTTLS"

# Anti-Spoofing: Prioritize specialized env vars, fallback to authenticated user
SENDER_EMAIL = os.getenv("EMAILS_FROM_EMAIL") or os.getenv("SENDER_EMAIL") or SMTP_USER or "noreply@nexus-platform.com"
SENDER_NAME = os.getenv("SENDER_NAME", "Nexus Protocol")

FRONTEND_URL = os.getenv("FRONTEND_URL")
if not FRONTEND_URL:
    logger.error("CRITICAL: FRONTEND_URL is not set. Email verification links will be broken.")
    # Fallback to a clear placeholder to avoid sending valid-looking but broken links
    FRONTEND_URL = "http://CONFIGURE_FRONTEND_URL_IN_ENV"

class EmailService:
    @staticmethod
    def send_verification_email(to_email: str, token: str):
        """
        Sends a Zero Trust verification email.
        Designed to be run in a BackgroundTask to avoid blocking.
        """
        if not SMTP_HOST or not SMTP_USER:
            logger.warning("email_service_disabled_missing_creds", host=SMTP_HOST)
            return

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
            msg = MIMEMultipart()
            msg['From'] = formataddr((SENDER_NAME, SENDER_EMAIL))
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(html_content, 'html'))

            logger.info(f"Connecting to {SMTP_HOST}:{SMTP_PORT} | Security: {SMTP_SECURITY} | From: {SENDER_EMAIL}")
            
            # Connection Logic
            if SMTP_SECURITY == 'SSL':
                logger.info(f"Using Implicit SSL on port {SMTP_PORT}")
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                    server.login(SMTP_USER, SMTP_PASS)
                    server.send_message(msg)
            elif SMTP_SECURITY == 'STARTTLS':
                logger.info(f"Using STARTTLS on port {SMTP_PORT}")
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                    server.starttls()
                    server.login(SMTP_USER, SMTP_PASS)
                    server.send_message(msg)
            else:
                logger.info(f"Using Plain SMTP on port {SMTP_PORT}")
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                    server.login(SMTP_USER, SMTP_PASS)
                    server.send_message(msg)
                    
            logger.info("email_sent_success", to=to_email)

        except Exception as e:
            error_msg = f"❌ SMTP ERROR DETAILED: {str(e)}"
            print(error_msg, flush=True) # Immediate visibility in container logs
            logger.error("email_delivery_failed", error=str(e), host=SMTP_HOST)
            # We explicitly do NOT re-raise to avoid crashing the background task runner
            # or the main request (if called synchronously)
