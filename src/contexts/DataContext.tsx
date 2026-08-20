import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkOrder, Equipment, PartsRequisition, PartsRequisitionItem, TravelLog } from '@/types';

// Interface completa para o Termo de Entrega / Delivery Term
export interface DeliveryTerm {
  id?: string;
  client: string;
  address?: string;
  responsible?: string;
  equipment: string;
  model?: string;
  fabrication_year?: string;
  serial_number?: string;
  included_accessories?: string;
  phone?: string;
  delivery_location?: string;
  chinangol_representative?: string;
  delivery_date: string;
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
  saveDeliveryTerm: (term: DeliveryTerm) => Promise<{ success: boolean; error?: string }>;
  deleteDeliveryTerm: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveRequisition: (req: Partial<PartsRequisition>) => Promise<{ success: boolean; data?: PartsRequisition; error?: string }>;
  deleteRequisition: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveRequisitionItem: (item: Partial<PartsRequisitionItem>) => Promise<{ success: boolean; data?: PartsRequisitionItem; error?: string }>;
  deleteRequisitionItem: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveTravelLog: (log: Partial<TravelLog>) => Promise<{ success: boolean; error?: string }>;
  deleteTravelLog: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requisitions, setRequisitions] = useState<PartsRequisition[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<PartsRequisitionItem[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<DeliveryTerm[]>([]);
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      // 1. Work Orders
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (woError) console.error('Erro ao carregar work_orders:', woError.message);
      else setWorkOrders(woData || []);

      // 2. Equipment
      const { data: eqData, error: eqError } = await supabase
        .from('equipment')
        .select('*');
      if (eqError) console.error('Erro ao carregar equipment:', eqError.message);
      else setEquipment(eqData || []);

      // 3. Parts Requisitions
      const { data: reqData, error: reqError } = await supabase
        .from('parts_requisitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (reqError) console.error('Erro ao carregar parts_requisitions:', reqError.message);
      else setRequisitions(reqData || []);

      // 4. Parts Requisition Items
      const { data: reqItemsData, error: reqItemsError } = await supabase
        .from('parts_requisition_items')
        .select('*');
      if (reqItemsError) console.error('Erro ao carregar parts_requisition_items:', reqItemsError.message);
      else setRequisitionItems(reqItemsData || []);

      // 5. Delivery Terms
      const { data: dtData, error: dtError } = await supabase
        .from('delivery_terms')
        .select('*')
        .order('created_at', { ascending: false });
      if (dtError) console.error('Erro ao carregar delivery_terms:', dtError.message);
      else setDeliveryTerms(dtData || []);

      // 6. Travel Logs
      const { data: tlData, error: tlError } = await supabase
        .from('travel_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (tlError) console.error('Erro ao carregar travel_logs:', tlError.message);
      else setTravelLogs(tlData || []);

    } catch (err: any) {
      console.error('Erro geral ao atualizar dados:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // --- WORK ORDERS ---
  const saveWorkOrder = async (wo: WorkOrder): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        number: wo.number,
        status: wo.status || 'open',
        entry_date: wo.entry_date || null,
        equipment_id: wo.equipment_id || null,
        client_project: wo.client_project || '',
        serial_chassis: wo.serial_chassis || '',
        hour_km_actual: wo.hour_km_actual || '',
        technician_receptionist: wo.technician_receptionist || '',
        assigned_technician: wo.assigned_technician || '',
        exit_observations: wo.exit_observations || '',
        diagnosis_lines: wo.diagnosis_lines || [],
        entry_checklist: wo.entry_checklist || [],
        parts_replaced: wo.parts_replaced || [],
        mechanic_sign: wo.mechanic_sign || '',
        engineer_sign: wo.engineer_sign || '',
        client_sign: wo.client_sign || '',
        updated_at: new Date().toISOString(),
      };

      let error = null;
      if (wo.id) {
        const { error: updateError } = await supabase.from('work_orders').update(payload).eq('id', wo.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('work_orders').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar Work Order:', err);
      return { success: false, error: err.message || 'Erro desconhecido ao guardar' };
    }
  };

  const deleteWorkOrder = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Work Order:', err);
      return { success: false, error: err.message };
    }
  };

  // --- EQUIPMENT ---
  const saveEquipment = async (eq: Partial<Equipment>): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        name: eq.name,
        brand: eq.brand || 'SANY',
        model: eq.model || '',
        serial_number: eq.serial_number,
        plate_number: eq.plate_number || '',
        category: eq.category || 'heavy_machinery',
        status: eq.status || 'operational',
        horometer: Number(eq.horometer) || 0,
        odometer: Number(eq.odometer) || 0,
        location: eq.location || '',
        notes: eq.notes || '',
        updated_at: new Date().toISOString(),
      };

      let error = null;
      if (eq.id) {
        const { error: updateError } = await supabase.from('equipment').update(payload).eq('id', eq.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('equipment').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar Equipment:', err);
      return { success: false, error: err.message || 'Erro desconhecido ao guardar equipamento' };
    }
  };

  const deleteEquipment = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Equipment:', err);
      return { success: false, error: err.message };
    }
  };

  // --- DELIVERY TERMS ---
  const saveDeliveryTerm = async (term: DeliveryTerm): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        client: term.client,
        address: term.address || '',
        responsible: term.responsible || '',
        equipment: term.equipment,
        model: term.model || '',
        fabrication_year: term.fabrication_year || '',
        serial_number: term.serial_number || '',
        included_accessories: term.included_accessories || '',
        phone: term.phone || '',
        delivery_location: term.delivery_location || '',
        delivery_date: term.delivery_date,
      };

      let error = null;
      if (term.id) {
        const { error: updateError } = await supabase.from('delivery_terms').update(payload).eq('id', term.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('delivery_terms').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar Delivery Term:', err);
      return { success: false, error: err?.message || JSON.stringify(err) };
    }
  };

  const deleteDeliveryTerm = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('delivery_terms').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Delivery Term:', err);
      return { success: false, error: err.message };
    }
  };

  // --- PARTS REQUISITIONS ---
  const saveRequisition = async (req: Partial<PartsRequisition>): Promise<{ success: boolean; data?: PartsRequisition; error?: string }> => {
    try {
      const payload = {
        number: req.number,
        status: req.status || 'pending',
        client: req.client || 'CHINANGOL, LDA',
        work_order_id: req.work_order_id || null,
        equipment_id: req.equipment_id || null,
        service_number: req.service_number || '',
        requested_by: req.requested_by || '',
        model: req.model || '',
        serial_number: req.serial_number || '',
        hour_km_meter: req.hour_km_meter || '',
        supervisor_name: req.supervisor_name || 'CARLOS BALTAZAR',
        supervisor_sign: req.supervisor_sign || 'FRANCISCO SACULILA',
        urgency: !!req.urgency,
        notes: req.notes || '',
        updated_at: new Date().toISOString(),
      };

      let savedData: PartsRequisition | null = null;
      let error = null;

      if (req.id) {
        const { data, error: updateError } = await supabase
          .from('parts_requisitions')
          .update(payload)
          .eq('id', req.id)
          .select()
          .single();
        error = updateError;
        savedData = data;
      } else {
        const { data, error: insertError } = await supabase
          .from('parts_requisitions')
          .insert([payload])
          .select()
          .single();
        error = insertError;
        savedData = data;
      }

      if (error) throw error;

      await refreshData();
      return { success: true, data: savedData || undefined };
    } catch (err: any) {
      console.error('Erro ao salvar Requisition:', err);
      return { success: false, error: err.message || 'Erro ao guardar requisição' };
    }
  };

  const deleteRequisition = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('parts_requisitions').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Requisition:', err);
      return { success: false, error: err.message };
    }
  };

  // --- PARTS REQUISITION ITEMS ---
  const saveRequisitionItem = async (item: Partial<PartsRequisitionItem>): Promise<{ success: boolean; data?: PartsRequisitionItem; error?: string }> => {
    try {
      const payload = {
        requisition_id: item.requisition_id,
        description: item.description,
        part_number: item.part_number || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'UN',
        item_code: item.item_code || '',
        remarks: item.remarks || '',
      };

      let savedData: PartsRequisitionItem | null = null;
      let error = null;

      if (item.id && !item.id.toString().startsWith('temp-')) {
        const { data, error: updateError } = await supabase
          .from('parts_requisition_items')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();
        error = updateError;
        savedData = data;
      } else {
        const { data, error: insertError } = await supabase
          .from('parts_requisition_items')
          .insert([payload])
          .select()
          .single();
        error = insertError;
        savedData = data;
      }

      if (error) throw error;

      await refreshData();
      return { success: true, data: savedData || undefined };
    } catch (err: any) {
      console.error('Erro ao salvar Requisition Item:', err);
      return { success: false, error: err.message || 'Erro ao guardar item' };
    }
  };

  const deleteRequisitionItem = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('parts_requisition_items').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Requisition Item:', err);
      return { success: false, error: err.message };
    }
  };

  // --- TRAVEL LOGS (GUIAS DE VIAGEM) ---
  const saveTravelLog = async (log: Partial<TravelLog>): Promise<{ success: boolean; error?: string }> => {
    try {
      const payload = {
        number: log.number,
        status: log.status || 'planned',
        departure_date: log.departure_date || null,
        expected_return_time: log.expected_return_time || null,
        arrival_date: log.arrival_date || null,
        arrival_time: log.arrival_time || null,
        start_km: Number(log.start_km) || 0,
        end_km: Number(log.end_km) || 0,
        fuel_start: log.fuel_start || 'full',
        fuel_end: log.fuel_end || 'full',
        driver_name: log.driver_name || '',
        license_plate: log.license_plate || '',
        vehicle_id: log.vehicle_id || null,
        vehicle_name: log.vehicle_name || '',
        origin: log.origin || '',
        destination: log.destination || '',
        purpose: log.purpose || '',
        travel_team: log.travel_team || '',
        mechanic: log.mechanic || '',
        dispatcher: log.dispatcher || '',
        checklist: log.checklist || [],
        user_id: log.user_id || null,
        updated_at: new Date().toISOString(),
      };

      let error = null;
      if (log.id) {
        const { error: updateError } = await supabase.from('travel_logs').update(payload).eq('id', log.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('travel_logs').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar Travel Log:', err);
      return { success: false, error: err.message || 'Erro ao guardar guia de viagem' };
    }
  };

  const deleteTravelLog = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('travel_logs').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Travel Log:', err);
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
        saveDeliveryTerm,
        deleteDeliveryTerm,
        saveRequisition,
        deleteRequisition,
        saveRequisitionItem,
        deleteRequisitionItem,
        saveTravelLog,
        deleteTravelLog,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
}