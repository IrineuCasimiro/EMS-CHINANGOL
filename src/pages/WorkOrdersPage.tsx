import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wrench, Plus, Pencil, Trash2, ChevronRight, X, Eye, Printer, Loader2, FileText } from 'lucide-react';
import { WORK_ORDER_STATUS_LABELS, formatDate, generateNumber } from '@/lib/constants';
import { previewPDF, downloadPDF, usePdfGenerator } from '@/lib/pdf';
import type { WorkOrder, WorkOrderStatus, Equipment, PartsRequisitionItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

// --- GERADOR EXATO DO MODELO PDF DE WORK ORDER ---
export const generateWorkOrderPDF = (
  wo: WorkOrder,
  equipment?: Equipment,
  _labor: any[] = [],
  requisitionItems: PartsRequisitionItem[] = []
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  // --- CABEÇALHO PRINCIPAL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('CHINANGOL, LDA', margin, y);

  doc.setFontSize(10);
  doc.setTextColor(218, 41, 28); // Vermelho SANY
  doc.text('SANY DEPARTMENT', margin, y + 5);

  // Título da Ordem no canto direito
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('FOLHA DE OBRA / ORDEM DE', pageWidth - margin, y, { align: 'right' });
  doc.text('SERVIÇO', pageWidth - margin, y + 5, { align: 'right' });

  // Caixa de destaque para o Número da OS
  const boxWidth = 50;
  const boxHeight = 8;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = y + 8;

  doc.setDrawColor(218, 41, 28);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(218, 41, 28);
  doc.text(`Nº ${wo.number || 'OS-2026-A001'}`, boxX + boxWidth / 2, boxY + 5.5, { align: 'center' });

  y += 20;

  // Função Auxiliar para criar as barras de seção estilo Chinangol
  const drawSectionHeader = (title: string, currentY: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, currentY, contentWidth, 6, 'F');

    doc.setFillColor(218, 41, 28);
    doc.rect(margin, currentY, 2, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 5, currentY + 4.2);

    return currentY + 6;
  };

  // --- SEÇÃO 1: IDENTIFICAÇÃO DO EQUIPAMENTO & CLIENTE ---
  y = drawSectionHeader('1. IDENTIFICAÇÃO DO EQUIPAMENTO & CLIENTE', y);

  const eqCode = equipment ? `${equipment.code || ''} ${equipment.name || ''}`.trim() : 'N/A';
  const eqModel = equipment ? equipment.model || '' : '';
  const serialNo = wo.serial_chassis || equipment?.serial_number || '';
  const entryDate = wo.entry_date || wo.start_date || '';
  const horometer = wo.hour_km_actual ? `${wo.hour_km_actual} H` : equipment?.horometer ? `${equipment.horometer} H` : '';
  const clientProject = wo.client_project || '';
  const receptionist = wo.technician_receptionist || wo.assigned_technician || '';

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [180, 210, 235],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [235, 243, 250],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      halign: 'center',
    },
    head: [
      ['ID DO EQUIPAMENTO', 'MODELO', 'No DE SÉRIE / CHASSI', 'DATA DE ENTRADA'],
    ],
    body: [
      [eqCode, eqModel, serialNo, entryDate],
      [
        { content: 'HORÍMETRO / KM ATUAL', fontStyle: 'bold' },
        { content: 'CLIENTE / PROJECTO', fontStyle: 'bold' },
        { content: 'TÉCNICO / RECEPCIONISTA', fontStyle: 'bold', colSpan: 2 },
      ],
      [horometer, clientProject, { content: receptionist, colSpan: 2 }],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // --- SEÇÃO 2: DIAGNÓSTICO TÉCNICO & TRABALHOS SOLICITADOS ---
  y = drawSectionHeader('2. DIAGNÓSTICO TÉCNICO & TRABALHOS SOLICITADOS', y);

  const diagHeight = 28;
  doc.setDrawColor(180, 210, 235);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, diagHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const diagLines = wo.diagnosis_lines || [];
  for (let i = 0; i < 6; i++) {
    const lineText = diagLines[i]?.text || '';
    const lineY = y + 4.5 + i * 4.2;
    doc.text(`${i + 1} - ${lineText}`, margin + 3, lineY);
  }

  y += diagHeight + 3;

  // --- SEÇÃO 3: INSPECÇÃO E CHECKLIST DE ENTRADA ---
  y = drawSectionHeader('3. INSPECÇÃO E CHECKLIST DE ENTRADA', y);

  const checklistHeight = 26;
  doc.setDrawColor(180, 210, 235);
  doc.rect(margin, y, contentWidth, checklistHeight);

  const col1X = margin + 3;
  const col2X = margin + (contentWidth / 2) + 2;

  const getCheckSymbol = (labelSubstring: string) => {
    const item = wo.entry_checklist?.find((c) => c.label.toLowerCase().includes(labelSubstring.toLowerCase()));
    return item?.checked ? '[X]' : '[  ]';
  };

  doc.setFontSize(7.5);
  // Coluna 1
  doc.text(`Nível de Óleo do Motor (OK / Repor) ${getCheckSymbol('motor')}`, col1X, y + 4.5);
  doc.text(`Nível de Óleo Hidráulico (OK / Repor) ${getCheckSymbol('hidráulico')}`, col1X, y + 9);
  doc.text(`Líquido de Refrigeração (Radiador) ${getCheckSymbol('radiador')}`, col1X, y + 13.5);
  doc.text(`Filtros de Ar e Combustível (Estado) ${getCheckSymbol('filtros')}`, col1X, y + 18);
  doc.text(`Estado das Lagartas / Pneus e Aperto ${getCheckSymbol('pneus')}`, col1X, y + 22.5);

  // Coluna 2
  doc.text(`Sistema Elétrico, Luzes e Faróis ${getCheckSymbol('elétrico')}`, col2X, y + 4.5);
  doc.text(`Vidros, Espelhos e Cabine do Operador ${getCheckSymbol('vidros')}`, col2X, y + 9);
  doc.text(`Dispositivos de Segurança / Extintor ${getCheckSymbol('segurança')}`, col2X, y + 13.5);

  // Nível de combustível
  doc.setFont('helvetica', 'bold');
  doc.text('NÍVEL COMBUSTÍVEL: E  [  ]  1/4  [  ]  1/2  [  ]  3/4  [  ]  F  [  ]', col2X, y + 22.5);

  y += checklistHeight + 3;

  // --- SEÇÃO 4: PEÇAS NECESSÁRIAS / SUBSTITUÍDAS (PART REQUEST) ---
  y = drawSectionHeader('4. PEÇAS NECESSÁRIAS / SUBSTITUÍDAS (PART REQUEST)', y);

  const partsData = (wo.parts_replaced && wo.parts_replaced.length > 0)
    ? wo.parts_replaced.map((p) => [p.reference || '-', p.description || '-', p.quantity?.toString() || '1'])
    : requisitionItems.length > 0
    ? requisitionItems.map((item) => [item.part_number || '-', item.description || '-', item.quantity_requested?.toString() || '1'])
    : [];

  while (partsData.length < 5) {
    partsData.push(['', '', '']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [180, 210, 235],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [70, 160, 220],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 50, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 40, halign: 'center' },
    },
    head: [['REFERÊNCIA', 'DESCRIÇÃO DA PEÇA', 'QUANTIDADE']],
    body: partsData,
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // --- SEÇÃO 5: OBSERVAÇÕES DE SAÍDA / NOTAS ADICIONAIS ---
  y = drawSectionHeader('5. OBSERVAÇÕES DE SAÍDA / NOTAS ADICIONAIS', y);

  const obsHeight = 24;
  doc.setDrawColor(180, 210, 235);
  doc.rect(margin, y, contentWidth, obsHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const obsText = wo.exit_observations || '';
  const obsLines = obsText ? obsText.split('\n') : [];

  for (let i = 0; i < 5; i++) {
    const lineText = obsLines[i] || '';
    const lineY = y + 4.5 + i * 4.2;
    doc.text(`${i + 1} - ${lineText}`, margin + 3, lineY);
  }

  y += obsHeight + 20;

  // --- ASSINATURAS DE RODAPÉ ---
  const sigWidth = 50;
  const gap = (contentWidth - sigWidth * 3) / 2;

  const sig1X = margin;
  const sig2X = sig1X + sigWidth + gap;
  const sig3X = sig2X + sigWidth + gap;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);

  doc.line(sig1X, y, sig1X + sigWidth, y);
  doc.line(sig2X, y, sig2X + sigWidth, y);
  doc.line(sig3X, y, sig3X + sigWidth, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  doc.text('MECÂNICO / TÉCNICO', sig1X + sigWidth / 2, y + 4, { align: 'center' });
  doc.text('ENGENHEIRO', sig2X + sigWidth / 2, y + 4, { align: 'center' });
  doc.text('CLIENTE', sig3X + sigWidth / 2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (wo.mechanic_sign) doc.text(wo.mechanic_sign, sig1X + sigWidth / 2, y + 8, { align: 'center' });
  if (wo.engineer_sign) doc.text(wo.engineer_sign, sig2X + sigWidth / 2, y + 8, { align: 'center' });
  if (wo.client_sign) doc.text(wo.client_sign, sig3X + sigWidth / 2, y + 8, { align: 'center' });

  return doc;
};

// --- COMPONENTE DA PÁGINA ---
const STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_parts', label: 'Pending Parts' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 8;

export function WorkOrdersPage() {
  const { workOrders, equipment, requisitionItems, saveWorkOrder, deleteWorkOrder } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { generateAndSave } = usePdfGenerator();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<Partial<WorkOrder>>({});
  const [detailWO, setDetailWO] = useState<WorkOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'user';
  const canDelete = profile?.role === 'admin';

  const filtered = useMemo(() => {
    return workOrders.filter((w) => {
      const matchSearch = !search ||
        w.number.toLowerCase().includes(search.toLowerCase()) ||
        (w.client_project && w.client_project.toLowerCase().includes(search.toLowerCase())) ||
        (w.assigned_technician && w.assigned_technician.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [workOrders, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      number: generateNumber('OS-2026', workOrders.map((w) => w.number)),
      status: 'open',
      client_project: 'CHINANGOL, LDA',
      entry_date: new Date().toISOString().split('T')[0],
      assigned_technician: profile?.full_name || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (wo: WorkOrder) => {
    setEditing(wo);
    setForm({ ...wo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.number) {
      toast({ title: 'Work Order number is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        updated_at: new Date().toISOString(),
      };

      const { error } = await saveWorkOrder(payload as WorkOrder);
      if (error) {
        toast({ title: 'Error saving Work Order', description: error, variant: 'destructive' });
        return;
      }

      toast({ title: editing ? 'Work Order updated successfully' : 'Work Order created successfully' });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error saving Work Order', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteWorkOrder(deleteId);
    if (error) {
      toast({ title: 'Error deleting Work Order', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Work Order deleted successfully' });
    }
    setDeleteId(null);
  };

  const handleStatusChange = async (wo: WorkOrder, status: WorkOrderStatus) => {
    const updates: Partial<WorkOrder> = { id: wo.id, status, updated_at: new Date().toISOString() };
    const { error } = await saveWorkOrder({ ...wo, ...updates } as WorkOrder);
    if (error) {
      toast({ title: 'Error updating status', description: error, variant: 'destructive' });
    } else {
      toast({ title: `Status changed to ${WORK_ORDER_STATUS_LABELS[status] || status}` });
      if (detailWO?.id === wo.id) {
        setDetailWO({ ...detailWO, ...updates } as WorkOrder);
      }
    }
  };

  const handlePreview = (wo: WorkOrder) => {
    const eq = equipment.find((e) => e.id === wo.equipment_id);
    const reqItems = requisitionItems.filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    previewPDF(doc);
  };

  const handleDownload = (wo: WorkOrder) => {
    const eq = equipment.find((e) => e.id === wo.equipment_id);
    const reqItems = requisitionItems.filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    downloadPDF(doc, `${wo.number}.pdf`);
  };

  const handleSaveAndUpload = async (wo: WorkOrder) => {
    const eq = equipment.find((e) => e.id === wo.equipment_id);
    const reqItems = requisitionItems.filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    const { error } = await generateAndSave(doc, 'work_order', wo.id, wo.number, `Work Order ${wo.number}`);
    if (error) {
      toast({ title: 'Error saving PDF', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'PDF generated and stored in system', description: `${wo.number}.pdf saved in documents` });
    }
  };

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Manage equipment repair and maintenance Work Orders"
        action={canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Work Order
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by OS number, client, technician..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Wrench className="w-12 h-12" />} title="No Work Orders found" description="Create your first equipment Work Order" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS Number</TableHead>
                  <TableHead className="hidden md:table-cell">Client / Project</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="hidden sm:table-cell">Entry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((wo) => {
                  return (
                    <TableRow key={wo.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setDetailWO(wo)}>
                      <TableCell className="font-mono font-medium">{wo.number}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{wo.client_project || '—'}</TableCell>
                      <TableCell>{wo.assigned_technician || wo.technician_receptionist || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{wo.entry_date || wo.start_date || '—'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select value={wo.status} onValueChange={(v) => handleStatusChange(wo, v as WorkOrderStatus)}>
                          <SelectTrigger className="w-[130px] h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(wo)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(wo)} title="Download PDF">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailWO(wo)}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(wo)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(wo.id)}>
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
            <DialogTitle>{editing ? 'Edit Work Order' : 'New Work Order'}</DialogTitle>
            <DialogDescription>Fill in equipment and service details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OS Number *</Label>
                <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} className="font-mono" placeholder="OS-2026-A001" />
              </div>
              <div className="space-y-2">
                <Label>Entry Date</Label>
                <Input type="date" value={form.entry_date || ''} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={form.equipment_id || 'none'} onValueChange={(v) => {
                  const eq = equipment.find((e) => e.id === v);
                  setForm({
                    ...form,
                    equipment_id: v === 'none' ? null : v,
                    serial_chassis: eq?.serial_number || form.serial_chassis,
                    hour_km_actual: eq?.horometer ? String(eq.horometer) : form.hour_km_actual,
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select Equipment..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client / Project</Label>
                <Input value={form.client_project || ''} onChange={(e) => setForm({ ...form, client_project: e.target.value })} placeholder="CHINANGOL, LDA" />
              </div>
              <div className="space-y-2">
                <Label>Serial / Chassis No.</Label>
                <Input value={form.serial_chassis || ''} onChange={(e) => setForm({ ...form, serial_chassis: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horometer / KM</Label>
                <Input value={form.hour_km_actual || ''} onChange={(e) => setForm({ ...form, hour_km_actual: e.target.value })} placeholder="Ex: 1250 H" />
              </div>
              <div className="space-y-2">
                <Label>Technician / Receptionist</Label>
                <Input value={form.technician_receptionist || form.assigned_technician || ''} onChange={(e) => setForm({ ...form, technician_receptionist: e.target.value, assigned_technician: e.target.value })} />
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
              <Label>Exit Observations / Additional Notes</Label>
              <Textarea value={form.exit_observations || ''} onChange={(e) => setForm({ ...form, exit_observations: e.target.value })} rows={3} placeholder="Write exit notes or general observations..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes */}
      <Dialog open={!!detailWO} onOpenChange={(open) => !open && setDetailWO(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailWO && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailWO.number}
                  <StatusBadge status={detailWO.status} label={WORK_ORDER_STATUS_LABELS[detailWO.status]} />
                </DialogTitle>
                <DialogDescription>
                  Technician: {detailWO.assigned_technician || detailWO.technician_receptionist || 'N/A'} · Entry: {detailWO.entry_date || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/40 rounded-lg">
                  <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{detailWO.client_project || '—'}</span></div>
                  <div><span className="text-muted-foreground">Chassis/Serial:</span> <span className="font-medium">{detailWO.serial_chassis || '—'}</span></div>
                  <div><span className="text-muted-foreground">Horometer:</span> <span className="font-medium">{detailWO.hour_km_actual || '—'}</span></div>
                  <div><span className="text-muted-foreground">Entry Date:</span> <span className="font-medium">{detailWO.entry_date || '—'}</span></div>
                </div>

                {detailWO.exit_observations && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Exit Observations</Label>
                    <p className="text-sm p-3 bg-muted/20 border rounded-md whitespace-pre-line">{detailWO.exit_observations}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => handlePreview(detailWO)}><Eye className="w-4 h-4 mr-1" />Preview PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(detailWO)}><Printer className="w-4 h-4 mr-1" />Download PDF</Button>
                  <Button size="sm" onClick={() => handleSaveAndUpload(detailWO)}><FileText className="w-4 h-4 mr-1" />Save to Documents</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Work Order"
        description="This action is permanent and will delete this Work Order."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}