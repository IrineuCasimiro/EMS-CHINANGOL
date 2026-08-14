import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared';
import { FilterBar, Pagination, StatusFilter } from '@/components/shared/table-helpers';
import { ConfirmDialog } from '@/components/shared/dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wrench, Plus, Pencil, Trash2, Eye, Printer, Loader2, CheckCircle2 } from 'lucide-react';
import {
  WORK_ORDER_STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS, generateNumber,
} from '@/lib/constants';
import { generateWorkOrderPDF, previewPDF, downloadPDF } from '@/lib/pdf';
import type { WorkOrder, WorkOrderType, WorkOrderStatus, Priority, ChecklistItem, DiagnosisLine, WorkOrderPart } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const TYPES: { value: WorkOrderType; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'electromechanical', label: 'Electromechanical' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'other', label: 'Other' },
];

const STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_parts', label: 'Waiting for Parts' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const ENTRY_CHECKLIST_ITEMS = [
  'Engine Oil Level',
  'Hydraulic Oil Level',
  'Coolant / Radiator Liquid',
  'Air / Fuel Filters State',
  'Tracks / Tires & Tightness',
  'Electrical System & Lights',
  'Glass / Mirrors / Operator Cab',
  'Safety Devices & Extinguisher',
];

const PAGE_SIZE = 8;

function makeChecklist(): ChecklistItem[] {
  return ENTRY_CHECKLIST_ITEMS.map((label, i) => ({ id: `wc${i}`, label, checked: false, note: '' }));
}

let diagIdCounter = 0;
function makeDiagnosisLine(text = ''): DiagnosisLine {
  return { id: `dl-${Date.now()}-${diagIdCounter++}`, text };
}

let partIdCounter = 0;
function makePart(ref = '', desc = '', qty = 1): WorkOrderPart {
  return { id: `wp-${Date.now()}-${partIdCounter++}`, reference: ref, description: desc, quantity: qty };
}

/**
 * Normalizes and sanitizes work order payload for Supabase insertion/update
 */
function prepareWorkOrderPayload(data: Partial<WorkOrder>, userId?: string) {
  const cleanDiagnosis = (data.diagnosis_lines || [])
    .filter((line) => line.text && line.text.trim() !== '')
    .map(({ id, ...rest }) => rest);

  const cleanChecklist = (data.entry_checklist || []).map((item) => ({
    id: item.id,
    label: item.label,
    checked: Boolean(item.checked),
    note: item.note || '',
  }));

  const payload: Record<string, any> = {
    number: data.number,
    equipment_id: data.equipment_id,
    type: data.type || 'mechanical',
    status: data.status || 'open',
    priority: data.priority || 'medium',
    description: data.description || '',
    start_date: data.start_date || new Date().toISOString().split('T')[0],
    entry_date: data.entry_date || new Date().toISOString().split('T')[0],
    end_date: data.end_date ? data.end_date : null,
    assigned_technician: data.assigned_technician?.trim() || null,
    serial_chassis: data.serial_chassis?.trim() || null,
    hour_km_actual: data.hour_km_actual !== undefined && data.hour_km_actual !== '' ? Number(data.hour_km_actual) : null,
    client_project: data.client_project?.trim() || null,
    technician_receptionist: data.technician_receptionist?.trim() || null,
    exit_observations: data.exit_observations?.trim() || null,
    mechanic_sign: data.mechanic_sign?.trim() || null,
    engineer_sign: data.engineer_sign?.trim() || null,
    client_sign: data.client_sign?.trim() || null,
    diagnosis_lines: cleanDiagnosis,
    entry_checklist: cleanChecklist,
  };

  if (data.id) {
    payload.id = data.id;
  } else if (userId) {
    payload.user_id = userId;
  }

  return payload;
}

