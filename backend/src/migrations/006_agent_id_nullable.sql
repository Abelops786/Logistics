-- Allow agent_id to be NULL on trips so hard-deleted agents don't break trip history
ALTER TABLE trips ALTER COLUMN agent_id DROP NOT NULL;
