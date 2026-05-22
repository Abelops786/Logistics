-- Migration 005: completion notes, not-complete reason, detention penalty
ALTER TABLE trips ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS not_complete_reason TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS detention_penalty DECIMAL(12,2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2);
