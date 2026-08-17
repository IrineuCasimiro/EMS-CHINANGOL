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
import { Truck, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { EQUIPMENT_STATUS_LABELS } from '@/lib/constants';
import type { Equipment, EquipmentStatus, EquipmentCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'heavy_machinery', label: 'Heavy Machinery' },
  { value: 'light_vehicle', label: 'Light Vehicle' },
  { value: 'support_vehicle', label: 'Support Vehicle' },
  { value: 'generator', label: 'Generator' },
  { value: 'other', label: 'Other' },
];

const STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: 'operational', label: 'Operational' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'standby', label: 'Standby' },
  { value: 'broken', label: 'Broken' },
];

const PAGE_SIZE = 8;

export function EquipmentPage() {
  const { equipment, saveEquipment, deleteEquipment } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState<Partial<Equipment>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = ['admin', 'equipment_manager', 'workshop_supervisor'].includes(profile?.role || '');
  const canDelete = ['admin', 'equipment_manager'].includes(profile?.role || '');

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      const matchSearch = !search ||
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
        e.brand?.toLowerCase().includes(search.toLowerCase()) ||
        e.model?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [equipment, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      brand: 'SANY',
      model: '',
      serial_number: '',
      plate_number: '',
      category: 'heavy_machinery',
      status: 'operational',
      horometer: 0,
      odometer: 0,
      location: '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (eq: Equipment) => {
    setEditing(eq);
    setForm({ ...eq });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.serial_number) {
      toast({ 
        title: 'Campos obrigatórios em falta', 
        description: 'Por favor, preencha o Nome e o Número de Série.', 
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...(editing?.id ? { id: editing.id } : {}),
        ...form,
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        brand: form.brand || 'SANY',
        category: form.category || 'heavy_machinery',
        status: form.status || 'operational',
        horometer: Number(form.horometer) || 0,
        odometer: Number(form.odometer) || 0,
      };

      const { error } = await saveEquipment(payload);

      if (error) {
        console.error('Erro ao salvar no Supabase:', error);
        toast({ title: 'Erro ao salvar equipamento', description: String(error), variant: 'destructive' });
      } else {
        toast({ title: editing ? 'Equipamento atualizado com sucesso!' : 'Equipamento adicionado com sucesso!' });
        setDialogOpen(false);
        setForm({});
        setEditing(null);
      }
    } catch (err: any) {
      console.error('Erro inesperado ao salvar:', err);
      toast({ 
        title: 'Erro inesperado', 
        description: err?.message || 'Falha na operação', 
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await deleteEquipment(deleteId);
      if (error) {
        console.error('Erro ao apagar equipamento:', error);
        toast({ 
          title: 'Não foi possível apagar', 
          description: 'Esta máquina possui registos associados (ex: Ordens de Trabalho ou Requisições).', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Equipamento removido com sucesso' });
        setDeleteId(null);
      }
    } catch (err: any) {
      console.error('Erro inesperado ao apagar:', err);
      toast({ 
        title: 'Erro ao apagar', 
        description: err?.message || 'Erro desconhecido', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Equipment & Stockyard"
        description="Track all machinery, vehicles, and equipment in your fleet"
        action={canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Add Equipment
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by name, serial, brand..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Truck className="w-12 h-12" />} title="No equipment found" description="Add your first piece of equipment to get started" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="hidden md:table-cell">Serial Number</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead className="hidden sm:table-cell">Hours/KM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((eq) => {
                  const statusKey = (eq.status as EquipmentStatus) || 'operational';
                  const statusLabel = EQUIPMENT_STATUS_LABELS[statusKey] || eq.status;

                  return (
                    <TableRow key={eq.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">{eq.brand} {eq.model}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs">{eq.serial_number}</TableCell>
                      <TableCell className="hidden lg:table-cell">{eq.location || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {eq.category === 'support_vehicle' || eq.category === 'light_vehicle'
                          ? `${(eq.odometer || 0).toLocaleString()} km`
                          : `${(eq.horometer || 0).toLocaleString()} h`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={statusKey} label={statusLabel} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(eq)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(eq.id)}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
            <DialogDescription>{editing ? 'Update equipment details' : 'Register new equipment in the stockyard'}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input 
                value={form.name || ''} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder="e.g. Escavadora SANY SY75C" 
              />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input 
                value={form.brand || ''} 
                onChange={(e) => setForm({ ...form, brand: e.target.value })} 
                placeholder="SANY" 
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input 
                value={form.model || ''} 
                onChange={(e) => setForm({ ...form, model: e.target.value })} 
                placeholder="SY75C" 
              />
            </div>
            <div className="space-y-2">
              <Label>Serial Number *</Label>
              <Input 
                value={form.serial_number || ''} 
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })} 
                placeholder="SANY75-2023-0012" 
              />
            </div>
            <div className="space-y-2">
              <Label>Plate Number</Label>
              <Input 
                value={form.plate_number || ''} 
                onChange={(e) => setForm({ ...form, plate_number: e.target.value })} 
                placeholder="LD-2341-A" 
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={form.category || 'heavy_machinery'} 
                onValueChange={(v) => setForm({ ...form, category: v as EquipmentCategory })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={form.status || 'operational'} 
                onValueChange={(v) => setForm({ ...form, status: v as EquipmentStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Horometer (hours)</Label>
              <Input 
                type="number" 
                value={form.horometer ?? 0} 
                onChange={(e) => setForm({ ...form, horometer: parseInt(e.target.value) || 0 })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Odometer (km)</Label>
              <Input 
                type="number" 
                value={form.odometer ?? 0} 
                onChange={(e) => setForm({ ...form, odometer: parseInt(e.target.value) || 0 })} 
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Location</Label>
              <Input 
                value={form.location || ''} 
                onChange={(e) => setForm({ ...form, location: e.target.value })} 
                placeholder="Stockyard A-1" 
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea 
                value={form.notes || ''} 
                onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                rows={2} 
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Equipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Equipment"
        description="This will permanently remove this equipment and all related records. This cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}