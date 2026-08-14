-- Add new fields to parts_requisitions for the PARTS & SERVICE REQUEST FORM
-- These columns support the CHINANGOL LDA - SANY Department requisition form layout

ALTER TABLE parts_requisitions
  ADD COLUMN IF NOT EXISTS client text DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS serial_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hour_km_meter text DEFAULT '',
  ADD COLUMN IF NOT EXISTS urgency boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS supervisor_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supervisor_sign text DEFAULT '';
