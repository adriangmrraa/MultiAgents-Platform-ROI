"""
Billing & Subscription Routes
- GET /billing/plans - List available plans
- GET /billing/my-subscription - Current tenant subscription
- POST /billing/checkout - Create checkout session (Stripe/MercadoPago)
- POST /billing/webhook/stripe - Stripe webhook handler
- POST /billing/webhook/mercadopago - MercadoPago webhook handler
- POST /billing/change-plan - Change subscription plan
- GET /billing/invoices - List invoices for tenant
- GET /billing/usage - Current usage stats
"""
import os
import uuid
import structlog
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db, AsyncSession
from app.api.deps import get_current_user
from app.models.auth import User

logger = structlog.get_logger()

router = APIRouter(prefix="/billing", tags=["Billing"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN")
MP_WEBHOOK_SECRET = os.getenv("MP_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# ---------- Schemas ----------

class CheckoutRequest(BaseModel):
    plan_name: str  # pro, enterprise
    billing_period: str = "monthly"  # monthly, yearly
    provider: str = "stripe"  # stripe, mercadopago
    currency: str = "USD"  # USD, ARS


class ChangePlanRequest(BaseModel):
    new_plan_name: str
    provider: Optional[str] = None


# ---------- Public Endpoints ----------

@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    """List all available subscription plans."""
    rows = await db.fetch("""
        SELECT id, name, display_name, description,
               price_usd, price_ars, price_usd_yearly, price_ars_yearly,
               billing_period, max_agents, max_messages_per_month,
               max_knowledge_docs, max_channels, max_team_members,
               max_tokens_per_month, features, sort_order
        FROM plans WHERE is_active = true
        ORDER BY sort_order
    """)
    return [dict(r) for r in rows]


@router.get("/my-subscription")
async def my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current tenant's subscription details."""
    row = await db.fetchrow("""
        SELECT s.id, s.status, s.trial_ends_at, s.current_period_start,
               s.current_period_end, s.payment_provider, s.canceled_at,
               p.name as plan_name, p.display_name as plan_display_name,
               p.price_usd, p.price_ars, p.max_agents, p.max_messages_per_month,
               p.max_knowledge_docs, p.max_channels, p.max_team_members,
               p.max_tokens_per_month, p.features as plan_features
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = $1
    """, current_user.tenant_id)

    if not row:
        return {
            "has_subscription": False,
            "status": "none",
            "message": "No active subscription"
        }

    sub = dict(row)
    sub["has_subscription"] = True

    # Check if trial is expired
    if sub["status"] == "trialing" and sub["trial_ends_at"]:
        if datetime.utcnow() > sub["trial_ends_at"].replace(tzinfo=None):
            sub["status"] = "expired"
            sub["trial_expired"] = True
            # Update DB status
            await db.execute(
                "UPDATE subscriptions SET status = 'expired' WHERE tenant_id = $1",
                current_user.tenant_id
            )

    # Calculate days remaining in trial
    if sub["trial_ends_at"]:
        remaining = (sub["trial_ends_at"].replace(tzinfo=None) - datetime.utcnow()).days
        sub["trial_days_remaining"] = max(0, remaining)

    return sub


@router.get("/usage")
async def my_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current month usage for tenant."""
    now = datetime.utcnow()
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    row = await db.fetchrow("""
        SELECT messages_sent, messages_received, tokens_used, api_calls,
               llm_cost_usd, breakdown
        FROM usage_records
        WHERE tenant_id = $1 AND period_start = $2
    """, current_user.tenant_id, period_start)

    # Get plan limits
    limits = await db.fetchrow("""
        SELECT p.max_messages_per_month, p.max_tokens_per_month
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = $1
    """, current_user.tenant_id)

    usage = dict(row) if row else {
        "messages_sent": 0, "messages_received": 0,
        "tokens_used": 0, "api_calls": 0,
        "llm_cost_usd": 0.0, "breakdown": {}
    }

    if limits:
        usage["limits"] = {
            "max_messages": limits["max_messages_per_month"],
            "max_tokens": limits["max_tokens_per_month"],
            "messages_pct": round(
                (usage["messages_sent"] / max(limits["max_messages_per_month"], 1)) * 100, 1
            ),
            "tokens_pct": round(
                (usage["tokens_used"] / max(limits["max_tokens_per_month"], 1)) * 100, 1
            )
        }

    return usage


@router.get("/invoices")
async def my_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List invoices for current tenant."""
    rows = await db.fetch("""
        SELECT id, amount_usd, amount_local, currency, status,
               payment_provider, period_start, period_end, paid_at,
               line_items, created_at
        FROM invoices
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50
    """, current_user.tenant_id)
    return [dict(r) for r in rows]


# ---------- Checkout ----------

@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a checkout session for upgrading plan."""
    # Get target plan
    plan = await db.fetchrow(
        "SELECT * FROM plans WHERE name = $1 AND is_active = true",
        req.plan_name
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan["name"] == "free":
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")

    if req.provider == "stripe":
        return await _create_stripe_checkout(plan, req, current_user, db)
    elif req.provider == "mercadopago":
        return await _create_mp_checkout(plan, req, current_user, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid payment provider")


async def _create_stripe_checkout(plan, req, current_user, db):
    """Create Stripe Checkout session."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    # Determine price
    if req.billing_period == "yearly" and plan["stripe_price_id_yearly"]:
        price_id = plan["stripe_price_id_yearly"]
    elif plan["stripe_price_id"]:
        price_id = plan["stripe_price_id"]
    else:
        # Create a dynamic price if no pre-configured price
        price_amount = plan["price_usd"] if req.currency == "USD" else plan["price_ars"]
        currency_code = req.currency.lower()

        product = stripe.Product.create(
            name=f"{plan['display_name']} - Platform AI",
            metadata={"plan_name": plan["name"]}
        ) if not plan.get("stripe_product_id") else None

        product_id = product.id if product else plan["stripe_product_id"]

        price = stripe.Price.create(
            product=product_id,
            unit_amount=int(price_amount * 100),
            currency=currency_code,
            recurring={"interval": "month" if req.billing_period == "monthly" else "year"}
        )
        price_id = price.id

        # Save price ID back to plan
        col = "stripe_price_id_yearly" if req.billing_period == "yearly" else "stripe_price_id"
        await db.execute(f"UPDATE plans SET {col} = $1 WHERE id = $2", price_id, plan["id"])
        if product:
            await db.execute("UPDATE plans SET stripe_product_id = $1 WHERE id = $2", product.id, plan["id"])

    # Get or create Stripe customer
    sub = await db.fetchrow(
        "SELECT external_customer_id FROM subscriptions WHERE tenant_id = $1",
        current_user.tenant_id
    )
    customer_id = sub["external_customer_id"] if sub and sub.get("external_customer_id") else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"tenant_id": str(current_user.tenant_id)}
        )
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/billing?status=canceled",
        metadata={
            "tenant_id": str(current_user.tenant_id),
            "plan_name": plan["name"],
            "billing_period": req.billing_period
        }
    )

    logger.info("stripe_checkout_created", tenant_id=current_user.tenant_id, plan=plan["name"])

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "provider": "stripe"
    }


