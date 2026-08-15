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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Route, Plus, Pencil, Trash2, Eye, Printer, FileCheck, Loader2 } from 'lucide-react';
import { TRAVEL_STATUS_LABELS, formatDate, generateNumber } from '@/lib/constants';
import { previewPDF, downloadPDF, usePdfGenerator } from '@/lib/pdf';
import type { TravelLog, TravelStatus, FuelLevel, ChecklistItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

// Helper to format time as HH:mm or return null if empty/invalid
const formatTimeOrNull = (timeStr?: string | null): string | null => {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return null;
};

// --- CHINANGOL SANY OFFICIAL TRAVEL LOG PDF GENERATOR ---
const generateOfficialTravelLogPDF = (log: TravelLog, vehicle?: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- HEADER ---
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('CHINANGOL, LDA', 15, 18);

  doc.setFontSize(10);
  doc.setTextColor(200, 0, 0); // SANY Red
  doc.text('SANY DEPARTMENT', 15, 23);

  // Title Right
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('TRAVEL GUIDE', pageWidth - 15, 18, { align: 'right' });

  // Number Box
  doc.setDrawColor(230, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(pageWidth - 65, 20, 50, 7);
  doc.setFontSize(10);
  doc.setTextColor(230, 0, 0);
  doc.text(`NO. ${log.number || 'GV-2026-____'}`, pageWidth - 40, 25, { align: 'center' });

  let y = 33;

  const drawSectionHeader = (title: string, yPos: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(15, yPos, pageWidth - 30, 5.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 18, yPos + 3.8);
  };

  // --- 1. DRIVER & VEHICLE IDENTIFICATION ---
  drawSectionHeader('1. DRIVER AND VEHICLE IDENTIFICATION', y);
  y += 5.5;

  doc.setDrawColor(180, 215, 235);
  doc.setLineWidth(0.3);

  // Row 1
  doc.rect(15, y, 90, 8);
  doc.rect(105, y, 90, 8);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
  doc.text('DRIVER NAME', 17, y + 3);
  doc.text('LICENSE PLATE', 107, y + 3);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(8);
  doc.text(log.driver_name || '', 17, y + 6.8);
  doc.text(log.license_plate || vehicle?.plate_number || '', 107, y + 6.8);
  y += 8;

  // Row 2
  doc.rect(15, y, 90, 8);
  doc.rect(105, y, 90, 8);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7);
  doc.text('VEHICLE', 17, y + 3);
  doc.text('DESTINATION', 107, y + 3);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(8);
  doc.text(log.vehicle_name || vehicle?.name || '', 17, y + 6.8);
  doc.text(log.destination || '', 107, y + 6.8);
  y += 8;

  // Row 3
  doc.rect(15, y, 180, 8);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7);
  doc.text('PURPOSE OF TRIP', 17, y + 3);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(8);
  doc.text(log.purpose || '', 17, y + 6.8);
  y += 11;

  // --- 2. DEPARTURE & RETURN CONTROL ---
  drawSectionHeader('2. DEPARTURE & RETURN CONTROL', y);
  y += 5.5;

  doc.setFillColor(235, 243, 250);
  doc.rect(15, y, 90, 5, 'F'); doc.rect(15, y, 90, 5);
  doc.rect(105, y, 90, 5, 'F'); doc.rect(105, y, 90, 5);

  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
  doc.text('DEPARTURE', 17, y + 3.5);
  doc.text('RETURN', 107, y + 3.5);
  y += 5;

  // Dates
  doc.rect(15, y, 90, 6.5); doc.rect(105, y, 90, 6.5);
  doc.text('DEPARTURE DATE:', 17, y + 4);
  doc.text('ACTUAL RETURN DATE:', 107, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.text(log.departure_date || '', 55, y + 4);
  doc.text(log.arrival_date || '', 158, y + 4);
  y += 6.5;

  // Times
  doc.rect(15, y, 90, 6.5); doc.rect(105, y, 90, 6.5);
  doc.setFont('Helvetica', 'bold');
  doc.text('EXPECTED TIME:', 17, y + 4);
  doc.text('ACTUAL RETURN TIME:', 107, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.text(formatTimeOrNull(log.expected_return_time) || '—', 55, y + 4);
  doc.text(formatTimeOrNull(log.arrival_time) || '—', 158, y + 4);
  y += 6.5;

  // Mileage
  doc.rect(15, y, 90, 6.5); doc.rect(105, y, 90, 6.5);
  doc.setFont('Helvetica', 'bold');
  doc.text('INITIAL KM:', 17, y + 4);
  doc.text('FINAL KM:', 107, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.text(String(log.start_km ?? 0), 55, y + 4);
  doc.text(String(log.end_km ?? 0), 158, y + 4);
  y += 10.5;

  // --- 3. INSPECTION & CHECKLIST ---
  drawSectionHeader('3. INSPECTION AND ENTRY CHECKLIST', y);
  y += 5.5;

  doc.rect(15, y, 180, 22);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);

  const isChecked = (idx: number) => (log.checklist && log.checklist[idx]?.checked ? '[X]' : '[  ]');

  doc.text(`Tyres, Spare Tyre & Jack  ${isChecked(0)}`, 17, y + 4.5);
  doc.text(`Engine Oil & Radiator Fluid  ${isChecked(1)}`, 17, y + 9.5);
  doc.text(`Lights, Headlights & Horn  ${isChecked(2)}`, 17, y + 14.5);
  doc.text(`Brake System Operation  ${isChecked(3)}`, 17, y + 19.5);

  doc.text(`Vehicle Documents & Insurance  ${isChecked(4)}`, 107, y + 4.5);
  doc.text(`Warning Triangle & Vests  ${isChecked(5)}`, 107, y + 9.5);
  doc.text(`Valid Fire Extinguisher  ${isChecked(6)}`, 107, y + 14.5);
  doc.text('FUEL LEVEL: E [ ]  1/4 [ ]  1/2 [ ]  3/4 [ ]  F [ ]', 107, y + 19.5);
  y += 25.5;

  // --- 4. OUTBOUND OBSERVATIONS / TRAVEL TEAM ---
  drawSectionHeader('4. OUTBOUND OBSERVATIONS / ADDITIONAL NOTES', y);
  y += 5.5;

  doc.rect(15, y, 180, 24);
  doc.setFont('Helvetica', 'normal'); 
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  const teamText = log.travel_team && log.travel_team.trim() !== '' 
    ? `Travel Team: ${log.travel_team}` 
    : 'No additional notes or travel team specified.';
    
  const splitLines = doc.splitTextToSize(teamText, 170);
  doc.text(splitLines, 17, y + 6);
  
  y += 34;

  // --- SIGNATURES ---
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);

  doc.line(20, y, 85, y);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('MECHANIC / TECHNICIAN', 32, y + 4);

  doc.line(125, y, 190, y);
  doc.text('DISPATCHER / SUPERVISOR', 138, y + 4);

  return doc;
};

const STATUSES: { value: TravelStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FUEL_LEVELS: { value: FuelLevel; label: string }[] = [
  { value: 'empty', label: 'Empty (E)' },
  { value: 'quarter', label: '1/4' },
  { value: 'half', label: '1/2' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'full', label: 'Full (F)' },
];

const TRAVEL_CHECKLIST_ITEMS = [
  'Tyres / Spare Wheel / Jack',
  'Engine Oil / Radiator Coolant',
  'Lights / Headlights / Indicators / Horn',
  'Brake System',
  'Documents and Insurance',
  'Warning Triangle & Safety Vests',
  'Valid Fire Extinguisher',
];

const PAGE_SIZE = 8;

function makeChecklist(): ChecklistItem[] {
  return TRAVEL_CHECKLIST_ITEMS.map((label, i) => ({ id: `tc${i}`, label, checked: false, note: '' }));
}

export function TravelLogsPage() {
  const { travelLogs = [], equipment = [], saveTravelLog, deleteTravelLog } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { generateAndSave } = usePdfGenerator();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TravelLog | null>(null);
  const [form, setForm] = useState<Partial<TravelLog>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = profile?.role === 'admin' || profile?.role === 'user';
  const canDelete = profile?.role === 'admin';

  const vehicles = useMemo(() => {
    return (equipment || []).filter((e) => e.category === 'support_vehicle' || e.category === 'light_vehicle');
  }, [equipment]);

  const filtered = useMemo(() => {
    return (travelLogs || []).filter((tl) => {
      const matchSearch = !search ||
        tl.number?.toLowerCase().includes(search.toLowerCase()) ||
        tl.destination?.toLowerCase().includes(search.toLowerCase()) ||
        tl.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
        tl.vehicle_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || tl.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [travelLogs, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm({
      number: generateNumber('GV', (travelLogs || []).map((tl) => tl.number)),
      status: 'planned',
      fuel_start: 'full',
      fuel_end: 'full',
      start_km: 0,
      end_km: 0,
      departure_date: new Date().toISOString().split('T')[0],
      driver_name: profile?.full_name || '',
      checklist: makeChecklist(),
      license_plate: '',
      expected_return_time: null,
      arrival_time: null,
      travel_team: '',
      mechanic: '',
      dispatcher: '',
      origin: 'Workshop',
      destination: '',
      purpose: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (tl: TravelLog) => {
    setEditing(tl);
    setForm({
      ...tl,
      expected_return_time: formatTimeOrNull(tl.expected_return_time),
      arrival_time: formatTimeOrNull(tl.arrival_time),
      checklist: tl.checklist?.length ? tl.checklist : makeChecklist(),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.destination?.trim() || !form.driver_name?.trim()) {
      toast({ title: 'Destination and Driver Name are required', variant: 'destructive' });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload: Partial<TravelLog> = {
        ...form,
        expected_return_time: formatTimeOrNull(form.expected_return_time),
        arrival_time: formatTimeOrNull(form.arrival_time),
        user_id: profile?.id,
        vehicle_id: form.vehicle_id === 'none' ? null : form.vehicle_id,
      };

      const { error } = await saveTravelLog(payload);

      if (error) {
        toast({ title: 'Error saving Travel Log', description: error, variant: 'destructive' });
      } else {
        toast({ title: editing ? 'Travel log updated successfully' : 'Travel log created successfully' });
        setDialogOpen(false);
      }
    } catch (err: any) {
      console.error("Unexpected error in handleSave:", err);
      toast({ title: 'System error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteTravelLog(deleteId);
    if (error) {
      toast({ title: 'Error deleting record', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Travel log deleted successfully' });
    }
    setDeleteId(null);
  };

  const getVehicle = (id: string | null) => (id ? (equipment || []).find((e) => e.id === id) : undefined);

  const handlePreview = (tl: TravelLog) => {
    const doc = generateOfficialTravelLogPDF(tl, getVehicle(tl.vehicle_id));
    previewPDF(doc);
  };

  const handleDownload = (tl: TravelLog) => {
    const doc = generateOfficialTravelLogPDF(tl, getVehicle(tl.vehicle_id));
    downloadPDF(doc, `${tl.number}.pdf`);
  };

  const handleSaveAndUpload = async (tl: TravelLog) => {
    const doc = generateOfficialTravelLogPDF(tl, getVehicle(tl.vehicle_id));
    const { error } = await generateAndSave(doc, 'travel_log', tl.id, tl.number, `Travel Guide ${tl.number}`);
    if (error) {
      toast({ title: 'Error saving PDF to documents', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'PDF generated and attached', description: `${tl.number}.pdf saved in documents` });
    }
  };

  const toggleChecklist = (idx: number, checked: boolean) => {
    const checklist = [...(form.checklist || [])];
    checklist[idx] = { ...checklist[idx], checked };
    setForm({ ...form, checklist });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel Guides"
        description="Management and tracking of fleet vehicle dispatching"
        action={canEdit && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Travel Log
          </Button>
        )}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by number, destination, driver..."
        filters={<StatusFilter value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUSES} />}
      />

      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <EmptyState icon={<Route className="w-12 h-12" />} title="No travel logs found" description="Create your first travel log record" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="hidden md:table-cell">Driver</TableHead>
                  <TableHead className="hidden lg:table-cell">Departure Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Distance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((tl) => {
                  const distance = (tl.end_km || 0) - (tl.start_km || 0);
                  return (
                    <TableRow key={tl.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">{tl.number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{tl.destination}</div>
                        <div className="text-xs text-muted-foreground">{tl.vehicle_name || '—'}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{tl.driver_name}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(tl.departure_date)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{distance > 0 ? `${distance} km` : '—'}</TableCell>
                      <TableCell><StatusBadge status={tl.status} label={TRAVEL_STATUS_LABELS[tl.status]} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(tl)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(tl)} title="Download PDF">
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveAndUpload(tl)} title="Attach to Documents">
                            <FileCheck className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tl)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(tl.id)} title="Delete">
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

      {/* CREATE / EDIT TRAVEL LOG DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !isSubmitting && setDialogOpen(open)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Travel Log' : 'New Travel Log'}</DialogTitle>
            <DialogDescription>{editing ? 'Update travel log information' : 'Fill in the details for the new travel log'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 1. DRIVER & VEHICLE IDENTIFICATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number</Label>
                <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select
                  value={form.vehicle_id || 'none'}
                  onValueChange={(v) => {
                    const veh = (equipment || []).find((e) => e.id === v);
                    setForm({
                      ...form,
                      vehicle_id: v === 'none' ? null : v,
                      vehicle_name: veh?.name || form.vehicle_name || '',
                      license_plate: veh?.plate_number || form.license_plate || '',
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Vehicle</SelectItem>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Driver *</Label>
                <Input value={form.driver_name || ''} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="Driver's full name" />
              </div>
              <div className="space-y-2">
                <Label>License Plate</Label>
                <Input value={form.license_plate || ''} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} placeholder="LD-00-00-XX" />
              </div>
              <div className="space-y-2">
                <Label>Origin</Label>
                <Input value={form.origin || ''} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Workshop" />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Input value={form.destination || ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Destination location" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Purpose of Trip</Label>
              <Textarea value={form.purpose || ''} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} placeholder="Reason for travel" />
            </div>

            {/* 2. DEPARTURE & RETURN CONTROL */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                2. DEPARTURE & RETURN CONTROL
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Departure Date</Label>
                  <Input type="date" value={form.departure_date || ''} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Departure Time</Label>
                  <Input 
                    type="time" 
                    step="60" 
                    value={form.expected_return_time || ''} 
                    onChange={(e) => setForm({ ...form, expected_return_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial KM</Label>
                  <Input type="number" value={form.start_km ?? 0} onChange={(e) => setForm({ ...form, start_km: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Actual Return Date</Label>
                  <Input type="date" value={form.arrival_date || ''} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Actual Return Time</Label>
                  <Input 
                    type="time" 
                    step="60" 
                    value={form.arrival_time || ''} 
                    onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Final KM</Label>
                  <Input type="number" value={form.end_km ?? 0} onChange={(e) => setForm({ ...form, end_km: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            {/* Fuel Levels */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuel Level (Departure)</Label>
                <Select value={form.fuel_start || 'full'} onValueChange={(v) => setForm({ ...form, fuel_start: v as FuelLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FUEL_LEVELS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fuel Level (Return)</Label>
                <Select value={form.fuel_end || 'full'} onValueChange={(v) => setForm({ ...form, fuel_end: v as FuelLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FUEL_LEVELS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* 3. CHECKLIST */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">3. Inspection and Entry Checklist</Label>
              <div className="space-y-2 border border-border rounded-lg p-3">
                {form.checklist?.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <Checkbox checked={item.checked} onCheckedChange={(v) => toggleChecklist(idx, !!v)} />
                    <span className="text-sm flex-1">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. TEAM & STAFF */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Travel Team / Passengers</Label>
                <Input 
                  value={form.travel_team || ''} 
                  onChange={(e) => setForm({ ...form, travel_team: e.target.value })} 
                  placeholder="Names of passengers/team" 
                />
              </div>
              <div className="space-y-2">
                <Label>Mechanic</Label>
                <Input value={form.mechanic || ''} onChange={(e) => setForm({ ...form, mechanic: e.target.value })} placeholder="Assigned mechanic" />
              </div>
              <div className="space-y-2">
                <Label>Dispatcher</Label>
                <Input value={form.dispatcher || ''} onChange={(e) => setForm({ ...form, dispatcher: e.target.value })} placeholder="Authorized dispatcher" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || 'planned'} onValueChange={(v) => setForm({ ...form, status: v as TravelStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Travel Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Travel Log"
        description="This action will permanently delete this record."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
