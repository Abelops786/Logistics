-- Migration 003: track whether agent has used their one re-price
ALTER TABLE trips ADD COLUMN IF NOT EXISTS agent_repriced BOOLEAN DEFAULT FALSE;
