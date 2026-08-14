import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
import { supabase } from '@/lib/supabase'; // Garanta a importação direta para operações em lote de peças

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
  'Nível Óleo Motor',
  'Nível Óleo Hidráulico',
  'Líquido Refrigeração',
  'Filtros Ar/Combustível',
  'Estado Lagartas/Pneus/Aperto',
  'Sistema Elétrico/Luzes',
  'Vidros/Espelhos/Cabine',
  'Dispositivos Segurança',
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
function makePart(ref = '', desc = '', qty = 0): WorkOrderPart {
  return { id: `wp-${Date.now()}-${partIdCounter++}`, reference: ref, description: desc, quantity: qty };
}

/**
 * Higieniza apenas a tabela work_orders (sem enviar o array de peças na mesma query)
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
  const { workOrders, equipment, requisitions, requisitionItems, saveWorkOrder, deleteWorkOrder, refreshData } = useData();
  const { profile } = useAuth();
  const { t } = useTheme();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<Partial<WorkOrder>>({});
  const [detailWO, setDetailWO] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

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

    // Procura as peças na tabela dedicada work_order_parts
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
      console.warn('Não foi possível carregar peças relacionais:', e);
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
    console.log('Iniciando salvamento da OS...', form);

    if (!form.equipment_id || !form.description) {
      toast({ title: 'Equipamento e descrição são obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 1. Prepara e salva na tabela work_orders
      const payload = prepareWorkOrderPayload(form, profile?.id);
      console.log('Payload enviado para work_orders:', payload);

      const result = await saveWorkOrder(payload as any);
      console.log('Resultado do saveWorkOrder:', result);

      if (result?.error) {
        throw new Error(typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error));
      }

      // Descobre o ID gerado ou editado
      const savedWoId = form.id || result?.data?.id || result?.[0]?.id;

      // 2. Salva as peças na tabela dedicada work_order_parts (se o ID da OS existir)
      if (savedWoId && form.parts_replaced) {
        // Limpa as peças antigas para evitar duplicidade na edição
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
          console.log('Inserindo peças em work_order_parts:', partsToInsert);
          const { error: partsError } = await supabase.from('work_order_parts').insert(partsToInsert);
          if (partsError) {
            console.error('Erro ao salvar peças:', partsError);
          }
        }
      }

      // Re-sincroniza os dados do estado global
      if (refreshData) await refreshData();

      toast({ title: editing ? 'Folha de obra atualizada' : 'Folha de obra criada com sucesso' });
      setDialogOpen(false);
    } catch (err: any) {
      console.error('ERRO FATAL AO SALVAR:', err);
      toast({
        title: 'Erro ao guardar no Supabase',
        description: err?.message || 'Verifique a consola (F12) para mais detalhes.',
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

      if (refreshData) await refreshData();
      toast({ title: 'Folha de Obra Finalizada', description: `OS ${wo.number} foi concluída.` });
    } catch (err: any) {
      console.error('Erro ao finalizar OS:', err);
      toast({ title: 'Erro inesperado', description: err?.message, variant: 'destructive' });
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await deleteWorkOrder(deleteId);
      if (error) throw new Error(String(error));

      if (refreshData) await refreshData();
      toast({ title: 'Folha de obra eliminada com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao eliminar', description: err?.message, variant: 'destructive' });
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
        title={t('workOrders')}
        description="Gestão de folhas de obra — mecânica, hidráulica e electromecânica"
        action={canEdit && (
          <Button type="button" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t('newWorkOrder')}
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Pesquisar por número, equipamento, S/N, técnico..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Wrench className="w-12 h-12" />} title="Nenhuma folha de obra encontrada" description="Crie a sua primeira Folha de Obra" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('number')}</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Prioridade</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
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
                        <div className="font-medium">{eq?.name || 'Desconhecido'}</div>
                        <div className="text-xs text-muted-foreground">
                          {eq?.serial_number ? `S/N: ${eq.serial_number} • ` : ''}{wo.assigned_technician || 'Sem técnico'}
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
                              title="Finalizar OS"
                            >
                              {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(wo)} title="Visualizar PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(wo)} title="Imprimir / Baixar">
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

      {/* Modal Criar / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Folha de Obra' : 'Nova Folha de Obra'}</DialogTitle>
            <DialogDescription>
              {editing ? `A atualizar os dados da folha ${editing.number}` : 'Preencha os detalhes para abrir uma nova folha de obra.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full py-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
              <TabsTrigger value="parts">Peças</TabsTrigger>
            </TabsList>

            {/* Aba Geral */}
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número da OS</Label>
                  <Input value={form.number || ''} readOnly className="bg-muted font-mono" />
                </div>

                <div className="space-y-2">
                  <Label>Equipamento *</Label>
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
                    <SelectTrigger><SelectValue placeholder="Selecione um equipamento" /></SelectTrigger>
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
                  <Label>Tipo de Serviço</Label>
                  <Select value={form.type || 'mechanical'} onValueChange={(v) => setForm({ ...form, type: v as WorkOrderType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority || 'medium'} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={form.status || 'open'} onValueChange={(v) => setForm({ ...form, status: v as WorkOrderStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Técnico Atribuído</Label>
                  <Input
                    value={form.assigned_technician || ''}
                    onChange={(e) => setForm({ ...form, assigned_technician: e.target.value })}
                    placeholder="Nome do técnico principal"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horas / KM Atuais</Label>
                  <Input
                    type="number"
                    value={form.hour_km_actual ?? ''}
                    onChange={(e) => setForm({ ...form, hour_km_actual: e.target.value })}
                    placeholder="Ex: 1250"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cliente / Projeto</Label>
                  <Input
                    value={form.client_project || ''}
                    onChange={(e) => setForm({ ...form, client_project: e.target.value })}
                    placeholder="Ex: Obra A1 ou Cliente X"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição da Avaria / Pedido *</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Relato de avarias, falhas ou manutenção solicitada"
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Aba Checklist */}
            <TabsContent value="checklist" className="space-y-4 pt-4">
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

            {/* Aba Diagnóstico */}
            <TabsContent value="diagnosis" className="space-y-4 pt-4">
              <div className="space-y-3">
                {(form.diagnosis_lines || []).map((line, idx) => (
                  <div key={line.id || idx} className="flex items-center gap-2">
                    <Input
                      value={line.text}
                      onChange={(e) => updateDiagLine(idx, e.target.value)}
                      placeholder={`Linha de diagnóstico ${idx + 1}`}
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
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Linha
                </Button>
              </div>
            </TabsContent>

            {/* Aba Peças */}
            <TabsContent value="parts" className="space-y-4 pt-4">
              <div className="space-y-3">
                {(form.parts_replaced || []).map((part, idx) => (
                  <div key={part.id || idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={part.reference}
                        onChange={(e) => updatePart(idx, 'reference', e.target.value)}
                        placeholder="Referência/PN"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={part.description}
                        onChange={(e) => updatePart(idx, 'description', e.target.value)}
                        placeholder="Descrição da peça"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={part.quantity || ''}
                        onChange={(e) => updatePart(idx, 'quantity', Number(e.target.value))}
                        placeholder="Qtd"
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
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Peça
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {saving ? 'A guardar...' : editing ? 'Guardar Alterações' : 'Criar Folha de Obra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar Eliminação */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Folha de Obra"
        description="Esta ação removerá permanentemente a folha de obra selecionada. Ação irreversível."
        confirmLabel="Eliminar"
        destructive
      />
    </div>
  );
}