-- Link drivers to their vehicle (supports 2-3 drivers per vehicle)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
