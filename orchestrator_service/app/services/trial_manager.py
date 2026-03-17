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
                .header {{ background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 20px; text-align: center; color: white; font-weight: bold; }}
                .content {{ padding: 30px; text-align: center; }}
                .btn {{ display: inline-block; background: linear-gradient(90deg, #3b82f6, #8b5cf6); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin-top: 20px; }}
                .days {{ font-size: 48px; font-weight: bold; color: #f59e0b; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">Tu prueba gratuita esta por terminar</div>
                <div class="content">
                    <p class="days">{days_left} dias</p>
                    <p>Hola! Tu periodo de prueba de <strong>{store_name}</strong> termina en {days_left} dias.</p>
                    <p>Para seguir usando la plataforma sin interrupciones, elige un plan ahora:</p>
                    <a href="{FRONTEND_URL}/billing" class="btn">VER PLANES</a>
                    <p style="margin-top: 20px; font-size: 13px; color: #94a3b8;">
                        Con el plan Pro obtenes agentes ilimitados, analytics avanzados y soporte prioritario.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"Tu prueba gratuita vence en {days_left} dias - {store_name}",
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
                .content {{ padding: 30px; text-align: center; }}
                .btn {{ display: inline-block; background: #ef4444; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; margin-top: 20px; font-size: 16px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">ULTIMO DIA - Tu acceso se bloquea manana</div>
                <div class="content">
                    <p style="font-size: 18px;">Tu periodo de prueba de <strong>{store_name}</strong> termina <strong>manana</strong>.</p>
                    <p>Si no elegis un plan, perderas acceso a:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Tus agentes de IA configurados</li>
                        <li>El historial de conversaciones</li>
                        <li>Las integraciones activas</li>
                        <li>La base de conocimiento</li>
                    </ul>
                    <p><strong>Tus datos se mantienen seguros.</strong> Podes reactivar cuando quieras.</p>
                    <a href="{FRONTEND_URL}/billing" class="btn">ELEGIR PLAN AHORA</a>
                    <p style="margin-top: 20px; font-size: 13px; color: #94a3b8;">
                        Plan anual con 20% de descuento disponible.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"URGENTE: Tu acceso se bloquea manana - {store_name}",
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
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; text-align: center; color: white; font-weight: bold; }}
                .content {{ padding: 30px; text-align: center; }}
                .btn {{ display: inline-block; background: linear-gradient(90deg, #3b82f6, #8b5cf6); color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; margin-top: 20px; font-size: 16px; }}
                .price {{ font-size: 28px; font-weight: bold; color: #a78bfa; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">Tu periodo de prueba ha finalizado</div>
                <div class="content">
                    <p>Hola! El periodo de prueba gratuito de <strong>{store_name}</strong> ha terminado.</p>
                    <p>Tu cuenta esta temporalmente bloqueada, pero <strong>todos tus datos estan seguros</strong>.</p>
                    <hr style="border-color: #334155; margin: 20px 0;">
                    <p>Para reactivar tu cuenta, elige un plan:</p>
                    <p class="price">Desde USD $49/mes</p>
                    <p style="color: #94a3b8;">Plan anual disponible con <strong>20% de descuento</strong></p>
                    <a href="{FRONTEND_URL}/billing" class="btn">REACTIVAR MI CUENTA</a>
                    <p style="margin-top: 30px; font-size: 12px; color: #64748b;">
                        Si necesitas ayuda, responde a este email o contactanos en soporte.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject=f"Tu prueba gratuita ha finalizado - Reactiva {store_name}",
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
