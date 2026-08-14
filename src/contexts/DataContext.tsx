import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type {
  Equipment,
  Inspection,
  WorkOrder,
  WorkOrderLabor,
  TravelLog,
  PartsRequisition,
  PartsRequisitionItem,
  DocumentRecord,
} from '@/types';

interface DataContextValue {
  equipment: Equipment[];
  inspections: Inspection[];
  workOrders: WorkOrder[];
  laborEntries: WorkOrderLabor[];
  travelLogs: TravelLog[];
  requisitions: PartsRequisition[];
  requisitionItems: PartsRequisitionItem[];
  documents: DocumentRecord[];
  loading: boolean;
  refresh: () => void;
  saveEquipment: (eq: Partial<Equipment>) => Promise<{ error: string | null; data?: Equipment }>;
  deleteEquipment: (id: string) => Promise<{ error: string | null }>;
  saveWorkOrder: (wo: Partial<WorkOrder>) => Promise<{ error: string | null; data?: WorkOrder }>;
  deleteWorkOrder: (id: string) => Promise<{ error: string | null }>;
  saveLabor: (labor: Partial<WorkOrderLabor>) => Promise<{ error: string | null }>;
  deleteLabor: (id: string) => Promise<{ error: string | null }>;
  saveInspection: (insp: Partial<Inspection>) => Promise<{ error: string | null; data?: Inspection }>;
  deleteInspection: (id: string) => Promise<{ error: string | null }>;
  saveTravelLog: (tl: Partial<TravelLog>) => Promise<{ error: string | null; data?: TravelLog }>;
  deleteTravelLog: (id: string) => Promise<{ error: string | null }>;
  saveRequisition: (req: Partial<PartsRequisition>) => Promise<{ error: string | null; data?: PartsRequisition }>;
  deleteRequisition: (id: string) => Promise<{ error: string | null }>;
  saveRequisitionItem: (item: Partial<PartsRequisitionItem>) => Promise<{ error: string | null; data?: PartsRequisitionItem }>;
  deleteRequisitionItem: (id: string) => Promise<{ error: string | null }>;
  saveDocument: (doc: Partial<DocumentRecord>) => Promise<{ error: string | null }>;
  deleteDocument: (id: string) => Promise<{ error: string | null }>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [laborEntries, setLaborEntries] = useState<WorkOrderLabor[]>([]);
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([]);
  const [requisitions, setRequisitions] = useState<PartsRequisition[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<PartsRequisitionItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [eqRes, inspRes, woRes, laborRes, tlRes, reqRes, reqItemsRes, docRes] = await Promise.all([
          supabase.from('equipment').select('*').order('created_at', { ascending: false }),
          supabase.from('inspections').select('*').order('inspection_date', { ascending: false }),
          supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
          supabase.from('work_order_labor').select('*').order('date', { ascending: false }),
          supabase.from('travel_logs').select('*').order('created_at', { ascending: false }),
          supabase.from('parts_requisitions').select('*').order('created_at', { ascending: false }),
          supabase.from('parts_requisition_items').select('*').order('created_at', { ascending: false }),
          supabase.from('documents').select('*').order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        if (eqRes.data) setEquipment(eqRes.data as Equipment[]);
        if (inspRes.data) setInspections(inspRes.data as Inspection[]);
        if (woRes.data) setWorkOrders(woRes.data as WorkOrder[]);
        if (laborRes.data) setLaborEntries(laborRes.data as WorkOrderLabor[]);
        if (tlRes.data) setTravelLogs(tlRes.data as TravelLog[]);
        if (reqRes.data) setRequisitions(reqRes.data as PartsRequisition[]);
        if (reqItemsRes.data) setRequisitionItems(reqItemsRes.data as PartsRequisitionItem[]);
        if (docRes.data) setDocuments(docRes.data as DocumentRecord[]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const saveEquipment = async (eq: Partial<Equipment>) => {
    const { data, error } = eq.id
      ? await supabase.from('equipment').update(eq).eq('id', eq.id).select().maybeSingle()
      : await supabase.from('equipment').insert(eq).select().maybeSingle();
    if (error) return { error: error.message };
    if (data && !eq.id) setEquipment((prev) => [data as Equipment, ...prev]);
    else if (data) setEquipment((prev) => prev.map((e) => (e.id === data.id ? data as Equipment : e)));
    return { error: null, data: data as Equipment };
  };

  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) return { error: error.message };
    setEquipment((prev) => prev.filter((e) => e.id !== id));
    return { error: null };
  };

  const saveWorkOrder = async (wo: Partial<WorkOrder>) => {
    const { data, error } = wo.id
      ? await supabase.from('work_orders').update(wo).eq('id', wo.id).select().maybeSingle()
      : await supabase.from('work_orders').insert(wo).select().maybeSingle();
    if (error) return { error: error.message };
    if (data && !wo.id) setWorkOrders((prev) => [data as WorkOrder, ...prev]);
    else if (data) setWorkOrders((prev) => prev.map((w) => (w.id === data.id ? data as WorkOrder : w)));
    return { error: null, data: data as WorkOrder };
  };

  const deleteWorkOrder = async (id: string) => {
    const { error } = await supabase.from('work_orders').delete().eq('id', id);
    if (error) return { error: error.message };
    setWorkOrders((prev) => prev.filter((w) => w.id !== id));
    return { error: null };
  };

  const saveLabor = async (labor: Partial<WorkOrderLabor>) => {
    const { error } = labor.id
      ? await supabase.from('work_order_labor').update(labor).eq('id', labor.id)
      : await supabase.from('work_order_labor').insert(labor);
    if (error) return { error: error.message };
    refresh();
    return { error: null };
  };

  const deleteLabor = async (id: string) => {
    const { error } = await supabase.from('work_order_labor').delete().eq('id', id);
    if (error) return { error: error.message };
    setLaborEntries((prev) => prev.filter((l) => l.id !== id));
    return { error: null };
  };

  const saveInspection = async (insp: Partial<Inspection>) => {
    const { data, error } = insp.id
      ? await supabase.from('inspections').update(insp).eq('id', insp.id).select().maybeSingle()
      : await supabase.from('inspections').insert(insp).select().maybeSingle();
    if (error) return { error: error.message };
    if (data && !insp.id) setInspections((prev) => [data as Inspection, ...prev]);
    else if (data) setInspections((prev) => prev.map((i) => (i.id === data.id ? data as Inspection : i)));
    return { error: null, data: data as Inspection };
  };

  const deleteInspection = async (id: string) => {
    const { error } = await supabase.from('inspections').delete().eq('id', id);
    if (error) return { error: error.message };
    setInspections((prev) => prev.filter((i) => i.id !== id));
    return { error: null };
  };

  const saveTravelLog = async (tl: Partial<TravelLog>) => {
    try {
      const isTempId = tl.id?.toString().startsWith('temp-');
      const isUpdate = Boolean(tl.id && !isTempId);

      const { id, created_at, updated_at, ...payload } = tl as any;

      if (!payload.vehicle_id || payload.vehicle_id === '' || payload.vehicle_id === 'none') {
        payload.vehicle_id = null;
      }
      if (!payload.arrival_date || payload.arrival_date === '') {
        payload.arrival_date = null;
      }
      if (!payload.arrival_time || payload.arrival_time === '') {
        payload.arrival_time = null;
      }

      const { data, error } = isUpdate
        ? await supabase.from('travel_logs').update(payload).eq('id', tl.id!).select().maybeSingle()
        : await supabase.from('travel_logs').insert(payload).select().maybeSingle();

      if (error) {
        console.error('Erro no Supabase (travel_logs):', error);
        return { error: error.message };
      }

      if (data) {
        setTravelLogs((prev) => {
          const exists = prev.some((t) => t.id === data.id);
          if (exists) {
            return prev.map((t) => (t.id === data.id ? (data as TravelLog) : t));
          }
          return [data as TravelLog, ...prev];
        });
      }

      return { error: null, data: data as TravelLog };
    } catch (err: any) {
      console.error('Exceção ao salvar guia de viagem:', err);
      return { error: err.message || 'Erro desconhecido ao salvar guia de viagem.' };
    }
  };

  const deleteTravelLog = async (id: string) => {
    const { error } = await supabase.from('travel_logs').delete().eq('id', id);
    if (error) return { error: error.message };
    setTravelLogs((prev) => prev.filter((t) => t.id !== id));
    return { error: null };
  };

  const saveRequisition = async (req: Partial<PartsRequisition>) => {
    const { data, error } = req.id
      ? await supabase.from('parts_requisitions').update(req).eq('id', req.id).select().maybeSingle()
      : await supabase.from('parts_requisitions').insert(req).select().maybeSingle();
    if (error) return { error: error.message };
    if (data && !req.id) setRequisitions((prev) => [data as PartsRequisition, ...prev]);
    else if (data) setRequisitions((prev) => prev.map((r) => (r.id === data.id ? data as PartsRequisition : r)));
    return { error: null, data: data as PartsRequisition };
  };

  const deleteRequisition = async (id: string) => {
    const { error } = await supabase.from('parts_requisitions').delete().eq('id', id);
    if (error) return { error: error.message };
    setRequisitions((prev) => prev.filter((r) => r.id !== id));
    return { error: null };
  };

  const saveRequisitionItem = async (item: Partial<PartsRequisitionItem>) => {
    const { data, error } = item.id
      ? await supabase.from('parts_requisition_items').update(item).eq('id', item.id).select().maybeSingle()
      : await supabase.from('parts_requisition_items').insert(item).select().maybeSingle();

    if (error) {
      console.error('Erro no Supabase (parts_requisition_items):', error);
      return { error: error.message };
    }

    refresh();
    return { error: null, data: data as PartsRequisitionItem };
  };

  const deleteRequisitionItem = async (id: string) => {
    const { error } = await supabase.from('parts_requisition_items').delete().eq('id', id);
    if (error) return { error: error.message };
    setRequisitionItems((prev) => prev.filter((i) => i.id !== id));
    return { error: null };
  };

  const saveDocument = async (doc: Partial<DocumentRecord>) => {
    const { error } = await supabase.from('documents').insert(doc);
    if (error) return { error: error.message };
    refresh();
    return { error: null };
  };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) return { error: error.message };
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    return { error: null };
  };

  const value: DataContextValue = {
    equipment, inspections, workOrders, laborEntries, travelLogs,
    requisitions, requisitionItems, documents, loading, refresh,
    saveEquipment, deleteEquipment,
    saveWorkOrder, deleteWorkOrder,
    saveLabor, deleteLabor,
    saveInspection, deleteInspection,
    saveTravelLog, deleteTravelLog,
    saveRequisition, deleteRequisition,
    saveRequisitionItem, deleteRequisitionItem,
    saveDocument, deleteDocument,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}