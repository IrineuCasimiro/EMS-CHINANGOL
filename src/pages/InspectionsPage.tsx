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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck, Plus, Pencil, Trash2, FileText, Eye, Printer } from 'lucide-react';
import { INSPECTION_STATUS_LABELS, formatDate, generateNumber } from '@/lib/constants';
import { generateInspectionPDF, previewPDF, downloadPDF } from '@/lib/pdf';
import type { Inspection, InspectionType, InspectionStatus, ChecklistItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

const TYPES: { value: InspectionType; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'pre_use', label: 'Pre-Use' },
  { value: 'post_use', label: 'Post-Use' },
];

const STATUSES: { value: InspectionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'c1', label: 'Níveis de óleo do motor', checked: false, note: '' },
  { id: 'c2', label: 'Níveis de óleo hidráulico', checked: false, note: '' },
  { id: 'c3', label: 'Nível de água/líquido de refrigeração', checked: false, note: '' },
  { id: 'c4', label: 'Filtros de ar', checked: false, note: '' },
  { id: 'c5', label: 'Pneus/esteiras - estado e pressão', checked: false, note: '' },
  { id: 'c6', label: 'Sistema de travagem', checked: false, note: '' },
  { id: 'c7', label: 'Luzes e sinais', checked: false, note: '' },
  { id: 'c8', label: 'Cintos de segurança', checked: false, note: '' },
  { id: 'c9', label: 'Extintor', checked: false, note: '' },
  { id: 'c10', label: 'Vazamentos visíveis', checked: false, note: '' },
];

const PAGE_SIZE = 8;

export function InspectionsPage() {
  const { inspections, equipment, saveInspection, deleteInspection } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [form, setForm] = useState<Partial<Inspection>>({});

  const canEdit = ['admin', 'equipment_manager', 'workshop_supervisor', 'technician'].includes(profile?.role || '');
  const canDelete = ['admin', 'equipment_manager'].includes(profile?.role || '');

  const getEquipment = (id: string) => equipment.find((e) => e.id === id);

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      const eq = getEquipment(i.equipment_id);
      const matchSearch = !search ||
        (eq?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        i.inspector_name.toLowerCase().includes(search.toLowerCase()) ||
        i.type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [inspections, equipment, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      type: 'weekly',
      status: 'pending',
      inspection_date: new Date().toISOString().split('T')[0],
      checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
      inspector_name: profile?.full_name || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (insp: Inspection) => {
    setEditing(insp);
    setForm({ ...insp, checklist: insp.checklist.map((c) => ({ ...c })) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipment_id) {
      toast({ title: 'Please select equipment', variant: 'destructive' });
      return;
    }
    const allChecked = (form.checklist || []).every((c) => c.checked);
    const anyFailed = (form.checklist || []).some((c) => !c.checked);
    let finalStatus = form.status;
    if (form.signature && allChecked) finalStatus = 'completed';
    else if (form.signature && anyFailed) finalStatus = 'failed';

    const { error } = await saveInspection({ ...form, status: finalStatus as InspectionStatus });
    if (error) {
      toast({ title: 'Error saving inspection', description: error, variant: 'destructive' });
    } else {
      toast({ title: editing ? 'Inspection updated' : 'Inspection created' });
      setDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteInspection(deleteId);
    if (error) {
      toast({ title: 'Error deleting', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Inspection deleted' });
    }
    setDeleteId(null);
  };

  const handlePreview = (insp: Inspection) => {
    const eq = getEquipment(insp.equipment_id);
    const doc = generateInspectionPDF(insp, eq);
    previewPDF(doc);
  };

  const handleDownload = (insp: Inspection) => {
    const eq = getEquipment(insp.equipment_id);
    const doc = generateInspectionPDF(insp, eq);
    downloadPDF(doc, `INS-${insp.inspection_date}.pdf`);
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setForm((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
  };

  return (
    <div>
      <PageHeader
        title="Inspections"
        description="Weekly inspection checklists with digital sign-off and historical logs"
        action={canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Inspection
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by equipment, inspector..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="w-12 h-12" />} title="No inspections found" description="Create your first inspection checklist" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Inspector</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((insp) => {
                  const eq = getEquipment(insp.equipment_id);
                  return (
                    <TableRow key={insp.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-medium">{eq?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-capitalize">{insp.type}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(insp.inspection_date)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{insp.inspector_name || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell capitalize">{insp.type.replace(/_/g, ' ')}</TableCell>
                      <TableCell><StatusBadge status={insp.status} label={INSPECTION_STATUS_LABELS[insp.status]} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(insp)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(insp)} title="Download PDF">
                            <Printer className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(insp)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(insp.id)}>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Inspection' : 'New Inspection'}</DialogTitle>
            <DialogDescription>{editing ? 'Update inspection details' : 'Fill out the weekly inspection checklist'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Equipment *</Label>
                <Select value={form.equipment_id || ''} onValueChange={(v) => setForm({ ...form, equipment_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                  <SelectContent>
                    {equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type || 'weekly'} onValueChange={(v) => setForm({ ...form, type: v as InspectionType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Inspection Date</Label>
                <Input type="date" value={form.inspection_date || ''} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Inspector Name</Label>
                <Input value={form.inspector_name || ''} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Checklist</Label>
              <div className="border border-border rounded-lg divide-y divide-border">
                {(form.checklist || []).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(checked) => updateChecklistItem(item.id, { checked: checked === true })}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</p>
                      <Input
                        value={item.note}
                        onChange={(e) => updateChecklistItem(item.id, { note: e.target.value })}
                        placeholder="Add note (optional)"
                        className="mt-1 h-7 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>General Notes</Label>
              <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Digital Sign-off (Type your name to sign)</Label>
              <Input
                value={form.signature || ''}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                placeholder="Type your full name to digitally sign this inspection"
              />
              {form.signature && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Signed by {form.signature} on {formatDate(new Date().toISOString())}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Create Inspection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Inspection"
        description="This will permanently remove this inspection record."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