async def _create_mp_checkout(plan, req, current_user, db):
    """Create MercadoPago checkout preference."""
    if not MP_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="MercadoPago not configured")

    import httpx

    price = plan["price_ars"] if req.currency == "ARS" else plan["price_usd"]
    if req.billing_period == "yearly":
        price = plan.get("price_ars_yearly", price * 10) if req.currency == "ARS" else plan.get("price_usd_yearly", price * 10)

    # Create a preapproval (subscription) in MercadoPago
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.mercadopago.com/preapproval",
            headers={
                "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "reason": f"Platform AI - {plan['display_name']}",
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months" if req.billing_period == "monthly" else "years",
                    "transaction_amount": price,
                    "currency_id": req.currency
                },
                "payer_email": current_user.email,
                "back_url": f"{FRONTEND_URL}/billing?status=success",
                "external_reference": f"tenant_{current_user.tenant_id}_{plan['name']}",
                "status": "pending"
            }
        )

        if resp.status_code not in (200, 201):
            logger.error("mp_checkout_error", status=resp.status_code, body=resp.text)
            raise HTTPException(status_code=502, detail="MercadoPago error")

        data = resp.json()

    logger.info("mp_checkout_created", tenant_id=current_user.tenant_id, plan=plan["name"])

    return {
        "checkout_url": data.get("init_point"),
        "preapproval_id": data.get("id"),
        "provider": "mercadopago"
    }


