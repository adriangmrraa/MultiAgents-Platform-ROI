-- Migration Nexus V1: Identity & Polymorphism

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
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
    
    CONSTRAINT uq_tenant_phone UNIQUE (tenant_id, phone_number),
    CONSTRAINT uq_tenant_ig UNIQUE (tenant_id, instagram_psid),
    CONSTRAINT uq_tenant_fb UNIQUE (tenant_id, facebook_psid)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 2. Alter Chat Conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_customer ON chat_conversations(customer_id);

-- 3. Alter Chat Messages for Polymorphism
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'whatsapp';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS platform_message_id VARCHAR(255);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS platform_metadata JSONB DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content_attributes JSONB DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_chat_msg_platform ON chat_messages(platform, platform_message_id);
