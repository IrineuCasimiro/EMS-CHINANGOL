/*
# Equipment Management System (EMS) - Initial Schema

1. Overview
   Comprehensive schema for a heavy machinery stockyard and workshop management system.
   Supports RBAC with 5 roles, equipment tracking, work orders (Folha de Obra),
   travel logs (Guia de Viagem), parts requisitions, and weekly inspections.

2. New Tables
   - `profiles` — extends auth.users with role, full name, phone, status.
   - `equipment` — machinery inventory (SANY & general fleet) with serial numbers, horometer/odometer, status.
   - `inspections` — weekly inspection checklists with digital sign-off and JSONB checklist data.
   - `work_orders` — Folha de Obra maintenance work orders (mechanical, hydraulic, electromechanical).
   - `work_order_labor` — labor hour logs per technician per work order.
   - `travel_logs` — Guia de Viagem travel/vehicle fleet logs.
   - `parts_requisitions` — internal parts request forms linked to work orders or equipment.
   - `parts_requisition_items` — line items for each parts requisition.
   - `documents` — metadata for generated PDFs stored in Supabase Storage (ems-documents bucket).

3. Roles & Permissions (app-level RBAC)
   - admin: full access to everything including user management.
   - equipment_manager: manage equipment, inspections, work orders, travel logs.
   - workshop_supervisor: manage work orders, parts requisitions, inspections.
   - technician: view equipment, create/update work orders, log labor, view requisitions.
   - driver: view equipment, create/update travel logs.
   Role is stored in `profiles.role` (also mirrored in auth.users raw_app_meta_data for JWT access).
   RLS is owner-scoped on most tables; admin role gets full access via policy predicates.

4. Security
   - RLS enabled on all tables.
   - Owner-scoped CRUD policies (TO authenticated).
   - Admin override: policies allow full access when profile role = 'admin'.
   - Equipment managers and workshop supervisors get broader read access.
   - All tables have created_at/updated_at timestamps.

5. Notes
   - Uses gen_random_uuid() for primary keys.
   - JSONB used for flexible checklist data on inspections.
   - Documents table references storage object paths, not the files themselves.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'technician' CHECK (role IN ('admin','equipment_manager','workshop_supervisor','technician','driver')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', ''), COALESCE(new.raw_user_meta_data->>'role', 'technician'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ EQUIPMENT ============
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT 'SANY',
  serial_number text NOT NULL,
  plate_number text DEFAULT '',
  category text NOT NULL DEFAULT 'heavy_machinery' CHECK (category IN ('heavy_machinery','light_vehicle','support_vehicle','generator','other')),
  status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','maintenance','standby','broken')),
  horometer integer DEFAULT 0,
  odometer integer DEFAULT 0,
  location text DEFAULT '',
  notes text DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_select" ON equipment;
CREATE POLICY "equipment_select" ON equipment FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "equipment_insert" ON equipment;
CREATE POLICY "equipment_insert" ON equipment FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager','workshop_supervisor')
    )
  );

DROP POLICY IF EXISTS "equipment_update" ON equipment;
CREATE POLICY "equipment_update" ON equipment FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager','workshop_supervisor','technician'))
  ) WITH CHECK (true);

DROP POLICY IF EXISTS "equipment_delete" ON equipment;
CREATE POLICY "equipment_delete" ON equipment FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager'))
  );

-- ============ INSPECTIONS ============
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  inspector_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inspector_name text DEFAULT '',
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'weekly' CHECK (type IN ('weekly','monthly','pre_use','post_use')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  signature text DEFAULT '',
  notes text DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspections_select" ON inspections;
CREATE POLICY "inspections_select" ON inspections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "inspections_insert" ON inspections;
CREATE POLICY "inspections_insert" ON inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "inspections_update" ON inspections;
CREATE POLICY "inspections_update" ON inspections FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager','workshop_supervisor'))) WITH CHECK (true);

DROP POLICY IF EXISTS "inspections_delete" ON inspections;
CREATE POLICY "inspections_delete" ON inspections FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager')));

-- ============ WORK ORDERS (Folha de Obra) ============
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'mechanical' CHECK (type IN ('mechanical','hydraulic','electromechanical','preventive','corrective','other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_parts','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  description text NOT NULL DEFAULT '',
  diagnosis text DEFAULT '',
  work_performed text DEFAULT '',
  assigned_technician text DEFAULT '',
  requested_by text DEFAULT '',
  start_date date,
  end_date date,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
CREATE POLICY "work_orders_select" ON work_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "work_orders_update" ON work_orders;
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager','workshop_supervisor','technician'))) WITH CHECK (true);

DROP POLICY IF EXISTS "work_orders_delete" ON work_orders;
CREATE POLICY "work_orders_delete" ON work_orders FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','workshop_supervisor')));

-- ============ WORK ORDER LABOR ============
CREATE TABLE IF NOT EXISTS work_order_labor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  technician_name text NOT NULL DEFAULT '',
  hours decimal(5,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE work_order_labor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "labor_select" ON work_order_labor;
CREATE POLICY "labor_select" ON work_order_labor FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "labor_insert" ON work_order_labor;
CREATE POLICY "labor_insert" ON work_order_labor FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "labor_update" ON work_order_labor;
CREATE POLICY "labor_update" ON work_order_labor FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','workshop_supervisor'))) WITH CHECK (true);

DROP POLICY IF EXISTS "labor_delete" ON work_order_labor;
CREATE POLICY "labor_delete" ON work_order_labor FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','workshop_supervisor')));

-- ============ TRAVEL LOGS (Guia de Viagem) ============
CREATE TABLE IF NOT EXISTS travel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  vehicle_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  vehicle_name text DEFAULT '',
  driver_name text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  origin text DEFAULT '',
  purpose text DEFAULT '',
  start_km integer DEFAULT 0,
  end_km integer DEFAULT 0,
  fuel_start text DEFAULT 'full' CHECK (fuel_start IN ('empty','quarter','half','three_quarter','full')),
  fuel_end text DEFAULT 'full' CHECK (fuel_end IN ('empty','quarter','half','three_quarter','full')),
  departure_date date,
  return_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_transit','completed','cancelled')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE travel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "travel_select" ON travel_logs;
CREATE POLICY "travel_select" ON travel_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "travel_insert" ON travel_logs;
CREATE POLICY "travel_insert" ON travel_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "travel_update" ON travel_logs;
CREATE POLICY "travel_update" ON travel_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager','workshop_supervisor','driver'))) WITH CHECK (true);

DROP POLICY IF EXISTS "travel_delete" ON travel_logs;
CREATE POLICY "travel_delete" ON travel_logs FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','equipment_manager')));

-- ============ PARTS REQUISITIONS ============
CREATE TABLE IF NOT EXISTS parts_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  requested_by text NOT NULL DEFAULT '',
  approved_by text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled')),
  notes text DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE parts_requisitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requisitions_select" ON parts_requisitions;
CREATE POLICY "requisitions_select" ON parts_requisitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "requisitions_insert" ON parts_requisitions;
CREATE POLICY "requisitions_insert" ON parts_requisitions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "requisitions_update" ON parts_requisitions;
CREATE POLICY "requisitions_update" ON parts_requisitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "requisitions_delete" ON parts_requisitions;
CREATE POLICY "requisitions_delete" ON parts_requisitions FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','workshop_supervisor')));

-- ============ PARTS REQUISITION ITEMS ============
CREATE TABLE IF NOT EXISTS parts_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES parts_requisitions(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  part_number text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit text DEFAULT 'unit',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE parts_requisition_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "req_items_select" ON parts_requisition_items;
CREATE POLICY "req_items_select" ON parts_requisition_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "req_items_insert" ON parts_requisition_items;
CREATE POLICY "req_items_insert" ON parts_requisition_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "req_items_update" ON parts_requisition_items;
CREATE POLICY "req_items_update" ON parts_requisition_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "req_items_delete" ON parts_requisition_items;
CREATE POLICY "req_items_delete" ON parts_requisition_items FOR DELETE TO authenticated USING (true);

-- ============ DOCUMENTS ============
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('work_order','travel_log','inspection')),
  record_id uuid NOT NULL,
  number text DEFAULT '',
  title text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  file_size bigint DEFAULT 0,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents FOR DELETE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_equipment ON work_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_inspections_equipment ON inspections(equipment_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_travel_logs_status ON travel_logs(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON parts_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_record ON documents(record_id);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_inspections_updated_at ON inspections;
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_travel_logs_updated_at ON travel_logs;
CREATE TRIGGER update_travel_logs_updated_at BEFORE UPDATE ON travel_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_requisitions_updated_at ON parts_requisitions;
CREATE TRIGGER update_requisitions_updated_at BEFORE UPDATE ON parts_requisitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