# ---------- Webhooks ----------

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            import json
            event = json.loads(payload)
    except Exception as e:
        logger.error("stripe_webhook_invalid", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid webhook")

    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    logger.info("stripe_webhook_received", type=event_type)

    if event_type == "checkout.session.completed":
        await _handle_stripe_checkout_completed(data_obj, db)
    elif event_type == "invoice.paid":
        await _handle_stripe_invoice_paid(data_obj, db)
    elif event_type == "invoice.payment_failed":
        await _handle_stripe_payment_failed(data_obj, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_stripe_sub_canceled(data_obj, db)

    return {"received": True}


async def _handle_stripe_checkout_completed(session, db):
    """Activate subscription after successful Stripe checkout."""
    metadata = session.get("metadata", {})
    tenant_id = int(metadata.get("tenant_id", 0))
    plan_name = metadata.get("plan_name")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not tenant_id or not plan_name:
        logger.error("stripe_checkout_missing_metadata", metadata=metadata)
        return

    plan = await db.fetchrow("SELECT id FROM plans WHERE name = $1", plan_name)
    if not plan:
        return

    now = datetime.utcnow()
    # Upsert subscription
    await db.execute("""
        INSERT INTO subscriptions (tenant_id, plan_id, status, payment_provider,
                                   external_subscription_id, external_customer_id,
                                   current_period_start, trial_ends_at)
        VALUES ($1, $2, 'active', 'stripe', $3, $4, $5, NULL)
        ON CONFLICT (tenant_id) DO UPDATE SET
            plan_id = $2, status = 'active', payment_provider = 'stripe',
            external_subscription_id = $3, external_customer_id = $4,
            current_period_start = $5, trial_ends_at = NULL, updated_at = NOW()
    """, tenant_id, plan["id"], subscription_id, customer_id, now)

    # Ensure tenant is active
    await db.execute("UPDATE tenants SET status = 'active', is_active = true WHERE id = $1", tenant_id)

    logger.info("stripe_subscription_activated", tenant_id=tenant_id, plan=plan_name)


async def _handle_stripe_invoice_paid(invoice, db):
    """Record paid invoice."""
    customer_id = invoice.get("customer")
    sub = await db.fetchrow(
        "SELECT tenant_id FROM subscriptions WHERE external_customer_id = $1",
        customer_id
    )
    if not sub:
        return

    amount = invoice.get("amount_paid", 0) / 100.0
    currency = invoice.get("currency", "usd").upper()

    await db.execute("""
        INSERT INTO invoices (tenant_id, amount_usd, currency, status, payment_provider,
                              external_invoice_id, external_payment_id, paid_at, line_items)
        VALUES ($1, $2, $3, 'paid', 'stripe', $4, $5, NOW(), $6)
    """, sub["tenant_id"], amount, currency,
         invoice.get("id"), invoice.get("payment_intent"),
         '[]')

    logger.info("stripe_invoice_recorded", tenant_id=sub["tenant_id"], amount=amount)


async def _handle_stripe_payment_failed(invoice, db):
    """Handle failed payment."""
    customer_id = invoice.get("customer")
    sub = await db.fetchrow(
        "SELECT tenant_id FROM subscriptions WHERE external_customer_id = $1",
        customer_id
    )
    if not sub:
        return

    await db.execute(
        "UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE tenant_id = $1",
        sub["tenant_id"]
    )
    logger.warning("stripe_payment_failed", tenant_id=sub["tenant_id"])


async def _handle_stripe_sub_canceled(sub_data, db):
    """Handle subscription cancellation."""
    ext_sub_id = sub_data.get("id")
    sub = await db.fetchrow(
        "SELECT tenant_id FROM subscriptions WHERE external_subscription_id = $1",
        ext_sub_id
    )
    if not sub:
        return

    await db.execute("""
        UPDATE subscriptions SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
        WHERE tenant_id = $1
    """, sub["tenant_id"])
    logger.info("stripe_subscription_canceled", tenant_id=sub["tenant_id"])


@router.post("/webhook/mercadopago")
async def mercadopago_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle MercadoPago webhook events."""
    if not MP_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="MercadoPago not configured")

    body = await request.json()
    event_type = body.get("type")
    data_id = body.get("data", {}).get("id")

    logger.info("mp_webhook_received", type=event_type, data_id=data_id)

    if event_type == "subscription_preapproval" and data_id:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.mercadopago.com/preapproval/{data_id}",
                headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            )
            if resp.status_code != 200:
                return {"received": True}

            preapproval = resp.json()

        mp_status = preapproval.get("status")
        ext_ref = preapproval.get("external_reference", "")

        # Parse tenant_id from external_reference: "tenant_5_pro"
        parts = ext_ref.split("_")
        if len(parts) >= 3:
            tenant_id = int(parts[1])
            plan_name = parts[2]
        else:
            return {"received": True}

        plan = await db.fetchrow("SELECT id FROM plans WHERE name = $1", plan_name)
        if not plan:
            return {"received": True}

        if mp_status == "authorized":
            await db.execute("""
                INSERT INTO subscriptions (tenant_id, plan_id, status, payment_provider,
                                           external_subscription_id, current_period_start, trial_ends_at)
                VALUES ($1, $2, 'active', 'mercadopago', $3, NOW(), NULL)
                ON CONFLICT (tenant_id) DO UPDATE SET
                    plan_id = $2, status = 'active', payment_provider = 'mercadopago',
                    external_subscription_id = $3, current_period_start = NOW(),
                    trial_ends_at = NULL, updated_at = NOW()
            """, tenant_id, plan["id"], data_id)

            await db.execute("UPDATE tenants SET status = 'active', is_active = true WHERE id = $1", tenant_id)
            logger.info("mp_subscription_activated", tenant_id=tenant_id, plan=plan_name)

        elif mp_status in ("paused", "cancelled"):
            await db.execute("""
                UPDATE subscriptions SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
                WHERE tenant_id = $1
            """, tenant_id)
            logger.info("mp_subscription_canceled", tenant_id=tenant_id)

    elif event_type == "payment" and data_id:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.mercadopago.com/v1/payments/{data_id}",
                headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            )
            if resp.status_code == 200:
                payment = resp.json()
                ext_ref = payment.get("external_reference", "")
                parts = ext_ref.split("_")
                if len(parts) >= 2:
                    tenant_id = int(parts[1])
                    if payment.get("status") == "approved":
                        amount = payment.get("transaction_amount", 0)
                        currency = payment.get("currency_id", "ARS")
                        await db.execute("""
                            INSERT INTO invoices (tenant_id, amount_local, currency, status,
                                                  payment_provider, external_payment_id, paid_at)
                            VALUES ($1, $2, $3, 'paid', 'mercadopago', $4, NOW())
                        """, tenant_id, amount, currency, str(data_id))
                        logger.info("mp_payment_recorded", tenant_id=tenant_id, amount=amount)

    return {"received": True}


# ---------- Plan Change ----------

@router.post("/change-plan")
async def change_plan(
    req: ChangePlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change subscription plan. For downgrades, applies at period end."""
    new_plan = await db.fetchrow(
        "SELECT * FROM plans WHERE name = $1 AND is_active = true",
        req.new_plan_name
    )
    if not new_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    current_sub = await db.fetchrow(
        "SELECT s.*, p.name as plan_name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.tenant_id = $1",
        current_user.tenant_id
    )

    if not current_sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    if current_sub["plan_name"] == req.new_plan_name:
        raise HTTPException(status_code=400, detail="Already on this plan")

    # Update locally
    await db.execute("""
        UPDATE subscriptions SET plan_id = $1, status = 'active', updated_at = NOW()
        WHERE tenant_id = $2
    """, new_plan["id"], current_user.tenant_id)

    # Audit
    await db.execute("""
        INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, details)
        VALUES ($1, $2, 'plan.change', 'subscription',
                $3::jsonb)
    """, current_user.id, current_user.tenant_id,
         f'{{"from": "{current_sub["plan_name"]}", "to": "{req.new_plan_name}"}}')

    logger.info("plan_changed", tenant_id=current_user.tenant_id,
                from_plan=current_sub["plan_name"], to_plan=req.new_plan_name)

    return {"message": f"Plan changed to {new_plan['display_name']}", "new_plan": req.new_plan_name}
