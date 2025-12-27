-- Migration: Add Channels support to Agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '["whatsapp", "instagram", "facebook", "web"]';

-- Index for faster lookup by channel (using GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_agents_channels ON agents USING gin (channels);
