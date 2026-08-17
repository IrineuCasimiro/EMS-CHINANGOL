import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkOrder, Equipment, PartsRequisitionItem } from '@/types';

interface DataContextType {
  workOrders: WorkOrder[];
  equipment: Equipment[];
  requisitionItems: PartsRequisitionItem[];
  loading: boolean;
  refreshData: () => Promise<void>;
  saveWorkOrder: (wo: WorkOrder) => Promise<{ success: boolean; error?: string }>;
  deleteWorkOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveEquipment: (eq: Partial<Equipment>) => Promise<{ success: boolean; error?: string }>;
  deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<PartsRequisitionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (woError) console.error('Erro ao carregar work_orders:', woError.message);
      else setWorkOrders(woData || []);

      const { data: eqData, error: eqError } = await supabase
        .from('equipment')
        .select('*');

      if (eqError) console.error('Erro ao carregar equipment:', eqError.message);
      else setEquipment(eqData || []);

      const { data: reqData, error: reqError } = await supabase
        .from('parts_requisition_items')
        .select('*');

      if (reqError) console.error('Erro ao carregar parts_requisition_items:', reqError.message);
      else setRequisitionItems(reqData || []);

    } catch (err: any) {
      console.error('Erro geral ao atualizar dados:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
        const { error: updateError } = await supabase
          .from('work_orders')
          .update(payload)
          .eq('id', wo.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('work_orders')
          .insert([payload]);
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
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Work Order:', err);
      return { success: false, error: err.message };
    }
  };

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
        const { error: updateError } = await supabase
          .from('equipment')
          .update(payload)
          .eq('id', eq.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('equipment')
          .insert([payload]);
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
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao eliminar Equipment:', err);
      return { success: false, error: err.message };
    }
  };

  return (
    <DataContext.Provider
      value={{
        workOrders,
        equipment,
        requisitionItems,
        loading,
        refreshData,
        saveWorkOrder,
        deleteWorkOrder,
        saveEquipment,
        deleteEquipment,
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