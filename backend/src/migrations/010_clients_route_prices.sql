-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route prices table (fixed pricing per route, replaces per-km rates as primary mechanism)
CREATE TABLE IF NOT EXISTS route_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  container_type TEXT NOT NULL CHECK (container_type IN ('50ft_22_wheeler', '47ft_22_wheeler_jumbo', '40ft_trailer', 'canter')),
  price NUMERIC(10,2) NOT NULL,
  direction TEXT NOT NULL DEFAULT 'from_karachi' CHECK (direction IN ('from_karachi', 'to_karachi')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_city, to_city, container_type)
);

-- Add client fields to trips (for admin-created trips)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_phone TEXT;
