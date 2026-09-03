import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WorkOrder {
  id?: string;
  [key: string]: any;
}

export interface Equipment {
  id?: string;
  [key: string]: any;
}

export interface PartsRequisition {
  id?: string;
  number: string;
  status: string;
  client?: string;
  requested_by?: string;
  service_number?: string;
  work_order_id?: string | null;
  equipment_id?: string | null;
  model?: string;
  serial_number?: string;
  hour_km_meter?: string;
  supervisor_name?: string;
  supervisor_sign?: string;
  urgency?: boolean;
  notes?: string;
  approved_by?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface PartsRequisitionItem {
  id?: string;
  requisition_id?: string;
  description: string;
  part_number?: string;
  quantity?: number | string;
  unit?: string;
  item_code?: string;
  remarks?: string;
  [key: string]: any;
}

export interface DeliveryTerm {
  id?: string;
  [key: string]: any;
}

export interface TravelLog {
  id?: string;
  number: string;
  status: string;
  vehicle_id?: string | null;
  vehicle_name?: string;
  license_plate?: string;
  driver_name: string;
  origin?: string;
  destination: string;
  purpose?: string;
  departure_date: string;
  expected_return_time?: string | null;
  arrival_date?: string;
  arrival_time?: string | null;
  start_km?: number;
  end_km?: number;
  fuel_start?: string;
  fuel_end?: string;
  checklist?: any[];
  travel_team?: string;
  mechanic?: string;
  dispatcher?: string;
  user_id?: string;
  created_at?: string;
}

interface DataContextType {
  workOrders: WorkOrder[];
  equipment: Equipment[];
  requisitions: PartsRequisition[];
  requisitionItems: PartsRequisitionItem[];
  deliveryTerms: DeliveryTerm[];
  travelLogs: TravelLog[];
  loading: boolean;
  refreshData: () => Promise<void>;
  saveWorkOrder: (wo: WorkOrder) => Promise<{ success: boolean; error?: string }>;
  deleteWorkOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveEquipment: (eq: Partial<Equipment>) => Promise<{ success: boolean; error?: string }>;
  deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveRequisition: (req: Partial<PartsRequisition>) => Promise<{ success: boolean; data?: PartsRequisition; error?: string }>;
  deleteRequisition: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveRequisitionItem: (item: Partial<PartsRequisitionItem>) => Promise<{ success: boolean; error?: string }>;
  deleteRequisitionItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveDeliveryTerm: (term: DeliveryTerm) => Promise<{ success: boolean; error?: string }>;
  deleteDeliveryTerm: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveTravelLog: (log: Partial<TravelLog>) => Promise<{ success: boolean; error?: string }>;
  deleteTravelLog: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requisitions, setRequisitions] = useState<PartsRequisition[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<PartsRequisitionItem[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<DeliveryTerm[]>([]);
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [woRes, eqRes, reqsRes, reqItemsRes, dtRes, tlRes] = await Promise.all([
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('equipment').select('*').order('created_at', { ascending: false }),
        supabase.from('parts_requisitions').select('*').order('created_at', { ascending: false }),
        supabase.from('parts_requisition_items').select('*').order('created_at', { ascending: false }),
        supabase.from('delivery_terms').select('*').order('created_at', { ascending: false }),
        supabase.from('travel_logs').select('*').order('created_at', { ascending: false })
      ]);

      if (woRes.error) console.error('Erro Work Orders:', woRes.error.message);
      else setWorkOrders(woRes.data || []);

      if (eqRes.error) console.error('Erro Equipment:', eqRes.error.message);
      else setEquipment(eqRes.data || []);

      if (reqsRes.error) console.error('Erro Requisitions:', reqsRes.error.message);
      else setRequisitions(reqsRes.data || []);

      if (reqItemsRes.error) console.error('Erro Requisition Items:', reqItemsRes.error.message);
      else setRequisitionItems(reqItemsRes.data || []);

      if (dtRes.error) console.error('Erro Delivery Terms:', dtRes.error.message);
      else setDeliveryTerms(dtRes.data || []);

      if (tlRes.error) console.error('Erro Travel Logs:', tlRes.error.message);
      else setTravelLogs(tlRes.data || []);

    } catch (err) {
      console.error('Erro geral ao atualizar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Work Orders
  const saveWorkOrder = async (wo: WorkOrder) => {
    try {
      const payload = { ...wo };
      if (!payload.id) delete payload.id;
      const res = wo.id 
        ? await supabase.from('work_orders').update(payload).eq('id', wo.id)
        : await supabase.from('work_orders').insert([payload]);
      if (res.error) throw res.error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteWorkOrder = async (id: string) => {
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Equipment
  const saveEquipment = async (eq: Partial<Equipment>) => {
    try {
      const payload = { ...eq };
      if (!payload.id) delete payload.id;
      const res = eq.id 
        ? await supabase.from('equipment').update(payload).eq('id', eq.id)
        : await supabase.from('equipment').insert([payload]);
      if (res.error) throw res.error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Requisitions
  const saveRequisition = async (req: Partial<PartsRequisition>) => {
    try {
      const payload = { ...req };
      if (!payload.id) delete payload.id;

      let res;
      if (req.id) {
        res = await supabase.from('parts_requisitions').update(payload).eq('id', req.id).select().single();
      } else {
        res = await supabase.from('parts_requisitions').insert([payload]).select().single();
      }
      if (res.error) throw res.error;
      await refreshData();
      return { success: true, data: res.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteRequisition = async (id: string) => {
    try {
      const { error } = await supabase.from('parts_requisitions').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Requisition Items
  const saveRequisitionItem = async (item: Partial<PartsRequisitionItem>) => {
    try {
      const payload = { ...item };
      if (!payload.id || payload.id.toString().startsWith('temp-')) delete payload.id;

      const res = item.id && !item.id.toString().startsWith('temp-')
        ? await supabase.from('parts_requisition_items').update(payload).eq('id', item.id)
        : await supabase.from('parts_requisition_items').insert([payload]);
      
      if (res.error) throw res.error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteRequisitionItem = async (id: string) => {
    try {
      const { error } = await supabase.from('parts_requisition_items').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Delivery Terms
  const saveDeliveryTerm = async (term: DeliveryTerm) => {
    try {
      const payload = { ...term };
      if (!payload.id) delete payload.id;
      const res = term.id 
        ? await supabase.from('delivery_terms').update(payload).eq('id', term.id)
        : await supabase.from('delivery_terms').insert([payload]);
      if (res.error) throw res.error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteDeliveryTerm = async (id: string) => {
    try {
      const { error } = await supabase.from('delivery_terms').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Travel Logs
  const saveTravelLog = async (log: Partial<TravelLog>) => {
    try {
      const payload = { ...log };
      if (!payload.id) delete payload.id;
      const res = log.id 
        ? await supabase.from('travel_logs').update(payload).eq('id', log.id)
        : await supabase.from('travel_logs').insert([payload]);
      if (res.error) throw res.error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteTravelLog = async (id: string) => {
    try {
      const { error } = await supabase.from('travel_logs').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <DataContext.Provider
      value={{
        workOrders,
        equipment,
        requisitions,
        requisitionItems,
        deliveryTerms,
        travelLogs,
        loading,
        refreshData,
        saveWorkOrder,
        deleteWorkOrder,
        saveEquipment,
        deleteEquipment,
        saveRequisition,
        deleteRequisition,
        saveRequisitionItem,
        deleteRequisitionItem,
        saveDeliveryTerm,
        deleteDeliveryTerm,
        saveTravelLog,
        deleteTravelLog,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
};