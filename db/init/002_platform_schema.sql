-- Schema for Platform UI Support (Tenants & Credentials)

-- 1. Tenants Table (Multi-tenancy support / Store Configuration)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    store_name TEXT NOT NULL,
    bot_phone_number TEXT UNIQUE NOT NULL, -- Acts as the main identifier for the bot
    owner_email TEXT,
    store_location TEXT,
    store_website TEXT,
    store_description TEXT, -- "Context" for the AI
    store_catalog_knowledge TEXT, -- "Knowledge" for the AI
    
    -- Tienda Nube Specifics
    tiendanube_store_id TEXT,
    tiendanube_access_token TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Credentials Table (Secrets Management)
CREATE TABLE IF NOT EXISTS credentials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,          -- e.g., "OPENAI_API_KEY"
    value TEXT NOT NULL,         -- Encrypted or plain (depending on security reqs, plain for now per user context)
    category TEXT,               -- "OpenAI", "WhatsApp", "YCloud", etc.
    scope TEXT DEFAULT 'global', -- 'global' or 'tenant'
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for uniqueness (handled as partial indexes instead of simple constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_global_unique ON credentials (name) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_tenant_unique ON credentials (name, tenant_id) WHERE scope = 'tenant';

-- 3. System Events (For "Console" view)
CREATE TABLE IF NOT EXISTS system_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,    -- "error", "info", "warning", "tool_call"
    severity TEXT DEFAULT 'info',
    message TEXT,
    payload JSONB,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Default initialization moved to Python (sync_environment) to support Protocol Omega
