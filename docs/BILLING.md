# Future Platform — Billing & SaaS

## Plans

| Feature | Free Trial | Pro | Enterprise |
|---------|:----------:|:---:|:----------:|
| Duration | 10 days | Monthly | Monthly |
| Agents | 1 | Unlimited | Unlimited |
| Messages/month | 100 | 5,000 | Unlimited |
| Knowledge docs | 5 | 50 | Unlimited |
| Channels | 1 | 3 | Unlimited |
| Creative Studio | Limited | Full | Full |
| Priority Support | No | Email | Dedicated |

## Payment Providers

- **Stripe** — international payments (credit card)
- **MercadoPago** — Latin America (credit card, debit, cash)

## Subscription Lifecycle

```
Register → Free Trial (10 days)
    → Day 7: warning email
    → Day 9: final warning
    → Day 10: trial expires → API blocked
    → Checkout → Pro/Enterprise (active)
    → Cancel → past_due → suspended
```

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
| `/billing/checkout` | POST | Create checkout session |
| `/billing/change-plan` | POST | Upgrade/downgrade |
| `/billing/invoices` | GET | Invoice history |
| `/billing/usage` | GET | Current period usage |
