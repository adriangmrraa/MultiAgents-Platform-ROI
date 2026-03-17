"""
SaaS Billing Migration Script
Creates: plans, subscriptions, usage_records, invoices, audit_logs tables
Seeds: Free, Pro, Enterprise plans
Adds: status column to tenants, trial subscription for existing tenants
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import asyncpg
import structlog
from datetime import datetime, timedelta

logger = structlog.get_logger()

POSTGRES_DSN = os.getenv("POSTGRES_DSN") or os.getenv("DATABASE_URL")

MIGRATION_SQL = """
-- ============================================
-- SaaS Billing Schema Migration
-- ============================================

-- 1. Plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    price_usd DOUBLE PRECISION DEFAULT 0.0,
    price_ars DOUBLE PRECISION DEFAULT 0.0,
    price_usd_yearly DOUBLE PRECISION DEFAULT 0.0,
    price_ars_yearly DOUBLE PRECISION DEFAULT 0.0,
    billing_period VARCHAR(20) DEFAULT 'monthly',

    stripe_price_id VARCHAR(255),
    stripe_price_id_yearly VARCHAR(255),
    stripe_product_id VARCHAR(255),
    mp_plan_id VARCHAR(255),
    mp_plan_id_yearly VARCHAR(255),

    max_agents INTEGER DEFAULT 1,
    max_messages_per_month INTEGER DEFAULT 100,
    max_knowledge_docs INTEGER DEFAULT 10,
    max_channels INTEGER DEFAULT 1,
    max_team_members INTEGER DEFAULT 1,
    max_tokens_per_month INTEGER DEFAULT 50000,

    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),

    status VARCHAR(30) DEFAULT 'trialing' NOT NULL,
    -- active, trialing, past_due, canceled, suspended, expired

    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,

    payment_provider VARCHAR(30),
    external_subscription_id VARCHAR(255),
    external_customer_id VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT uq_subscription_tenant UNIQUE (tenant_id)
);

-- 3. Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,

    llm_cost_usd DOUBLE PRECISION DEFAULT 0.0,

    breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_usage_tenant_period UNIQUE (tenant_id, period_start)
);

-- 4. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),

    amount_usd DOUBLE PRECISION DEFAULT 0.0,
    amount_local DOUBLE PRECISION DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'USD',

    status VARCHAR(30) DEFAULT 'pending',
    -- pending, paid, failed, refunded, void

    payment_provider VARCHAR(30),
    external_invoice_id VARCHAR(255),
    external_payment_id VARCHAR(255),

    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    line_items JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    tenant_id INTEGER,

    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),

    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant ON usage_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Add status column to tenants if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='status') THEN
        ALTER TABLE tenants ADD COLUMN status VARCHAR(30) DEFAULT 'active';
    END IF;
END $$;
"""

SEED_PLANS_SQL = """
-- Seed default plans (idempotent)
INSERT INTO plans (name, display_name, description, price_usd, price_ars, price_usd_yearly, price_ars_yearly,
    max_agents, max_messages_per_month, max_knowledge_docs, max_channels, max_team_members, max_tokens_per_month,
    features, sort_order)
VALUES
    ('free', 'Free Trial', '10 dias gratis para probar la plataforma completa. Sin tarjeta de credito.',
     0, 0, 0, 0,
     1, 200, 5, 1, 1, 25000,
     '{"analytics": false, "custom_branding": false, "api_access": false, "priority_support": false, "whatsapp_templates": false, "multi_channel": false}',
     0),
    ('pro', 'Pro', 'Para negocios en crecimiento. Todo lo que necesitas para escalar tu atencion al cliente con IA.',
     49, 45000, 470, 432000,
     5, 5000, 50, 3, 5, 500000,
     '{"analytics": true, "custom_branding": true, "api_access": true, "priority_support": false, "whatsapp_templates": true, "multi_channel": true}',
     1),
    ('enterprise', 'Enterprise', 'Para grandes equipos. Soporte prioritario, agentes ilimitados, y features exclusivas.',
     199, 180000, 1910, 1728000,
     -1, -1, -1, -1, -1, -1,
     '{"analytics": true, "custom_branding": true, "api_access": true, "priority_support": true, "whatsapp_templates": true, "multi_channel": true, "dedicated_support": true, "sla": true}',
     2)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_usd = EXCLUDED.price_usd,
    price_ars = EXCLUDED.price_ars,
    price_usd_yearly = EXCLUDED.price_usd_yearly,
    price_ars_yearly = EXCLUDED.price_ars_yearly,
    max_agents = EXCLUDED.max_agents,
    max_messages_per_month = EXCLUDED.max_messages_per_month,
    max_knowledge_docs = EXCLUDED.max_knowledge_docs,
    max_channels = EXCLUDED.max_channels,
    max_team_members = EXCLUDED.max_team_members,
    max_tokens_per_month = EXCLUDED.max_tokens_per_month,
    features = EXCLUDED.features,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
"""


async def run_migration():
    if not POSTGRES_DSN:
        print("ERROR: POSTGRES_DSN or DATABASE_URL not set")
        return False

    try:
        conn = await asyncpg.connect(POSTGRES_DSN)
        print(">> Connected to database")

        # Run schema migration
        await conn.execute(MIGRATION_SQL)
        print(">> Schema migration completed")

        # Seed plans
        await conn.execute(SEED_PLANS_SQL)
        print(">> Plans seeded (Free, Pro, Enterprise)")

        # Create trial subscriptions for existing tenants without subscriptions
        free_plan_id = await conn.fetchval("SELECT id FROM plans WHERE name = 'free'")
        if free_plan_id:
            tenants_without_sub = await conn.fetch("""
                SELECT t.id FROM tenants t
                LEFT JOIN subscriptions s ON s.tenant_id = t.id
                WHERE s.id IS NULL
            """)
            for t in tenants_without_sub:
                trial_end = datetime.utcnow() + timedelta(days=10)
                await conn.execute("""
                    INSERT INTO subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
                    VALUES ($1, $2, 'trialing', $3, NOW(), $3)
                    ON CONFLICT (tenant_id) DO NOTHING
                """, t['id'], free_plan_id, trial_end)
            print(f">> Created trial subscriptions for {len(tenants_without_sub)} existing tenants")

        await conn.close()
        print(">> Migration complete!")
        return True

    except Exception as e:
        print(f"ERROR: Migration failed: {e}")
        return False


if __name__ == "__main__":
    asyncio.run(run_migration())
