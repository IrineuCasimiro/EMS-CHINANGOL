export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type EquipmentCategory = 'heavy_machinery' | 'light_vehicle' | 'support_vehicle' | 'generator' | 'other';
export type EquipmentStatus = 'operational' | 'maintenance' | 'standby' | 'broken';

export interface Equipment {
  id: string;
  name: string;
  model: string;
  brand: string;
  serial_number: string;
  plate_number: string;
  category: EquipmentCategory;
  status: 'Operational' | 'Under Maintenance' | 'Out of Service' | 'In Transit';
  horometer: number;
  odometer: number;
  location: string;
  notes: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type InspectionType = 'weekly' | 'monthly' | 'pre_use' | 'post_use';
export type InspectionStatus = 'pending' | 'completed' | 'failed';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note: string;
}

export interface Inspection {
  id: string;
  equipment_id: string;
  inspector_id: string | null;
  inspector_name: string;
  inspection_date: string;
  type: InspectionType;
  status: InspectionStatus;
  checklist: ChecklistItem[];
  signature: string;
  notes: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type WorkOrderType = 'mechanical' | 'hydraulic' | 'electromechanical' | 'preventive' | 'corrective' | 'other';
export type WorkOrderStatus = 'open' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface DiagnosisLine {
  id: string;
  text: string;
}

export interface WorkOrderPart {
  id: string;
  reference: string;
  description: string;
  quantity: number;
}

export interface WorkOrder {
  id: string;
  number: string;
  equipment_id: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: Priority;
  description: string;
  diagnosis: string;
  work_performed: string;
  assigned_technician: string;
  requested_by: string;
  start_date: string | null;
  end_date: string | null;
  serial_chassis: string;
  entry_date: string | null;
  hour_km_actual: string;
  client_project: string;
  technician_receptionist: string;
  diagnosis_lines: DiagnosisLine[];
  entry_checklist: ChecklistItem[];
  parts_replaced: WorkOrderPart[];
  exit_observations: string;
  mechanic_sign: string;
  engineer_sign: string;
  client_sign: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderLabor {
  id: string;
  work_order_id: string;
  technician_name: string;
  hours: number;
  description: string;
  date: string;
  user_id: string;
  created_at: string;
}

export type FuelLevel = 'empty' | 'quarter' | 'half' | 'three_quarter' | 'full';
export type TravelStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';

export interface TravelLog {
  id: string;
  number: string;
  vehicle_id: string | null;
  vehicle_name: string;
  driver_name: string;
  destination: string;
  origin: string;
  purpose: string;
  start_km: number;
  end_km: number;
  fuel_start: FuelLevel;
  fuel_end: FuelLevel;
  departure_date: string | null;
  return_date: string | null;
  license_plate: string;
  expected_return_time: string;
  arrival_date: string | null;
  arrival_time: string;
  travel_team: string;
  mechanic: string;
  dispatcher: string;
  checklist: ChecklistItem[];
  status: TravelStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type RequisitionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface PartsRequisition {
  id: string;
  number: string;
  work_order_id: string | null;
  equipment_id: string | null;
  client: string;
  service_number: string;
  model: string;
  serial_number: string;
  hour_km_meter: string;
  urgency: boolean;
  supervisor_name: string;
  supervisor_sign: string;
  requested_by: string;
  approved_by: string;
  status: RequisitionStatus;
  notes: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PartsRequisitionItem {
  id: string;
  requisition_id: string;
  description: string;
  part_number: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export type DocumentType = 'work_order' | 'travel_log' | 'inspection' | 'requisition';

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  record_id: string;
  number: string;
  title: string;
  file_path: string;
  file_size: number;
  user_id: string;
  created_at: string;
}

export interface EquipmentWithDetails extends Equipment {
  work_order_count?: number;
  inspection_count?: number;
}

export interface WorkOrderWithDetails extends WorkOrder {
  equipment?: Equipment;
  labor_entries?: WorkOrderLabor[];
}

export interface TravelLogWithDetails extends TravelLog {
  vehicle?: Equipment;
}

export interface RequisitionWithDetails extends PartsRequisition {
  items?: PartsRequisitionItem[];
  work_order?: WorkOrder;
  equipment?: Equipment;
}
