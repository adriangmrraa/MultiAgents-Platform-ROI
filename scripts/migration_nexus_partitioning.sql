-- Migration Nexus Partitioning V1 (Omega Protocol)
-- Includes: System Events (Range) AND Identity (List)

BEGIN;

-- ==========================================
-- 1. SYSTEM EVENTS (Range Partitioning by Created At)
-- ==========================================

-- Clean Slate: Drop potentially existing "flat" tables created by ORM
DROP TABLE IF EXISTS system_events CASCADE;
DROP TABLE IF EXISTS system_events_legacy_v3 CASCADE; -- Cleanup old backups if any

-- Create Partitioned Parent Table
CREATE TABLE system_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    level VARCHAR(20),
    event_type VARCHAR(100),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at) -- Composite PK required for partitioning
) PARTITION BY RANGE (created_at);

-- Partitions
CREATE TABLE system_events_default PARTITION OF system_events DEFAULT;

CREATE TABLE system_events_2024 PARTITION OF system_events
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE system_events_2025 PARTITION OF system_events
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE system_events_2026 PARTITION OF system_events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes
CREATE INDEX idx_sys_events_type_time ON system_events(event_type, created_at);
CREATE INDEX idx_sys_events_level ON system_events(level);

-- Data Migration (Best Effort)
INSERT INTO system_events (id, level, event_type, message, metadata, created_at)
SELECT id, level, event_type, message, metadata, created_at
FROM system_events_legacy_v3
ON CONFLICT DO NOTHING;


-- ==========================================
-- 2. IDENTITY / CUSTOMERS (List Partitioning by Tenant)
-- ==========================================

-- Clean Slate: Drop potentially existing "flat" tables
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS customers_legacy_v1 CASCADE;

-- Create Partitioned Parent Table
CREATE TABLE customers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL, -- Partition Key
    
    phone_number VARCHAR(50),
    email VARCHAR(255),
    instagram_psid VARCHAR(255),
    facebook_psid VARCHAR(255),
    
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    tags JSONB DEFAULT '[]',
    ltv_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- PK must include Partition Key
    PRIMARY KEY (id, tenant_id),
    
    -- Constraints need to include partition key 
    CONSTRAINT uq_tenant_phone UNIQUE (tenant_id, phone_number),
    CONSTRAINT uq_tenant_ig UNIQUE (tenant_id, instagram_psid),
    CONSTRAINT uq_tenant_fb UNIQUE (tenant_id, facebook_psid)
) PARTITION BY LIST (tenant_id);

-- Default Partition (Catch-all for new tenants)
CREATE TABLE customers_default PARTITION OF customers DEFAULT;

-- Indexes on Parent
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_email ON customers(email);

-- Data Migration for Identity
-- Note: 'customers_legacy_v1' might be empty if we just created it, but good practice.
INSERT INTO customers (id, tenant_id, phone_number, email, instagram_psid, facebook_psid, first_name, last_name, tags, ltv_score, created_at, updated_at)
SELECT id, tenant_id, phone_number, email, instagram_psid, facebook_psid, first_name, last_name, tags, ltv_score, created_at, updated_at
FROM customers_legacy_v1
ON CONFLICT DO NOTHING;

COMMIT;
