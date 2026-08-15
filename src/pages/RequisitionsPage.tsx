import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
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
import { Package, Plus, Pencil, Trash2, ChevronRight, X, Eye, Printer, Loader2, Wrench } from 'lucide-react';
import { REQUISITION_STATUS_LABELS, formatDate, generateNumber } from '@/lib/constants';
import { previewPDF, downloadPDF, usePdfGenerator } from '@/lib/pdf';
import type { PartsRequisition, RequisitionStatus, PartsRequisitionItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

// --- GERADOR EXATO DO MODELO PDF ---
export interface RequisitionData {
  number?: string;
  client?: string;
  date?: string;
  created_at?: string;
  service_number?: string;
  requested_by?: string;
  model?: string;
  supervisor_name?: string;
  serial_number?: string;
  supervisor_sign?: string;
  hour_km_meter?: string;
  urgency?: boolean;
}

export interface RequisitionItem {
  quantity?: number | string;
  part_number?: string;
  description?: string;
}

export const generateRequisitionPDF = (
  req: RequisitionData = {},
  items: RequisitionItem[] = []
): jsPDF => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm

  // --- 1. HEADER (TOP LEFT) ---
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('CHINANGOL, LDA', 18, 20);

  doc.setFontSize(9.5);
  doc.setTextColor(220, 0, 0); // SANY Red
  doc.text('SANY DEPARTMENT', 18, 25);

  // --- 2. NUMBER BOX (TOP RIGHT) ---
  const boxX = pageWidth - 68; // 142mm
  const boxY = 17;
  const boxW = 50;
  const boxH = 7;

  doc.setDrawColor(255, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxW, boxH);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 0, 0);

  const numText = req.number ? `N° ${req.number}` : 'N° TT-2026-__________';
  doc.text(numText, boxX + 3, boxY + 5);

  // --- 3. CENTERED TITLES WITH UNDERLINES ---
  let y = 35;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Title 1: CHINANGOL Lda
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('CHINANGOL Lda', pageWidth / 2, y, { align: 'center' });
  doc.line(pageWidth / 2 - 16, y + 0.8, pageWidth / 2 + 16, y + 0.8);

  y += 5;
  // Title 2: PARTS & SERVICE REQUEST FORM
  doc.setFontSize(11);
  doc.text('PARTS & SERVICE REQUEST FORM', pageWidth / 2, y, { align: 'center' });
  doc.line(pageWidth / 2 - 38, y + 0.8, pageWidth / 2 + 38, y + 0.8);

  // --- 4. METADATA GRID ---
  y = 48;
  const tableLeft = 18;
  const tableWidth = 174;
  const rowH = 6;

  doc.setLineWidth(0.35);
  doc.setFontSize(8.5);

  // Formatação de data
  let formattedDate = req.date || '';
  if (!formattedDate && req.created_at) {
    try {
      formattedDate = new Date(req.created_at).toLocaleDateString('pt-PT');
    } catch {
      formattedDate = '';
    }
  }

  // Row 1: CLIENT & DATE
  doc.rect(tableLeft, y, tableWidth, rowH);
  doc.line(40, y, 40, y + rowH);
  doc.line(122, y, 122, y + rowH);
  doc.line(138, y, 138, y + rowH);

  doc.setFont('Helvetica', 'bold');
  doc.text('CLIENT:', tableLeft + 2, y + 4.2);
  doc.text('DATE:', 124, y + 4.2);

  doc.setFont('Helvetica', 'normal');
  doc.text(req.client || 'CHINANGOL, LDA', 42, y + 4.2);
  doc.text(formattedDate, 140, y + 4.2);

  y += rowH;

  // Row 2: SERV. N° & REQUESTED BY
  doc.rect(tableLeft, y, tableWidth, rowH);
  doc.line(40, y, 40, y + rowH);
  doc.line(80, y, 80, y + rowH);
  doc.line(122, y, 122, y + rowH);

  doc.setFont('Helvetica', 'bold');
  doc.text('SERV. N°', tableLeft + 2, y + 4.2);
  doc.text('REQUESTED BY', 82, y + 4.2);

  doc.setFont('Helvetica', 'normal');
  doc.text(req.service_number || '', 42, y + 4.2);
  doc.text(req.requested_by || '', 124, y + 4.2);

  y += rowH;

  // Row 3: MODEL & O SUPERVISOR
  doc.rect(tableLeft, y, tableWidth, rowH);
  doc.line(40, y, 40, y + rowH);
  doc.line(80, y, 80, y + rowH);
  doc.line(132, y, 132, y + rowH);

  doc.setFont('Helvetica', 'bold');
  doc.text('MODEL:', tableLeft + 2, y + 4.2);
  doc.text('O SUPERVISOR', 82, y + 4.2);

  doc.setFont('Helvetica', 'normal');
  doc.text(req.model || '', 42, y + 4.2);
  doc.text(req.supervisor_name || 'CARLOS BALTAZAR', 134, y + 4.2);

  y += rowH;

  // Row 4: SERIAL N° & SIGN:
  doc.rect(tableLeft, y, tableWidth, rowH);
  doc.line(40, y, 40, y + rowH);
  doc.line(102, y, 102, y + rowH);
  doc.line(122, y, 122, y + rowH);

  doc.setFont('Helvetica', 'bold');
  doc.text('SERIAL N°', tableLeft + 2, y + 4.2);
  doc.text('SIGN:', 104, y + 4.2);

  doc.setFont('Helvetica', 'normal');
  doc.text(req.serial_number || '', 42, y + 4.2);
  doc.text(req.supervisor_sign || 'FRANCISCO SACULILA', 124, y + 4.2);

  y += rowH;

  // Row 5: HOUR/KM METER & URGENCY
  doc.rect(tableLeft, y, tableWidth, rowH);
  doc.line(57, y, 57, y + rowH);
  doc.line(122, y, 122, y + rowH);

  doc.setFont('Helvetica', 'bold');
  doc.text('HOUR/KM METER', tableLeft + 2, y + 4.2);
  doc.text('URGENCY', 124, y + 4.2);

  doc.setFont('Helvetica', 'normal');
  doc.text(req.hour_km_meter || '', 59, y + 4.2);

  // Urgency Options
  const isUrgent = req.urgency === true;
  doc.setTextColor(isUrgent ? 220 : 0, 0, 0);
  doc.setFont('Helvetica', isUrgent ? 'bold' : 'normal');
  doc.text('yes', 150, y + 4.2);

  doc.setTextColor(!isUrgent ? 0 : 0, 0, 0);
  doc.setFont('Helvetica', !isUrgent ? 'normal' : 'normal');
  doc.text('no', 175, y + 4.2);

  doc.setTextColor(0, 0, 0);

  // --- 5. PARTS TABLE (25 ROWS) ---
  y += rowH + 6;

  const colWidths = [22, 18, 42, 92]; // ITEM N°, QUANT., PARTS ID, DESCRIPTION
  const colX = [
    tableLeft,
    tableLeft + colWidths[0],
    tableLeft + colWidths[0] + colWidths[1],
    tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
  ];

  // Table Header
  const headerH = 5.5;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.rect(tableLeft, y, tableWidth, headerH);
  doc.line(colX[1], y, colX[1], y + headerH);
  doc.line(colX[2], y, colX[2], y + headerH);
  doc.line(colX[3], y, colX[3], y + headerH);

  doc.text('ITEM N°', colX[0] + colWidths[0] / 2, y + 3.8, { align: 'center' });
  doc.text('QUANT.', colX[1] + colWidths[1] / 2, y + 3.8, { align: 'center' });
  doc.text('PARTS ID', colX[2] + 2, y + 3.8);
  doc.text('DESCRIPTION', colX[3] + 2, y + 3.8);

  y += headerH;

  // 25 Table Rows
  const itemRowH = 5.2;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);

  for (let i = 1; i <= 25; i++) {
    const item = items[i - 1];

    doc.rect(tableLeft, y, tableWidth, itemRowH);
    doc.line(colX[1], y, colX[1], y + itemRowH);
    doc.line(colX[2], y, colX[2], y + itemRowH);
    doc.line(colX[3], y, colX[3], y + itemRowH);

    // Row Number
    doc.text(String(i), colX[0] + colWidths[0] / 2, y + 3.7, { align: 'center' });

    // Row Data (if exists)
    if (item) {
      if (item.quantity !== undefined && item.quantity !== '') {
        doc.text(String(item.quantity), colX[1] + colWidths[1] / 2, y + 3.7, { align: 'center' });
      }
      if (item.part_number) {
        doc.text(String(item.part_number), colX[2] + 2, y + 3.7);
      }
      if (item.description) {
        doc.text(String(item.description), colX[3] + 2, y + 3.7);
      }
    }

    y += itemRowH;
  }

  return doc;
};

