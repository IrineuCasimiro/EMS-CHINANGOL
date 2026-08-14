-- 1. Simplify profiles role to admin | user
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]));
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';

-- 2. Travel logs: add Guia de Viagem fields
ALTER TABLE travel_logs
  ADD COLUMN IF NOT EXISTS license_plate text DEFAULT '',
  ADD COLUMN IF NOT EXISTS expected_return_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS arrival_date date,
  ADD COLUMN IF NOT EXISTS arrival_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS travel_team text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mechanic text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dispatcher text DEFAULT '',
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]'::jsonb;

-- 3. Work orders: add Folha de Obra fields
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS serial_chassis text DEFAULT '',
  ADD COLUMN IF NOT EXISTS entry_date date,
  ADD COLUMN IF NOT EXISTS hour_km_actual text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_project text DEFAULT '',
  ADD COLUMN IF NOT EXISTS technician_receptionist text DEFAULT '',
  ADD COLUMN IF NOT EXISTS diagnosis_lines jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entry_checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parts_replaced jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exit_observations text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mechanic_sign text DEFAULT '',
  ADD COLUMN IF NOT EXISTS engineer_sign text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_sign text DEFAULT '';
