-- Upgrade clients table with extended profile fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS poc_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS poc_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ntn_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Agent Financial Ledger
-- credit = revenue generated (trip approved)
-- debit  = cash/bank received from agent (reduces outstanding)
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'adjustment')),
  reference_note TEXT,
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Financial Ledger
-- invoice    = trip billed to client (client owes us)
-- payment    = money received from client (reduces balance)
-- adjustment = manual admin entry
CREATE TABLE IF NOT EXISTS client_ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('bank_transfer', 'cheque', 'cash', 'credit_note')),
  reference_number TEXT,
  internal_notes TEXT,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
