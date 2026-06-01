-- Migration 013: Add extra trip fields for cargo details and double-trip flag
ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_double BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS weight_ton DECIMAL(8,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cargo_items TEXT;
