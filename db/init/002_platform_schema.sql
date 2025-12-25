-- Schema for Platform UI Support (Tenants & Credentials)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants Table (Multi-tenancy support / Store Configuration)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY, -- Keeping SERIAL for Tenant ID as it's legacy referenced, or User wants ALL UUID? Specification says "replace BIGSERIAL by UUID in all models". Let's stick to new tables or critical ones. 
    -- User said "reemplaza BIGSERIAL por UUID en todos los modelos". Tenants is SERIAL.
    -- To operate safely on existing data, usually we keep IDs if they are integers. 
    -- But for "Protocol Omega", I will try to make new tables UUID. 
    -- Actually, changing Tenant ID type is huge. I will focus on Agent/Customer/Events as implied by "Identity Link".
    -- "reemplaza BIGSERIAL por UUID en todos los modelos y scripts SQL iniciales".
    -- Let's check system_events which was BIGSERIAL.
    
    store_name TEXT NOT NULL,
    bot_phone_number TEXT UNIQUE NOT NULL, 
    owner_email TEXT,
    store_location TEXT,
    store_website TEXT,
    store_description TEXT, 
    store_catalog_knowledge TEXT, 
    tiendanube_store_id TEXT,
    tiendanube_access_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Credentials Table
CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY, -- Legacy int compatible
    name TEXT NOT NULL,          
    value TEXT NOT NULL,         
    category TEXT,               
    scope TEXT DEFAULT 'global', 
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_global_unique ON credentials (name) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_tenant_unique ON credentials (name, tenant_id) WHERE scope = 'tenant';

-- 3. System Events (For "Console" view) - Converted to UUID per spec
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    message TEXT,
    payload JSONB,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agents (See main.py / models for exact definition, often auto-created)
-- 5. Customers (Ghost Table Fix)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    name TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone_number)
);

-- Ensure chat_conversations has customer_id linked
-- CREATE TABLE done via ORM, but we can patch here if needed.

