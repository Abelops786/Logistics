-- Add not_complete to trips status CHECK constraint
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('pending', 'quoted', 'approved', 'rejected', 'completed', 'not_complete'));
