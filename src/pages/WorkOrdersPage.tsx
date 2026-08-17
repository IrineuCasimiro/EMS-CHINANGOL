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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wrench, Plus, Pencil, Trash2, ChevronRight, Eye, Printer, Loader2, FileText, X } from 'lucide-react';
import { WORK_ORDER_STATUS_LABELS, generateNumber } from '@/lib/constants';
import { previewPDF, downloadPDF, usePdfGenerator } from '@/lib/pdf';
import type { WorkOrder, WorkOrderStatus, Equipment, PartsRequisitionItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

// --- CHINANGOL, LDA / SANY DEPARTMENT PDF GENERATOR ---
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  // --- MAIN HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('CHINANGOL, LDA', margin, y + 2);

  doc.setFontSize(9);
  doc.setTextColor(218, 41, 28);
  doc.text('SANY DEPARTMENT', margin, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('WORK ORDER / SERVICE', pageWidth - margin, y + 1, { align: 'right' });
  doc.text('SHEET', pageWidth - margin, y + 5.5, { align: 'right' });

  const boxWidth = 46;
  const boxHeight = 7.5;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = y + 7.5;

  doc.setDrawColor(218, 41, 28);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(218, 41, 28);
  doc.text(`Nº ${wo?.number || 'OS-2026-A001'}`, boxX + boxWidth / 2, boxY + 5.2, { align: 'center' });

  y += 18;

  const drawSectionHeader = (title: string, currentY: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, currentY, contentWidth, 5.5, 'F');
    doc.setFillColor(218, 41, 28);
    doc.rect(margin, currentY, 2.5, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 4, currentY + 3.8);
    return currentY + 5.5;
  };

  // --- SECTION 1: IDENTIFICATION ---
  y = drawSectionHeader('1. EQUIPMENT & CLIENT IDENTIFICATION', y);

  const eqCode = equipment ? `${equipment.code || ''} ${equipment.name || ''}`.trim() : '';
  const eqModel = equipment ? equipment.model || '' : '';
  const serialNo = wo?.serial_chassis || equipment?.serial_number || '';
  const entryDate = wo?.entry_date || '';
  const horometer = wo?.hour_km_actual || '';
  const clientProject = wo?.client_project || '';
  const receptionist = wo?.technician_receptionist || '';

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [160, 200, 230], lineWidth: 0.3, font: 'helvetica', minCellHeight: 9 },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.25, halign: 'center' },
      1: { cellWidth: contentWidth * 0.25, halign: 'center' },
      2: { cellWidth: contentWidth * 0.25, halign: 'center' },
      3: { cellWidth: contentWidth * 0.25, halign: 'center' },
    },
    body: [
      [
        { content: 'EQUIPMENT ID\n' + eqCode, halign: 'center' },
        { content: 'MODEL\n' + eqModel, halign: 'center' },
        { content: 'SERIAL / CHASSIS Nº\n' + serialNo, halign: 'center' },
        { content: 'ENTRY DATE\n' + entryDate, halign: 'center' },
      ],
      [
        { content: 'CURRENT HOROMETER / KM\n' + horometer, halign: 'center' },
        { content: 'CLIENT / PROJECT\n' + clientProject, halign: 'center' },
        { content: 'TECHNICIAN / RECEPTIONIST\n' + receptionist, colSpan: 2, halign: 'center' },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // --- SECTION 2: DIAGNOSIS ---
  y = drawSectionHeader('2. TECHNICAL DIAGNOSIS & REQUESTED TASKS', y);
  const diagHeight = 28;
  doc.setDrawColor(160, 200, 230);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, diagHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const diagLines = wo?.diagnosis_lines || [];
  for (let i = 0; i < 6; i++) {
    const lineText = typeof diagLines[i] === 'string' ? diagLines[i] : (diagLines[i]?.text || '');
    const lineY = y + 4.2 + i * 4.2;
    doc.text(`${i + 1} - ${lineText}`, margin + 3, lineY);
  }
  y += diagHeight + 3;

  // --- SECTION 3: CHECKLIST ---
  y = drawSectionHeader('3. INSPECTION AND ENTRY CHECKLIST', y);
  const checklistHeight = 26;
  doc.setDrawColor(160, 200, 230);
  doc.rect(margin, y, contentWidth, checklistHeight);

  const col1X = margin + 3;
  const col2X = margin + (contentWidth / 2) + 2;

  const getCheckSymbol = (labelSubstring: string) => {
    const item = (wo?.entry_checklist ?? []).find((c: any) => c.label?.toLowerCase().includes(labelSubstring.toLowerCase()));
    return item?.checked ? ' [X]' : '  o';
  };

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  doc.text(`Engine Oil Level${getCheckSymbol('motor')}`, col1X, y + 4.5);
  doc.text(`Hydraulic Oil Level${getCheckSymbol('hidráulico')}`, col1X, y + 9.0);
  doc.text(`Coolant Liquid${getCheckSymbol('radiador')}`, col1X, y + 13.5);
  doc.text(`Air and Fuel Filters${getCheckSymbol('filtros')}`, col1X, y + 18.0);
  doc.text(`Tracks / Tires State${getCheckSymbol('pneus')}`, col1X, y + 22.5);

  doc.text(`Electrical System & Lights${getCheckSymbol('elétrico')}`, col2X, y + 4.5);
  doc.text(`Glass & Cab${getCheckSymbol('vidros')}`, col2X, y + 9.0);
  doc.text(`Safety Devices${getCheckSymbol('segurança')}`, col2X, y + 13.5);
  doc.text(`Extinguisher${getCheckSymbol('extintor')}`, col2X, y + 18.0);
  doc.text('FUEL LEVEL: E  ⊔  1/4  ⊔  1/2  ⊔  3/4  ⊔  F', col2X, y + 22.5);

  y += checklistHeight + 3;

  // --- SECTION 4: PARTS ---
  y = drawSectionHeader('4. REQUIRED / REPLACED PARTS (PART REQUEST)', y);
  const partsData = (wo?.parts_replaced && wo.parts_replaced.length > 0)
    ? wo.parts_replaced.map((p: any) => [p.reference || '', p.description || '', p.quantity?.toString() || '1'])
    : (requisitionItems ?? []).length > 0
    ? (requisitionItems ?? []).map((item) => [item.part_number || '', item.description || '', item.quantity_requested?.toString() || '1'])
    : [];

  while (partsData.length < 6) {
    partsData.push(['', '', '']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [160, 200, 230], lineWidth: 0.3, font: 'helvetica' },
    headStyles: { fillColor: [70, 160, 215], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 50, halign: 'center' }, 1: { cellWidth: 'auto', halign: 'left' }, 2: { cellWidth: 45, halign: 'center' } },
    head: [['REFERENCE', 'PART DESCRIPTION', 'QUANTITY']],
    body: partsData,
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // --- SECTION 5: OBSERVATIONS AND SIGNATURES ---
  y = drawSectionHeader('5. EXIT OBSERVATIONS / ADDITIONAL NOTES', y);
  const obsHeight = 24;
  doc.setDrawColor(160, 200, 230);
  doc.rect(margin, y, contentWidth, obsHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const obsText = wo?.exit_observations || '';
  const obsLines = obsText ? obsText.split('\n') : [];
  for (let i = 0; i < 5; i++) {
    doc.text(`${i + 1} - ${obsLines[i] || ''}`, margin + 3, y + 4.2 + i * 4.2);
  }

  y += obsHeight + 16;

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
  doc.text(wo?.mechanic_sign || 'MECHANIC / TECHNICIAN', sig1X + sigWidth / 2, y + 4, { align: 'center' });
  doc.text(wo?.engineer_sign || 'ENGINEER', sig2X + sigWidth / 2, y + 4, { align: 'center' });
  doc.text(wo?.client_sign || 'CLIENT', sig3X + sigWidth / 2, y + 4, { align: 'center' });

  return doc;
};

// --- MAIN COMPONENT ---
const STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_parts', label: 'Pending Parts' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CHECKLIST_ITEMS = [
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

export function WorkOrdersPage() {
  const { workOrders = [], equipment = [], requisitionItems = [], saveWorkOrder, deleteWorkOrder } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { generateAndSave } = usePdfGenerator();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'diagnosis' | 'checklist' | 'parts' | 'signoff'>('general');
  const [form, setForm] = useState<any>({});
  const [detailWO, setDetailWO] = useState<WorkOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'user';
  const canDelete = profile?.role === 'admin';

  const filtered = useMemo(() => {
    return (workOrders ?? []).filter((w) => {
      const matchSearch = !search ||
        w.number?.toLowerCase().includes(search.toLowerCase()) ||
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
    setActiveTab('general');
    setForm({
      number: generateNumber('OS-2026', (workOrders ?? []).map((w) => w.number)),
      status: 'open',
      client_project: 'CHINANGOL, LDA',
      entry_date: new Date().toISOString().split('T')[0],
      assigned_technician: profile?.full_name || '',
      diagnosis_lines: [{ text: '' }],
      entry_checklist: CHECKLIST_ITEMS.map((label) => ({ label, checked: false })),
      parts_replaced: [{ reference: '', description: '', quantity: 1 }],
      exit_observations: '',
      mechanic_sign: '',
      engineer_sign: '',
      client_sign: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (wo: WorkOrder) => {
    setEditing(wo);
    setActiveTab('general');
    setForm({
      ...wo,
      diagnosis_lines: wo.diagnosis_lines?.length ? wo.diagnosis_lines : [{ text: '' }],
      entry_checklist: CHECKLIST_ITEMS.map((label) => {
        const found = (wo.entry_checklist as any[])?.find((c) => c.label === label);
        return { label, checked: found ? found.checked : false };
      }),
      parts_replaced: wo.parts_replaced?.length ? wo.parts_replaced : [{ reference: '', description: '', quantity: 1 }],
    });
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
    const eq = (equipment ?? []).find((e) => e.id === wo.equipment_id);
    const reqItems = (requisitionItems ?? []).filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    previewPDF(doc);
  };

  const handleDownload = (wo: WorkOrder) => {
    const eq = (equipment ?? []).find((e) => e.id === wo.equipment_id);
    const reqItems = (requisitionItems ?? []).filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    downloadPDF(doc, `${wo.number}.pdf`);
  };

  const handleSaveAndUpload = async (wo: WorkOrder) => {
    const eq = (equipment ?? []).find((e) => e.id === wo.equipment_id);
    const reqItems = (requisitionItems ?? []).filter((i) => i.requisition_id === wo.id);
    const doc = generateWorkOrderPDF(wo, eq, [], reqItems);
    const { error } = await generateAndSave(doc, 'work_order', wo.id, wo.number, `Work Order ${wo.number}`);
    if (error) {
      toast({ title: 'Error saving PDF', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'PDF generated and saved to system', description: `${wo.number}.pdf saved to documents` });
    }
  };

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Management of service orders and equipment maintenance"
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
        searchPlaceholder="Search by work order number, client, technician..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Wrench className="w-12 h-12" />} title="No Work Orders found" description="Create your first equipment service order" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
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
                      <TableCell className="hidden sm:table-cell text-xs">{wo.entry_date || '—'}</TableCell>
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

      {/* Create / Edit Multi-Tab Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Work Order (${form.number})` : 'New Work Order'}</DialogTitle>
            <DialogDescription>Fill out the fields in each of the tabs below</DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
          <div className="flex border-b border-border mb-4 gap-2">
            {[
              { id: 'general', label: 'General' },
              { id: 'diagnosis', label: 'Diagnosis' },
              { id: 'checklist', label: 'Checklist' },
              { id: 'parts', label: 'Parts Required' },
              { id: 'signoff', label: 'Sign-Off' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-4 py-2 min-h-[300px]">
            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WO Number *</Label>
                  <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Equipment *</Label>
                  <Select value={form.equipment_id || 'none'} onValueChange={(v) => {
                    const eq = (equipment ?? []).find((e) => e.id === v);
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
                      {(equipment ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.code ? `${e.code} - ` : ''}{e.name || e.model}{e.serial_number ? ` (S/N: ${e.serial_number})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serial / Chassis No.</Label>
                  <Input value={form.serial_chassis || ''} onChange={(e) => setForm({ ...form, serial_chassis: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input type="date" value={form.entry_date || ''} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Current Horometer / Odometer (KM/H)</Label>
                  <Input value={form.hour_km_actual || ''} onChange={(e) => setForm({ ...form, hour_km_actual: e.target.value })} placeholder="e.g. 51.3 H" />
                </div>
                <div className="space-y-2">
                  <Label>Client / Project</Label>
                  <Input value={form.client_project || ''} onChange={(e) => setForm({ ...form, client_project: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Receptionist / Lead Tech</Label>
                  <Input value={form.technician_receptionist || ''} onChange={(e) => setForm({ ...form, technician_receptionist: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Mechanic</Label>
                  <Input value={form.assigned_technician || ''} onChange={(e) => setForm({ ...form, assigned_technician: e.target.value })} />
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
            )}

            {/* TAB 2: DIAGNOSIS */}
            {activeTab === 'diagnosis' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">2. Technical Diagnosis & Requested Tasks</h3>
                {(form.diagnosis_lines ?? []).map((line: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-6">{idx + 1}.</span>
                    <Input
                      value={line.text || ''}
                      onChange={(e) => {
                        const newLines = [...(form.diagnosis_lines ?? [])];
                        newLines[idx] = { text: e.target.value };
                        setForm({ ...form, diagnosis_lines: newLines });
                      }}
                      placeholder={`Task / Diagnosis line ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        const newLines = (form.diagnosis_lines ?? []).filter((_: any, i: number) => i !== idx);
                        setForm({ ...form, diagnosis_lines: newLines });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, diagnosis_lines: [...(form.diagnosis_lines || []), { text: '' }] })}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
            )}

            {/* TAB 3: CHECKLIST */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">3. Entry Inspection & Checklist</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(form.entry_checklist ?? []).map((item: any, idx: number) => (
                    <label key={idx} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/40">
                      <span className="text-sm">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => {
                          const newChecklist = [...(form.entry_checklist ?? [])];
                          newChecklist[idx].checked = e.target.checked;
                          setForm({ ...form, entry_checklist: newChecklist });
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PARTS REQUIRED */}
            {activeTab === 'parts' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">4. Required / Replaced Parts (Part Request)</h3>
                {(form.parts_replaced ?? []).map((part: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Part Reference / P/N"
                      value={part.reference || ''}
                      onChange={(e) => {
                        const parts = [...(form.parts_replaced ?? [])];
                        parts[idx].reference = e.target.value;
                        setForm({ ...form, parts_replaced: parts });
                      }}
                    />
                    <Input
                      placeholder="Part Description"
                      value={part.description || ''}
                      onChange={(e) => {
                        const parts = [...(form.parts_replaced ?? [])];
                        parts[idx].description = e.target.value;
                        setForm({ ...form, parts_replaced: parts });
                      }}
                    />
                    <Input
                      type="number"
                      className="w-20"
                      value={part.quantity || 1}
                      onChange={(e) => {
                        const parts = [...(form.parts_replaced ?? [])];
                        parts[idx].quantity = parseInt(e.target.value) || 1;
                        setForm({ ...form, parts_replaced: parts });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        const parts = (form.parts_replaced ?? []).filter((_: any, i: number) => i !== idx);
                        setForm({ ...form, parts_replaced: parts });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, parts_replaced: [...(form.parts_replaced || []), { reference: '', description: '', quantity: 1 }] })}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Part
                </Button>
              </div>
            )}

            {/* TAB 5: SIGN-OFF */}
            {activeTab === 'signoff' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">5. Exit Observations & Sign-Off</h3>
                <div className="space-y-2">
                  <Label>Exit Observations / Additional Notes</Label>
                  <Textarea
                    value={form.exit_observations || ''}
                    onChange={(e) => setForm({ ...form, exit_observations: e.target.value })}
                    rows={4}
                    placeholder="Enter final remarks, testing status, or exit notes..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Mechanic / Tech Sign-off</Label>
                    <Input
                      value={form.mechanic_sign || ''}
                      onChange={(e) => setForm({ ...form, mechanic_sign: e.target.value })}
                      placeholder="Technician Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Engineer / Supervisor Sign-off</Label>
                    <Input
                      value={form.engineer_sign || ''}
                      onChange={(e) => setForm({ ...form, engineer_sign: e.target.value })}
                      placeholder="Engineer Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Client Sign-off</Label>
                    <Input
                      value={form.client_sign || ''}
                      onChange={(e) => setForm({ ...form, client_sign: e.target.value })}
                      placeholder="Client Representative Name"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 border-t pt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
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