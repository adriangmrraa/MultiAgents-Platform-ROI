-- v7.0.4.2: Verify and add missing handoff columns
-- Run this manually if orchestrator_service hasn't applied migrations

-- Add handoff columns if missing
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_target_email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_instructions TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_message TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_host TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_user TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_pass TEXT;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name LIKE 'handoff%'
ORDER BY column_name;

-- Test query
SELECT id, store_name, bot_phone_number, handoff_enabled, handoff_target_email
FROM tenants
LIMIT 5;
