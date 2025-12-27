-- Migration: Add Human Handoff configuration to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_target_email TEXT;