// --- COMPONENTE DA PÁGINA ---
const STATUSES: { value: RequisitionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'fulfilled', label: 'Fulfilled' },
];

const UNIT_OPTIONS = ['UN', 'L', 'KG', 'M', 'PAIR', 'SET', 'KIT', 'BOX'];
const PAGE_SIZE = 8;

export function RequisitionsPage() {
  const { requisitions = [], requisitionItems = [], equipment = [], workOrders = [], saveRequisition, deleteRequisition, saveRequisitionItem, deleteRequisitionItem } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { generateAndSave } = usePdfGenerator();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartsRequisition | null>(null);
  const [form, setForm] = useState<Partial<PartsRequisition>>({});
  const [detailReq, setDetailReq] = useState<PartsRequisition | null>(null);
  
  const [pendingItems, setPendingItems] = useState<Partial<PartsRequisitionItem>[]>([]);
  const [newItem, setNewItem] = useState<Partial<PartsRequisitionItem>>({ quantity: 1, unit: 'UN' });
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'user';
  const canApprove = profile?.role === 'admin';
  const canDelete = profile?.role === 'admin';

  const filtered = useMemo(() => {
    return (requisitions || []).filter((r) => {
      const matchSearch = !search ||
        r.number?.toLowerCase().includes(search.toLowerCase()) ||
        r.requested_by?.toLowerCase().includes(search.toLowerCase()) ||
        (r.client && r.client.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [requisitions, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      number: generateNumber('TT', (requisitions || []).map((r) => r.number)),
      status: 'pending',
      requested_by: profile?.full_name || '',
      urgency: false,
      client: 'CHINANGOL, LDA',
      supervisor_name: 'CARLOS BALTAZAR',
      supervisor_sign: 'FRANCISCO SACULILA',
      created_at: new Date().toISOString(),
    });
    setPendingItems([]);
    setNewItem({ quantity: 1, unit: 'UN' });
    setDialogOpen(true);
  };

  const openEdit = (req: PartsRequisition) => {
    setEditing(req);
    setForm({ ...req });
    const existing = (requisitionItems || []).filter((i) => i.requisition_id === req.id);
    setPendingItems(existing);
    setNewItem({ quantity: 1, unit: 'UN' });
    setDialogOpen(true);
  };

  const handleAddPendingItem = () => {
    if (!newItem.description) {
      toast({ title: 'Part description is required', variant: 'destructive' });
      return;
    }
    setPendingItems([...pendingItems, { ...newItem, id: newItem.id || `temp-${Date.now()}` }]);
    setNewItem({ quantity: 1, unit: 'UN', description: '', part_number: '', item_code: '', remarks: '' });
  };

  const handleRemovePendingItem = async (index: number, itemId?: string) => {
    if (itemId && !itemId.startsWith('temp-')) {
      await deleteRequisitionItem(itemId);
    }
    setPendingItems(pendingItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.number || !form.requested_by) {
      toast({ title: 'Document Number and Requested By fields are required', variant: 'destructive' });
      return;
    }

    if (pendingItems.length === 0) {
      toast({ title: 'Please add at least one part/item to the requisition', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        updated_at: new Date().toISOString(),
      };

      const { data: savedReq, error } = await saveRequisition(payload);
      
      if (error) {
        toast({ title: 'Error saving requisition', description: error, variant: 'destructive' });
        return;
      }

      const reqId = savedReq?.id || form.id;

      if (reqId) {
        for (const item of pendingItems) {
          const { id, created_at, updated_at, ...itemPayload } = item as any;
          const isTemp = id?.toString().startsWith('temp-');

          const itemToSave: Partial<PartsRequisitionItem> = {
            ...itemPayload,
            requisition_id: reqId,
            ...(id && !isTemp ? { id } : {}),
          };

          const res = await saveRequisitionItem(itemToSave);
          if (res.error) {
            console.error('Error saving item:', res.error);
          }
        }
      }

      toast({ title: editing ? 'Requisition updated successfully' : 'Requisition created successfully' });
      setDialogOpen(false);
    } catch (err: any) {
      console.error('Error on save:', err);
      toast({ title: 'Error saving requisition', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteRequisition(deleteId);
    if (error) {
      toast({ title: 'Error deleting requisition', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Requisition deleted successfully' });
    }
    setDeleteId(null);
  };

  const handleStatusChange = async (req: PartsRequisition, status: RequisitionStatus) => {
    const updates: Partial<PartsRequisition> = { 
      id: req.id,
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'approved') {
      updates.approved_by = profile?.full_name || '';
    }
    
    const { error } = await saveRequisition({ ...req, ...updates });
    if (error) {
      toast({ title: 'Error updating status', description: error, variant: 'destructive' });
    } else {
      toast({ title: `Status changed to ${REQUISITION_STATUS_LABELS[status] || status}` });
      if (detailReq?.id === req.id) {
        setDetailReq({ ...detailReq, ...updates });
      }
    }
  };

  const handlePreview = (req: PartsRequisition) => {
    const items = (requisitionItems || []).filter((i) => i.requisition_id === req.id);
    const doc = generateRequisitionPDF(req, items);
    previewPDF(doc);
  };

  const handleDownload = (req: PartsRequisition) => {
    const items = (requisitionItems || []).filter((i) => i.requisition_id === req.id);
    const doc = generateRequisitionPDF(req, items);
    downloadPDF(doc, `${req.number}.pdf`);
  };

  const handleSaveAndUpload = async (req: PartsRequisition) => {
    const items = (requisitionItems || []).filter((i) => i.requisition_id === req.id);
    const doc = generateRequisitionPDF(req, items);
    const { error } = await generateAndSave(doc, 'requisition', req.id, req.number, `Requisition ${req.number}`);
    if (error) {
      toast({ title: 'Error saving PDF', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'PDF generated and stored in system', description: `${req.number}.pdf saved in documents` });
    }
  };

  return (
    <div>
      <PageHeader
        title="Parts Requisition"
        description="Internal Parts & Service Requisition Form for Equipment"
        action={canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Requisition
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by number, requested by, client..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Package className="w-12 h-12" />} title="No requisitions found" description="Create your first equipment parts requisition" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead className="hidden sm:table-cell">Items Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((req) => {
                  const items = (requisitionItems || []).filter((i) => i.requisition_id === req.id);
                  return (
                    <TableRow key={req.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setDetailReq(req)}>
                      <TableCell className="font-mono font-medium">{req.number}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{req.client || '—'}</TableCell>
                      <TableCell>{req.requested_by}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {req.urgency ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Urgent</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Normal</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium">{items.length} item(s)</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canApprove && req.status === 'pending' ? (
                          <Select value={req.status} onValueChange={(v) => handleStatusChange(req, v as RequisitionStatus)}>
                            <SelectTrigger className="w-[130px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <StatusBadge status={req.status} label={REQUISITION_STATUS_LABELS[req.status]} />
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(req)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(req)} title="Download PDF">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailReq(req)}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(req)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(req.id)}>
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

      {/* Create / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Requisition' : 'New Parts Requisition'}</DialogTitle>
            <DialogDescription>Fill in document information and add requested parts below</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document No. *</Label>
                <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} className="font-mono" placeholder="TT-2026-001" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={form.created_at ? new Date(form.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} 
                  onChange={(e) => setForm({ ...form, created_at: new Date(e.target.value).toISOString() })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Input value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="CHINANGOL, LDA" />
              </div>
              <div className="space-y-2">
                <Label>Serv. No. / Work Order</Label>
                <Select value={form.work_order_id || 'none'} onValueChange={(v) => {
                  const wo = (workOrders || []).find(w => w.id === v);
                  setForm({ ...form, work_order_id: v === 'none' ? null : v, service_number: wo?.number || form.service_number });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select Work Order..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(workOrders || []).map((w) => <SelectItem key={w.id} value={w.id}>{w.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link to Equipment</Label>
                <Select value={form.equipment_id || 'none'} onValueChange={(v) => {
                  const eq = (equipment || []).find((e) => e.id === v);
                  setForm({ 
                    ...form, 
                    equipment_id: v === 'none' ? null : v, 
                    model: eq?.model || form.model, 
                    serial_number: eq?.serial_number || form.serial_number 
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select Equipment..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(equipment || []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name} - {e.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Requested By *</Label>
                <Input value={form.requested_by || ''} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ex: SANY SY215C" />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serial_number || ''} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hour / Mileage Meter</Label>
                <Input value={form.hour_km_meter || ''} onChange={(e) => setForm({ ...form, hour_km_meter: e.target.value })} placeholder="Ex: 7830 h" />
              </div>
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Input value={form.supervisor_name || ''} onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })} placeholder="CARLOS BALTAZAR" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox id="urgency" checked={form.urgency || false} onCheckedChange={(v) => setForm({ ...form, urgency: !!v })} />
              <Label htmlFor="urgency" className="text-sm cursor-pointer font-medium text-red-600 dark:text-red-400">Mark as Urgent Requisition</Label>
            </div>

            {/* REQUESTED PARTS & SUPPLIES SECTION */}
            <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Wrench className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Requested Parts & Supplies</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-background p-3 border rounded-md">
                <div className="sm:col-span-5 space-y-1">
                  <Label className="text-xs">Part Description *</Label>
                  <Input 
                    value={newItem.description || ''} 
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} 
                    placeholder="Ex: Main Fuel Filter" 
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-xs">Part No. / Ref.</Label>
                  <Input 
                    value={newItem.part_number || ''} 
                    onChange={(e) => setNewItem({ ...newItem, part_number: e.target.value })} 
                    placeholder="Ex: B222100000543" 
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Qty.</Label>
                  <Input 
                    type="number" 
                    min={0.1} 
                    step="any" 
                    value={newItem.quantity ?? 1} 
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })} 
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select value={newItem.unit || 'UN'} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-12 flex justify-end mt-2">
                  <Button type="button" size="sm" onClick={handleAddPendingItem}>
                    <Plus className="w-4 h-4 mr-1" /> Add Part to List
                  </Button>
                </div>
              </div>

              {pendingItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                  No parts added to this requisition yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Part Description</TableHead>
                      <TableHead>Part No.</TableHead>
                      <TableHead>Qty.</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingItems.map((item, idx) => (
                      <TableRow key={item.id || idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{item.description}</TableCell>
                        <TableCell className="text-xs font-mono">{item.part_number || '—'}</TableCell>
                        <TableCell className="text-sm font-semibold">{item.quantity}</TableCell>
                        <TableCell className="text-xs">{item.unit}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive" 
                            onClick={() => handleRemovePendingItem(idx, item.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes or technical justification..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Issue Requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={!!detailReq} onOpenChange={(open) => !open && setDetailReq(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailReq && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailReq.number}
                  <StatusBadge status={detailReq.status} label={REQUISITION_STATUS_LABELS[detailReq.status]} />
                </DialogTitle>
                <DialogDescription>
                  Requested by {detailReq.requested_by} · {formatDate(detailReq.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/40 rounded-lg">
                  <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{detailReq.client || '—'}</span></div>
                  <div><span className="text-muted-foreground">Serv. No.:</span> <span className="font-medium">{detailReq.service_number || '—'}</span></div>
                  <div><span className="text-muted-foreground">Model:</span> <span className="font-medium">{detailReq.model || '—'}</span></div>
                  <div><span className="text-muted-foreground">Serial No.:</span> <span className="font-medium">{detailReq.serial_number || '—'}</span></div>
                  <div><span className="text-muted-foreground">Hours/Km:</span> <span className="font-medium">{detailReq.hour_km_meter || '—'}</span></div>
                  <div><span className="text-muted-foreground">Urgent:</span> <span className="font-medium">{detailReq.urgency ? 'Yes' : 'No'}</span></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Requested Parts</Label>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {(requisitionItems || []).filter((i) => i.requisition_id === detailReq.id).map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-medium">
                            <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Part No: {item.part_number || 'No code'} · Qty: {item.quantity} {item.unit}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => handlePreview(detailReq)}><Eye className="w-4 h-4 mr-1" />Preview PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(detailReq)}><Printer className="w-4 h-4 mr-1" />Download PDF</Button>
                  <Button size="sm" onClick={() => handleSaveAndUpload(detailReq)}><Package className="w-4 h-4 mr-1" />Save to Documents</Button>
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
        title="Delete Requisition"
        description="This action is permanent and will delete this requisition along with all associated items."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

