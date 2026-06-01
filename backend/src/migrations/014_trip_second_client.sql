-- Migration 014: Support second client on a trip
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_id_2 UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_name_2 TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_phone_2 TEXT;
