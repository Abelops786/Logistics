-- Abel Dispatch Database Schema
-- Run this file against your PostgreSQL instance

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  cnic VARCHAR(15) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'admin', 'agent')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  cnic_front_base64 TEXT,
  cnic_back_base64 TEXT,
  region VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number VARCHAR(20) UNIQUE NOT NULL,
  container_type VARCHAR(30) NOT NULL CHECK (container_type IN ('50ft_22_wheeler', '47ft_22_wheeler_jumbo')),
  rate_per_km DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_trip', 'offline')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- City KM Matrix
CREATE TABLE IF NOT EXISTS city_km_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_from VARCHAR(100) NOT NULL,
  city_to VARCHAR(100) NOT NULL,
  distance_km DECIMAL(8, 2) NOT NULL,
  UNIQUE(city_from, city_to)
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES users(id),
  pickup_location TEXT NOT NULL,
  dropoff_locations JSONB NOT NULL,
  container_type VARCHAR(30) NOT NULL CHECK (container_type IN ('50ft_22_wheeler', '47ft_22_wheeler_jumbo')),
  system_estimated_price DECIMAL(12, 2),
  agent_requested_price DECIMAL(12, 2),
  admin_final_price DECIMAL(12, 2),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  payment_type VARCHAR(10) CHECK (payment_type IN ('cash', 'bank')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed: default pricing
INSERT INTO vehicles (plate_number, container_type, rate_per_km) VALUES
  ('SYSTEM-50FT', '50ft_22_wheeler', 85.00),
  ('SYSTEM-47FT', '47ft_22_wheeler_jumbo', 95.00)
ON CONFLICT (plate_number) DO NOTHING;

-- Seed: city KM matrix (major Pakistani cities)
INSERT INTO city_km_matrix (city_from, city_to, distance_km) VALUES
  ('Karachi', 'Hyderabad', 165),
  ('Hyderabad', 'Karachi', 165),
  ('Karachi', 'Sukkur', 470),
  ('Sukkur', 'Karachi', 470),
  ('Karachi', 'Multan', 1050),
  ('Multan', 'Karachi', 1050),
  ('Karachi', 'Lahore', 1270),
  ('Lahore', 'Karachi', 1270),
  ('Karachi', 'Islamabad', 1410),
  ('Islamabad', 'Karachi', 1410),
  ('Karachi', 'Faisalabad', 1160),
  ('Faisalabad', 'Karachi', 1160),
  ('Karachi', 'Peshawar', 1550),
  ('Peshawar', 'Karachi', 1550),
  ('Karachi', 'Quetta', 700),
  ('Quetta', 'Karachi', 700),
  ('Lahore', 'Islamabad', 375),
  ('Islamabad', 'Lahore', 375),
  ('Lahore', 'Faisalabad', 128),
  ('Faisalabad', 'Lahore', 128),
  ('Lahore', 'Multan', 340),
  ('Multan', 'Lahore', 340),
  ('Lahore', 'Peshawar', 490),
  ('Peshawar', 'Lahore', 490),
  ('Islamabad', 'Peshawar', 170),
  ('Peshawar', 'Islamabad', 170),
  ('Islamabad', 'Multan', 510),
  ('Multan', 'Islamabad', 510),
  ('Sukkur', 'Multan', 470),
  ('Multan', 'Sukkur', 470),
  ('Hyderabad', 'Sukkur', 310),
  ('Sukkur', 'Hyderabad', 310)
ON CONFLICT (city_from, city_to) DO NOTHING;

-- Seed: default super admin (password: Admin@123)
-- bcrypt hash of "Admin@123"
INSERT INTO users (name, cnic, phone, password_hash, role, status) VALUES
  ('Super Admin', '00000-0000000-0', '923001234567', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin', 'active')
ON CONFLICT (phone) DO NOTHING;
