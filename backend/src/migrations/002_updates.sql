-- Migration 002: Add quoted status, driver photo, vehicle-driver link

-- Add 'quoted' status to trips (admin quoted price, awaiting agent confirmation)
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('pending', 'quoted', 'approved', 'rejected', 'completed'));

-- Add driver photo
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo_base64 TEXT;

-- Link vehicle to a default/assigned driver
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES drivers(id);
