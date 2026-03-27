# Future Platform — Billing & SaaS

## Plans

| Feature | Free Trial | Pro | Enterprise |
|---------|:----------:|:---:|:----------:|
| Duration | 10 days | Monthly | Monthly |
| Agents | 1 | Unlimited | Unlimited |
| Messages/month | 50 | 5,000 | Unlimited |
| Knowledge docs | 5 | 50 | Unlimited |
| Channels | 1 | 3 | Unlimited |
| Creative Studio | Limited | Full | Full |
| Priority Support | No | Email | Dedicated |

## Payment Providers

- **Stripe** — international payments (credit card, recurring subscriptions)
- **MercadoPago** — Latin America (recurring preapproval subscriptions in ARS)

## Subscription Lifecycle

```
Register → Free Trial (10 days)
    → Day 7: trial reminder email (feature highlights)
    → Day 9: urgent reminder email
    → Day 10: final reminder → trial expires → API blocked (403)
    → Checkout (Stripe or MercadoPago) → Pro/Enterprise (active)
    → Cancel subscription → cancelled at period end
    → Non-payment → past_due → suspended
```

### Cancellation

Users can cancel their subscription from the Billing page. Cancellation takes effect at the end of the current billing period — access continues until then.

## Subscription Guard

Middleware on every API request:
1. Check `subscriptions` table for active plan
2. If trial expired or suspended → HTTP 403
3. If usage exceeds plan limits → HTTP 429
4. Otherwise → proceed

## Usage Tracking

Per-tenant, per-period tracking:
- `messages_sent` — total messages processed
- `tokens_used` — LLM tokens consumed
- `llm_cost` — estimated cost in USD

## Webhooks

- `POST /billing/webhook/stripe` — Stripe events (checkout.completed, subscription.updated, etc.)
- `POST /billing/webhook/mercadopago` — MercadoPago IPN notifications

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/billing/plans` | GET | List available plans |
| `/billing/my-subscription` | GET | Current tenant subscription |
| `/billing/checkout` | POST | Create checkout session (Stripe or MercadoPago) |
| `/billing/change-plan` | POST | Upgrade/downgrade |
| `/billing/cancel` | POST | Cancel subscription at period end |
| `/billing/invoices` | GET | Invoice history |
| `/billing/usage` | GET | Current period usage |
