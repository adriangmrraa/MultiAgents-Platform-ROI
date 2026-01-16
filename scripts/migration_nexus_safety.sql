-- Migration: Safety Protocols (Soft Delete)
-- Description: Adds status column to tenants to support archiving instead of hard deletion.

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- Optional: Update existing to ACTIVE if null (though DEFAULT handles new ones)
UPDATE tenants SET status = 'ACTIVE' WHERE status IS NULL;
