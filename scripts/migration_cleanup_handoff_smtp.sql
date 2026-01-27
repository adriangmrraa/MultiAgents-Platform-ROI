-- Migration: Cleanup SMTP columns from tenant_human_handoff_config
-- Date: 2026-01-27
-- Reason: Handoff emails now use platform global SMTP (EmailService)
-- Impact: Simplifies UX - users only configure destination_email

-- Step 1: Verify current schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_human_handoff_config'
ORDER BY ordinal_position;

-- Step 2: Drop obsolete SMTP columns
ALTER TABLE tenant_human_handoff_config
DROP COLUMN IF EXISTS smtp_host,
DROP COLUMN IF EXISTS smtp_port,
DROP COLUMN IF EXISTS smtp_security,
DROP COLUMN IF EXISTS smtp_username,
DROP COLUMN IF EXISTS smtp_password_encrypted;

-- Step 3: Verify cleanup
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_human_handoff_config'
ORDER BY ordinal_position;

-- Expected remaining columns:
-- - id (primary key)
-- - tenant_id (foreign key)
-- - enabled (boolean)
-- - destination_email (text) -- ONLY SMTP-related field needed
-- - handoff_instructions (text)
-- - handoff_message (text)
-- - email_context (jsonb)
-- - created_at (timestamp)
-- - updated_at (timestamp)

-- Step 4: Also cleanup legacy columns from tenants table (if they exist)
ALTER TABLE tenants
DROP COLUMN IF EXISTS handoff_smtp_host,
DROP COLUMN IF EXISTS handoff_smtp_user,
DROP COLUMN IF EXISTS handoff_smtp_pass,
DROP COLUMN IF EXISTS handoff_smtp_port;

-- Verification complete
SELECT 'Migration completed successfully. SMTP columns removed from tenant_human_handoff_config and tenants tables.' AS status;
