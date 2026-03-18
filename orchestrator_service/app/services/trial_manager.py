"""
Trial Manager Service
- Checks for expiring/expired trials
- Sends warning emails (day 7, day 9, day 10)
- Auto-blocks expired trials
- Runs as a background task periodically
"""
import os
import asyncio
import structlog
from datetime import datetime, timedelta

logger = structlog.get_logger()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


async def check_trial_expirations(db_pool):
    """
    Check all trialing subscriptions and send notifications.
    Should be called periodically (e.g., every hour via background task).
    """
    now = datetime.utcnow()

    # 1. Find trials expiring in 3 days (day 7 warning)
    warning_3d = now + timedelta(days=3)
    trials_warning = await db_pool.fetch("""
        SELECT s.tenant_id, s.trial_ends_at, u.email, u.full_name, t.store_name
        FROM subscriptions s
        JOIN users u ON u.tenant_id = s.tenant_id AND u.role = 'owner'
        JOIN tenants t ON t.id = s.tenant_id
        WHERE s.status = 'trialing'
        AND s.trial_ends_at BETWEEN $1 AND $2
    """, now + timedelta(days=2, hours=12), now + timedelta(days=3, hours=12))

    for trial in trials_warning:
        days_left = (trial["trial_ends_at"].replace(tzinfo=None) - now).days
        await _send_trial_warning_email(trial["email"], trial["store_name"], days_left)

    # 2. Find trials expiring in 1 day (day 9 urgent warning)
    trials_urgent = await db_pool.fetch("""
        SELECT s.tenant_id, s.trial_ends_at, u.email, u.full_name, t.store_name
        FROM subscriptions s
        JOIN users u ON u.tenant_id = s.tenant_id AND u.role = 'owner'
        JOIN tenants t ON t.id = s.tenant_id
        WHERE s.status = 'trialing'
        AND s.trial_ends_at BETWEEN $1 AND $2
    """, now + timedelta(hours=12), now + timedelta(days=1, hours=12))

    for trial in trials_urgent:
        await _send_trial_urgent_email(trial["email"], trial["store_name"])

    # 3. Expire trials that are past due
    expired = await db_pool.fetch("""
        UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'trialing' AND trial_ends_at < $1
        RETURNING tenant_id
    """, now)

    for exp in expired:
        # Get owner email
        owner = await db_pool.fetchrow(
            "SELECT email, full_name FROM users WHERE tenant_id = $1 AND role = 'owner'",
            exp["tenant_id"]
        )
        store = await db_pool.fetchval(
            "SELECT store_name FROM tenants WHERE id = $1",
            exp["tenant_id"]
        )
        if owner:
            await _send_trial_expired_email(owner["email"], store or "tu negocio")

    if expired:
        logger.info("trials_expired", count=len(expired))

    return {
        "warnings_sent": len(trials_warning),
        "urgent_warnings_sent": len(trials_urgent),
        "trials_expired": len(expired)
    }


