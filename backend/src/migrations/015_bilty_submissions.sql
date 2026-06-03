-- Migration 015: Bilty submissions linked to approved trips
CREATE SEQUENCE IF NOT EXISTS bilty_job_seq START 1;

CREATE TABLE IF NOT EXISTS bilty_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID REFERENCES trips(id) ON DELETE CASCADE,
  agent_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  job_number       INT DEFAULT nextval('bilty_job_seq'),
  bilty_no         TEXT,
  category         TEXT CHECK (category IN ('corporate','open_market')),
  invoice_type     TEXT CHECK (invoice_type IN ('gst','non_gst')),
  gross_weight_mt  DECIMAL(6,2),
  freight          DECIMAL(12,2),
  pod_required     TEXT CHECK (pod_required IN ('yes','no','scan')),
  credit_term_days INT,
  transit_loss     TEXT CHECK (transit_loss IN ('customer','transporter')),
  image_base64     TEXT,
  pod_image_base64 TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bilty_trip_unique ON bilty_submissions(trip_id);