export function WorkOrdersPage() {
  const { workOrders, equipment, requisitions, requisitionItems, saveWorkOrder, deleteWorkOrder, refresh, refreshData } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<Partial<WorkOrder>>({});
  const [, setDetailWO] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const triggerRefresh = refresh || refreshData;

  const canEdit = profile?.role === 'admin' || profile?.role === 'equipment_manager' || profile?.role === 'workshop_supervisor' || profile?.role === 'user';
  const canDelete = profile?.role === 'admin' || profile?.role === 'equipment_manager';

  const getEquipment = (id: string) => equipment.find((e) => e.id === id);

  const filtered = useMemo(() => {
    return workOrders.filter((w) => {
      const eq = getEquipment(w.equipment_id);
      const matchSearch = !search ||
        w.number.toLowerCase().includes(search.toLowerCase()) ||
        (eq?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (eq?.serial_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (w.assigned_technician || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [workOrders, equipment, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      number: generateNumber('OS', workOrders.map((w) => w.number)),
      type: 'mechanical',
      status: 'open',
      priority: 'medium',
      start_date: new Date().toISOString().split('T')[0],
      entry_date: new Date().toISOString().split('T')[0],
      diagnosis_lines: [makeDiagnosisLine()],
      entry_checklist: makeChecklist(),
      parts_replaced: [],
      serial_chassis: '',
      hour_km_actual: '',
      client_project: '',
      technician_receptionist: profile?.full_name || '',
      exit_observations: '',
      mechanic_sign: '',
      engineer_sign: '',
      client_sign: '',
    });
    setDialogOpen(true);
  };

  const openEdit = async (wo: WorkOrder) => {
    setEditing(wo);

    let currentParts = wo.parts_replaced || [];
    try {
      const { data: dbParts } = await supabase
        .from('work_order_parts')
        .select('*')
        .eq('work_order_id', wo.id);
      if (dbParts && dbParts.length > 0) {
        currentParts = dbParts;
      }
    } catch (e) {
      console.warn('Could not load work order parts from relational table:', e);
    }

    setForm({
      ...wo,
      diagnosis_lines: wo.diagnosis_lines?.length ? wo.diagnosis_lines : [makeDiagnosisLine()],
      entry_checklist: wo.entry_checklist?.length ? wo.entry_checklist : makeChecklist(),
      parts_replaced: currentParts,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipment_id || !form.description) {
      toast({ title: 'Validation Error', description: 'Equipment and Description are required fields.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = prepareWorkOrderPayload(form, profile?.id);
      const result = await saveWorkOrder(payload as any);

      if (result?.error) {
        throw new Error(typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error));
      }

      const savedWoId = form.id || result?.data?.id;

      if (savedWoId && form.parts_replaced) {
        await supabase.from('work_order_parts').delete().eq('work_order_id', savedWoId);

        const partsToInsert = (form.parts_replaced || [])
          .filter((p) => p.description?.trim() || p.reference?.trim())
          .map((p) => ({
            work_order_id: savedWoId,
            reference: p.reference || '',
            description: p.description || '',
            quantity: Number(p.quantity) || 1,
          }));

        if (partsToInsert.length > 0) {
          const { error: partsError } = await supabase.from('work_order_parts').insert(partsToInsert);
          if (partsError) console.error('Error inserting parts:', partsError);
        }
      }

      if (triggerRefresh) await triggerRefresh();

      toast({ title: 'Success', description: editing ? 'Work Order updated successfully.' : 'Work Order created successfully.' });
      setDialogOpen(false);
    } catch (err: any) {
      console.error('Fatal error saving Work Order:', err);
      toast({
        title: 'Error Saving to Supabase',
        description: err?.message || 'Check browser console (F12) for details.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeWorkOrder = async (wo: WorkOrder) => {
    setCompletingId(wo.id);
    try {
      const updatedForm: Partial<WorkOrder> = {
        ...wo,
        status: 'completed',
        end_date: new Date().toISOString().split('T')[0],
      };

      const payload = prepareWorkOrderPayload(updatedForm, profile?.id);
      const result = await saveWorkOrder(payload as any);

      if (result?.error) throw new Error(String(result.error));

      if (triggerRefresh) await triggerRefresh();
      toast({ title: 'Work Order Completed', description: `WO ${wo.number} has been closed.` });
    } catch (err: any) {
      console.error('Error completing WO:', err);
      toast({ title: 'Error Completing WO', description: err?.message, variant: 'destructive' });
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await deleteWorkOrder(deleteId);
      if (error) throw new Error(String(error));

      if (triggerRefresh) await triggerRefresh();
      toast({ title: 'Work Order Deleted' });
    } catch (err: any) {
      toast({ title: 'Error Deleting', description: err?.message, variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const getPartsForWO = (woId: string) => {
    const reqIds = requisitions.filter((r) => r.work_order_id === woId).map((r) => r.id);
    return requisitionItems.filter((i) => reqIds.includes(i.requisition_id));
  };

  const handlePreview = (wo: WorkOrder) => {
    const eq = getEquipment(wo.equipment_id);
    const items = getPartsForWO(wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], items);
    previewPDF(doc);
  };

  const handleDownload = (wo: WorkOrder) => {
    const eq = getEquipment(wo.equipment_id);
    const items = getPartsForWO(wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], items);
    downloadPDF(doc, `${wo.number}.pdf`);
  };

  const toggleChecklist = (idx: number, checked: boolean) => {
    const checklist = [...(form.entry_checklist || [])];
    checklist[idx] = { ...checklist[idx], checked };
    setForm({ ...form, entry_checklist: checklist });
  };

  const updateDiagLine = (idx: number, text: string) => {
    const lines = [...(form.diagnosis_lines || [])];
    lines[idx] = { ...lines[idx], text };
    setForm({ ...form, diagnosis_lines: lines });
  };

  const addDiagLine = () => {
    setForm({ ...form, diagnosis_lines: [...(form.diagnosis_lines || []), makeDiagnosisLine()] });
  };

  const removeDiagLine = (idx: number) => {
    const lines = (form.diagnosis_lines || []).filter((_, i) => i !== idx);
    setForm({ ...form, diagnosis_lines: lines });
  };

  const updatePart = (idx: number, field: keyof WorkOrderPart, value: string | number) => {
    const parts = [...(form.parts_replaced || [])];
    parts[idx] = { ...parts[idx], [field]: value };
    setForm({ ...form, parts_replaced: parts });
  };

  const addPart = () => {
    setForm({ ...form, parts_replaced: [...(form.parts_replaced || []), makePart()] });
  };

  const removePart = (idx: number) => {
    const parts = (form.parts_replaced || []).filter((_, i) => i !== idx);
    setForm({ ...form, parts_replaced: parts });
  };

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Management of workshop service orders — mechanical, hydraulic, and electromechanical."
        action={canEdit && (
          <Button type="button" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Work Order
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by number, equipment, serial number, technician..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Wrench className="w-12 h-12" />} title="No Work Orders Found" description="Create your first Work Order to start tracking." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((wo) => {
                  const eq = getEquipment(wo.equipment_id);
                  const isCompleting = completingId === wo.id;
                  return (
                    <TableRow key={wo.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setDetailWO(wo)}>
                      <TableCell className="font-mono font-medium">{wo.number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{eq?.name || 'Unknown Equipment'}</div>
                        <div className="text-xs text-muted-foreground">
                          {eq?.serial_number ? `S/N: ${eq.serial_number} • ` : ''}{wo.assigned_technician || 'No Tech Assigned'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell capitalize">{wo.type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[wo.priority])}>
                          {PRIORITY_LABELS[wo.priority]}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={wo.status} label={WORK_ORDER_STATUS_LABELS[wo.status]} /></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canEdit && wo.status !== 'completed' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleFinalizeWorkOrder(wo)}
                              disabled={isCompleting}
                              title="Complete Work Order"
                            >
                              {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(wo)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(wo)} title="Print / Download PDF">
                            <Printer className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(wo)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(wo.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      )}

      {/* Modal Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Work Order' : 'New Work Order'}</DialogTitle>
            <DialogDescription>
              {editing ? `Updating details for ${editing.number}` : 'Fill in the details to open a new service order.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full py-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="parts">Parts Required</TabsTrigger>
              <TabsTrigger value="signoff">Sign-Off</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WO Number</Label>
                  <Input value={form.number || ''} readOnly className="bg-muted font-mono" />
                </div>

                <div className="space-y-2">
                  <Label>Equipment *</Label>
                  <Select
                    value={form.equipment_id || ''}
                    onValueChange={(v) => {
                      const eq = equipment.find((e) => e.id === v);
                      setForm({
                        ...form,
                        equipment_id: v,
                        serial_chassis: eq?.serial_number || form.serial_chassis,
                        hour_km_actual: eq?.horometer || eq?.odometer || form.hour_km_actual,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Equipment" /></SelectTrigger>
                    <SelectContent>
                      {equipment.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.brand} {e.model}) - {e.serial_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Serial / Chassis No.</Label>
                  <Input
                    value={form.serial_chassis || ''}
                    onChange={(e) => setForm({ ...form, serial_chassis: e.target.value })}
                    placeholder="e.g. BC5260CG1383"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={form.entry_date || ''}
                    onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current Horometer / Odometer (KM/H)</Label>
                  <Input
                    type="number"
                    value={form.hour_km_actual ?? ''}
                    onChange={(e) => setForm({ ...form, hour_km_actual: e.target.value })}
                    placeholder="e.g. 51.3 H"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Client / Project</Label>
                  <Input
                    value={form.client_project || ''}
                    onChange={(e) => setForm({ ...form, client_project: e.target.value })}
                    placeholder="e.g. OMATAPALO / Site A"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Receptionist / Lead Tech</Label>
                  <Input
                    value={form.technician_receptionist || ''}
                    onChange={(e) => setForm({ ...form, technician_receptionist: e.target.value })}
                    placeholder="e.g. SACULILA"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assigned Mechanic</Label>
                  <Input
                    value={form.assigned_technician || ''}
                    onChange={(e) => setForm({ ...form, assigned_technician: e.target.value })}
                    placeholder="Assigned technician name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={form.type || 'mechanical'} onValueChange={(v) => setForm({ ...form, type: v as WorkOrderType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority || 'medium'} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status || 'open'} onValueChange={(v) => setForm({ ...form, status: v as WorkOrderStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fault / Maintenance Description *</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Reported faults, issues, or requested service operations"
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Diagnosis Tab */}
            <TabsContent value="diagnosis" className="space-y-4 pt-4">
              <Label className="text-base font-semibold">2. Technical Diagnosis & Requested Tasks</Label>
              <div className="space-y-3">
                {(form.diagnosis_lines || []).map((line, idx) => (
                  <div key={line.id || idx} className="flex items-center gap-2">
                    <span className="text-sm font-semibold w-6">{idx + 1}.</span>
                    <Input
                      value={line.text}
                      onChange={(e) => updateDiagLine(idx, e.target.value)}
                      placeholder={`Task / Diagnosis line ${idx + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeDiagLine(idx)}
                      disabled={(form.diagnosis_lines || []).length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDiagLine}>
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
            </TabsContent>

            {/* Inspection & Checklist Tab */}
            <TabsContent value="checklist" className="space-y-4 pt-4">
              <Label className="text-base font-semibold">3. Entry Inspection & Checklist</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(form.entry_checklist || []).map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between border p-3 rounded-lg">
                    <span className="text-sm font-medium">{item.label}</span>
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(checked) => toggleChecklist(idx, Boolean(checked))}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Parts Tab */}
            <TabsContent value="parts" className="space-y-4 pt-4">
              <Label className="text-base font-semibold">4. Required / Replaced Parts (Part Request)</Label>
              <div className="space-y-3">
                {(form.parts_replaced || []).map((part, idx) => (
                  <div key={part.id || idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={part.reference}
                        onChange={(e) => updatePart(idx, 'reference', e.target.value)}
                        placeholder="Part Reference / P/N"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={part.description}
                        onChange={(e) => updatePart(idx, 'description', e.target.value)}
                        placeholder="Part Description"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={part.quantity || ''}
                        onChange={(e) => updatePart(idx, 'quantity', Number(e.target.value))}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removePart(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                  <Plus className="w-4 h-4 mr-1" /> Add Part
                </Button>
              </div>
            </TabsContent>

            {/* Sign-Off Tab */}
            <TabsContent value="signoff" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>5. Exit Observations / Additional Notes</Label>
                  <Textarea
                    value={form.exit_observations || ''}
                    onChange={(e) => setForm({ ...form, exit_observations: e.target.value })}
                    placeholder="Enter final remarks, testing status, or exit notes..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Mechanic / Technician Sign-off</Label>
                    <Input
                      value={form.mechanic_sign || ''}
                      onChange={(e) => setForm({ ...form, mechanic_sign: e.target.value })}
                      placeholder="Technician Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Engineer / Supervisor Sign-off</Label>
                    <Input
                      value={form.engineer_sign || ''}
                      onChange={(e) => setForm({ ...form, engineer_sign: e.target.value })}
                      placeholder="Engineer Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Sign-off</Label>
                    <Input
                      value={form.client_sign || ''}
                      onChange={(e) => setForm({ ...form, client_sign: e.target.value })}
                      placeholder="Client Representative Name"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Work Order"
        description="Are you sure you want to permanently delete this work order? This action cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}