async def _send_trial_warning_email(to_email: str, store_name: str, days_left: int):
    """Send warning that trial is expiring soon."""
    try:
        from app.core.email import EmailService, conf
        from fastapi_mail import FastMail, MessageSchema, MessageType

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }}
                .header {{ background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 20px; text-align: center; color: white; font-weight: bold; font-size: 18px; }}
                .content {{ padding: 30px; }}
                .btn {{ display: inline-block; background: linear-gradient(90deg, #3b82f6, #8b5cf6); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 20px; }}
                .days {{ font-size: 48px; font-weight: bold; color: #f59e0b; text-align: center; }}
                .feature {{ padding: 10px 0; border-bottom: 1px solid #334155; }}
                .feature-icon {{ font-size: 20px; margin-right: 8px; }}
                .plan-box {{ background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 8px 0; }}
                .plan-name {{ font-size: 16px; font-weight: bold; color: #a78bfa; }}
                .plan-price {{ font-size: 22px; font-weight: bold; color: #f59e0b; }}
                .limits {{ font-size: 12px; color: #94a3b8; margin-top: 8px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">Te quedan {days_left} dias gratis en Future</div>
                <div class="content">
                    <p class="days">{days_left} dias</p>
                    <p style="text-align: center;">Hola! Tu periodo de prueba de <strong>{store_name}</strong> termina en {days_left} dias.</p>
                    <p style="text-align: center;">Mira todo lo que Future puede hacer por tu negocio:</p>

                    <div class="feature">
                        <strong>Agentes de IA 24/7</strong><br>
                        <span style="color: #94a3b8;">Responden automaticamente en WhatsApp, Instagram y Facebook. Nunca pierdes un cliente, ni de madrugada.</span>
                    </div>
                    <div class="feature">
                        <strong>Base de Conocimiento (RAG)</strong><br>
                        <span style="color: #94a3b8;">Subi tus documentos, catalogos y FAQs. La IA aprende de tu negocio y responde con informacion precisa.</span>
                    </div>
                    <div class="feature">
                        <strong>Creative Studio</strong><br>
                        <span style="color: #94a3b8;">Genera fotos profesionales de tus productos y campanas publicitarias con IA. Sin fotografo, sin disenador.</span>
                    </div>

                    <p style="margin-top: 20px; font-size: 13px; color: #64748b; text-align: center;">
                        Tu plan gratuito actual incluye: 1 tienda, 1 Instagram, 1 Facebook, 2 WhatsApp, 200 mensajes/mes y 1 agente.
                    </p>

                    <hr style="border-color: #334155; margin: 20px 0;">

                    <p style="text-align: center; font-weight: bold; color: #e2e8f0;">Pasa a un plan y desbloquea todo el potencial:</p>

                    <div class="plan-box">
                        <span class="plan-name">Pro</span>
                        <span class="plan-price" style="float: right;">$49 USD/mes</span>
                        <div class="limits">5 agentes &middot; 5,000 msgs &middot; 3 canales por red &middot; Analytics avanzados</div>
                    </div>
                    <div class="plan-box">
                        <span class="plan-name">Enterprise</span>
                        <span class="plan-price" style="float: right;">$199 USD/mes</span>
                        <div class="limits">Agentes ilimitados &middot; Mensajes ilimitados &middot; API access &middot; Soporte prioritario</div>
                    </div>

                    <div style="text-align: center;">
                        <a href="{FRONTEND_URL}/billing" class="btn">VER PLANES Y ELEGIR</a>
                    </div>

                    <p style="margin-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                        Si tenes dudas, responde este email. Estamos para ayudarte.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"Te quedan {days_left} dias gratis en Future - {store_name}",
            recipients=[to_email],
            body=html,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info("trial_warning_email_sent", to=to_email, days_left=days_left)
    except Exception as e:
        logger.error("trial_warning_email_failed", to=to_email, error=str(e))


async def _send_trial_urgent_email(to_email: str, store_name: str):
    """Send urgent warning - 1 day left."""
    try:
        from app.core.email import conf
        from fastapi_mail import FastMail, MessageSchema, MessageType

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border: 2px solid #ef4444; border-radius: 12px; overflow: hidden; }}
                .header {{ background: #ef4444; padding: 20px; text-align: center; color: white; font-weight: bold; font-size: 18px; }}
                .content {{ padding: 30px; }}
                .btn {{ display: inline-block; background: #ef4444; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; margin-top: 20px; font-size: 16px; }}
                .lose-item {{ padding: 8px 0; color: #fca5a5; }}
                .safe-item {{ padding: 8px 0; color: #86efac; }}
                .plan-box {{ background: #0f172a; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center; }}
                .plan-name {{ font-size: 18px; font-weight: bold; color: #a78bfa; }}
                .plan-price {{ font-size: 28px; font-weight: bold; color: #f59e0b; }}
                .discount {{ background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-block; margin-top: 8px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">ULTIMO DIA: Tu acceso gratuito a Future vence manana</div>
                <div class="content">
                    <p style="font-size: 18px; text-align: center;">Tu periodo de prueba de <strong>{store_name}</strong> termina <strong>manana</strong>.</p>

                    <p style="font-weight: bold; color: #ef4444; margin-top: 20px;">Lo que se desactiva manana:</p>
                    <div class="lose-item">Tu agente de IA deja de responder en todos los canales</div>
                    <div class="lose-item">WhatsApp, Instagram y Facebook se desconectan</div>
                    <div class="lose-item">Creative Studio y generacion de contenido se pausan</div>

                    <p style="font-weight: bold; color: #22c55e; margin-top: 20px;">Lo que queda seguro:</p>
                    <div class="safe-item">Todas tus conversaciones y datos guardados</div>
                    <div class="safe-item">Tu base de conocimiento intacta</div>
                    <div class="safe-item">Configuraciones de agentes preservadas</div>

                    <p style="text-align: center; color: #94a3b8; margin-top: 10px;">Podes reactivar en cualquier momento y todo vuelve a funcionar al instante.</p>

                    <div class="plan-box">
                        <span class="plan-name">Plan Pro - Lo que mas eligen</span><br>
                        <span class="plan-price">$49 USD/mes</span>
                        <p style="color: #94a3b8; font-size: 14px; margin: 8px 0;">
                            5 agentes IA &middot; 5,000 mensajes/mes &middot; 3 canales por red<br>
                            Analytics avanzados &middot; Creative Studio completo
                        </p>
                        <span class="discount">20% OFF en facturacion anual</span>
                    </div>

                    <div style="text-align: center;">
                        <a href="{FRONTEND_URL}/billing" class="btn">ACTIVAR PLAN PRO AHORA</a>
                    </div>

                    <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
                        Tambien disponible: Plan Enterprise ($199/mes) para equipos grandes. Responde este email si necesitas ayuda.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"ULTIMO DIA: Tu acceso gratuito a Future vence manana - {store_name}",
            recipients=[to_email],
            body=html,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info("trial_urgent_email_sent", to=to_email)
    except Exception as e:
        logger.error("trial_urgent_email_failed", to=to_email, error=str(e))


async def _send_trial_expired_email(to_email: str, store_name: str):
    """Send email notifying trial has expired."""
    try:
        from app.core.email import conf
        from fastapi_mail import FastMail, MessageSchema, MessageType

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border: 2px solid #6366f1; border-radius: 12px; overflow: hidden; }}
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center; color: white; font-weight: bold; font-size: 18px; }}
                .content {{ padding: 30px; }}
                .btn {{ display: inline-block; background: linear-gradient(90deg, #3b82f6, #8b5cf6); color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; margin-top: 20px; font-size: 16px; }}
                .plan-box {{ background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 10px 0; }}
                .plan-name {{ font-size: 16px; font-weight: bold; }}
                .plan-price {{ font-size: 24px; font-weight: bold; color: #f59e0b; }}
                .plan-features {{ font-size: 13px; color: #94a3b8; margin-top: 8px; line-height: 1.6; }}
                .badge {{ display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }}
                .safe-msg {{ background: #064e3b; border: 1px solid #059669; border-radius: 8px; padding: 14px; margin: 16px 0; text-align: center; }}
                .payment-info {{ display: flex; justify-content: center; gap: 16px; margin-top: 12px; font-size: 13px; color: #94a3b8; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">Tu prueba gratuita finalizo</div>
                <div class="content">
                    <p style="text-align: center; font-size: 16px;">Hola! El periodo de prueba gratuito de <strong>{store_name}</strong> ha terminado y tu cuenta fue pausada.</p>

                    <div class="safe-msg">
                        <strong style="color: #22c55e;">Tus datos estan seguros.</strong><br>
                        <span style="color: #94a3b8;">Conversaciones, base de conocimiento, configuraciones de agentes: todo preservado. Al elegir un plan, todo se reactiva al instante.</span>
                    </div>

                    <hr style="border-color: #334155; margin: 24px 0;">

                    <p style="text-align: center; font-weight: bold; font-size: 16px;">Elegi el plan ideal para tu negocio:</p>

                    <div class="plan-box" style="border-color: #8b5cf6;">
                        <span class="plan-name" style="color: #a78bfa;">Pro</span>
                        <span class="badge" style="background: #7c3aed; color: white; margin-left: 8px;">Mas popular</span>
                        <div style="margin-top: 8px;">
                            <span class="plan-price">$49 USD/mes</span>
                            <span style="color: #64748b; font-size: 13px; margin-left: 4px;">o $470/ano (20% OFF)</span>
                        </div>
                        <div class="plan-features">
                            5 agentes IA &middot; 5,000 mensajes/mes &middot; 3 canales por red<br>
                            Analytics avanzados &middot; Creative Studio &middot; Base de conocimiento completa
                        </div>
                    </div>

                    <div class="plan-box" style="border-color: #f59e0b;">
                        <span class="plan-name" style="color: #f59e0b;">Enterprise</span>
                        <span class="badge" style="background: #d97706; color: white; margin-left: 8px;">Sin limites</span>
                        <div style="margin-top: 8px;">
                            <span class="plan-price">$199 USD/mes</span>
                            <span style="color: #64748b; font-size: 13px; margin-left: 4px;">o $1,910/ano (20% OFF)</span>
                        </div>
                        <div class="plan-features">
                            Agentes ilimitados &middot; Mensajes ilimitados &middot; Canales ilimitados<br>
                            API access &middot; Soporte prioritario &middot; Onboarding personalizado
                        </div>
                    </div>

                    <div style="text-align: center;">
                        <a href="{FRONTEND_URL}/billing" class="btn">REACTIVAR MI CUENTA</a>
                    </div>

                    <p style="text-align: center; margin-top: 16px; font-size: 13px; color: #94a3b8;">
                        Aceptamos <strong>MercadoPago</strong> y <strong>Stripe</strong> (tarjetas internacionales).
                    </p>

                    <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
                        Si necesitas ayuda o tenes alguna consulta, responde a este email. Estamos para ayudarte.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"Tu prueba gratuita finalizo - Reactiva Future para {store_name}",
            recipients=[to_email],
            body=html,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info("trial_expired_email_sent", to=to_email)
    except Exception as e:
        logger.error("trial_expired_email_failed", to=to_email, error=str(e))


async def trial_check_loop(db_pool):
    """Background loop that checks trial expirations every hour."""
    while True:
        try:
            result = await check_trial_expirations(db_pool)
            logger.info("trial_check_completed", **result)
        except Exception as e:
            logger.error("trial_check_error", error=str(e))
        await asyncio.sleep(3600)  # Every hour
