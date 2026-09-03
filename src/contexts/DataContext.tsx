import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialização do cliente Supabase (ajuste com as tuas variáveis de ambiente se necessário)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Interfaces de Tipos
export interface WorkOrder {
  id?: string;
  [key: string]: any;
}

export interface Equipment {
  id?: string;
  [key: string]: any;
}

export interface PartsRequisitionItem {
  id?: string;
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
  requisitionItems: PartsRequisitionItem[];
  deliveryTerms: DeliveryTerm[];
  travelLogs: TravelLog[];
  loading: boolean;
  refreshData: () => Promise<void>;
  saveWorkOrder: (wo: WorkOrder) => Promise<{ success: boolean; error?: string }>;
  deleteWorkOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveEquipment: (eq: Partial<Equipment>) => Promise<{ success: boolean; error?: string }>;
  deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveDeliveryTerm: (term: DeliveryTerm) => Promise<{ success: boolean; error?: string }>;
  deleteDeliveryTerm: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveTravelLog: (log: Partial<TravelLog>) => Promise<{ success: boolean; error?: string }>;
  deleteTravelLog: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<PartsRequisitionItem[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<DeliveryTerm[]>([]);
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [woRes, eqRes, reqRes, dtRes, tlRes] = await Promise.all([
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('equipment').select('*').order('created_at', { ascending: false }),
        supabase.from('parts_requisition_items').select('*').order('created_at', { ascending: false }),
        supabase.from('delivery_terms').select('*').order('created_at', { ascending: false }),
        supabase.from('travel_logs').select('*').order('created_at', { ascending: false })
      ]);

      if (woRes.error) console.error('Erro Work Orders:', woRes.error.message);
      else setWorkOrders(woRes.data || []);

      if (eqRes.error) console.error('Erro Equipment:', eqRes.error.message);
      else setEquipment(eqRes.data || []);

      if (reqRes.error) console.error('Erro Requisition Items:', reqRes.error.message);
      else setRequisitionItems(reqRes.data || []);

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

  // --- Funções de Work Orders ---
  const saveWorkOrder = async (wo: WorkOrder) => {
    try {
      let error = null;
      const payload = { ...wo };
      if (!payload.id) delete payload.id;

      if (wo.id) {
        const res = await supabase.from('work_orders').update(payload).eq('id', wo.id);
        error = res.error;
      } else {
        const res = await supabase.from('work_orders').insert([payload]);
        error = res.error;
      }
      if (error) throw error;
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

  // --- Funções de Equipment ---
  const saveEquipment = async (eq: Partial<Equipment>) => {
    try {
      let error = null;
      const payload = { ...eq };
      if (!payload.id) delete payload.id;

      if (eq.id) {
        const res = await supabase.from('equipment').update(payload).eq('id', eq.id);
        error = res.error;
      } else {
        const res = await supabase.from('equipment').insert([payload]);
        error = res.error;
      }
      if (error) throw error;
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

  // --- Funções de Delivery Terms ---
  const saveDeliveryTerm = async (term: DeliveryTerm) => {
    try {
      let error = null;
      const payload = { ...term };
      if (!payload.id) delete payload.id;

      if (term.id) {
        const res = await supabase.from('delivery_terms').update(payload).eq('id', term.id);
        error = res.error;
      } else {
        const res = await supabase.from('delivery_terms').insert([payload]);
        error = res.error;
      }
      if (error) throw error;
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

  // --- Funções de Travel Logs ---
  const saveTravelLog = async (log: Partial<TravelLog>) => {
    try {
      let error = null;
      const payload = { ...log };
      if (!payload.id) delete payload.id;

      if (log.id) {
        const res = await supabase.from('travel_logs').update(payload).eq('id', log.id);
        error = res.error;
      } else {
        const res = await supabase.from('travel_logs').insert([payload]);
        error = res.error;
      }
      if (error) throw error;
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
        requisitionItems,
        deliveryTerms,
        travelLogs,
        loading,
        refreshData,
        saveWorkOrder,
        deleteWorkOrder,
        saveEquipment,
        deleteEquipment,
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