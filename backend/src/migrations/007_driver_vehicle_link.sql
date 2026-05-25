-- Link drivers to their vehicle (supports 2-3 drivers per vehicle)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;

-- Expand container_type CHECK constraint to include new vehicle types from Excel
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_container_type_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_container_type_check
  CHECK (container_type IN ('50ft_22_wheeler', '47ft_22_wheeler_jumbo', '40ft_trailer', 'canter'));

-- Also expand trips container_type CHECK constraint
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_container_type_check;
ALTER TABLE trips ADD CONSTRAINT trips_container_type_check
  CHECK (container_type IN ('50ft_22_wheeler', '47ft_22_wheeler_jumbo', '40ft_trailer', 'canter'));
