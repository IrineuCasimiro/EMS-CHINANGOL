import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useData, DeliveryTerm } from '@/contexts/DataContext';
import { PageHeader } from '@/components/shared';
import { FilterBar } from '@/components/shared/table-helpers';
import { ConfirmDialog } from '@/components/shared/dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Eye, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/constants';
import { previewPDF } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';

// --- EXACT PDF MODEL GENERATOR: EQUIPMENT DELIVERY TERM ---
export const generateDeliveryTermPDF = (term: DeliveryTerm): jsPDF => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Institutional Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CHINANGOL, LDA', 18, 15);
  doc.setFontSize(10);
  doc.setTextColor(220, 0, 0);
  doc.text('SANY DEPARTMENT', 18, 20);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.text('EQUIPMENT DELIVERY TERM', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('Please be advised that for all due purposes, the equipment indicated below was delivered to the client:', 18, 38);

  let startY = 43;
  const rowHeight = 7.5; // Ideal height to give breathing room to text in rows
  
  const drawField = (y: number, label: string, value: string) => {
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.2);
    doc.rect(18, y, 174, rowHeight);
    doc.setFont('Helvetica', 'bold');
    doc.text(label, 21, y + 5);
    doc.setFont('Helvetica', 'normal');
    doc.text(value || '-', 72, y + 5);
  };

  // Block 1: Client Data
  drawField(startY, 'Client', term.client);
  drawField(startY += rowHeight, 'Address', term.address);
  drawField(startY += rowHeight, 'Person in Charge', term.responsible);
  
  // Title for Block 2 with safe spacing below the last line of the client table
  startY += rowHeight + 4;
  doc.setFont('Helvetica', 'bold');
  doc.text('Equipment Details', pageWidth / 2, startY, { align: 'center' });
  
  // Safe margin before starting the second table
  startY += 5;

  // Block 2: Equipment Data
  drawField(startY, 'Equipment', term.equipment);
  drawField(startY += rowHeight, 'Model', term.model);
  drawField(startY += rowHeight, 'Year of Manufacture', term.fabrication_year);
  drawField(startY += rowHeight, 'Serial Number', term.serial_number);
  drawField(startY += rowHeight, 'Included Accessories', term.included_accessories);
  drawField(startY += rowHeight, 'Phone', term.phone);
  drawField(startY += rowHeight, 'Delivery Location', term.delivery_location);

  // Remarks with safety margin to prevent collision with the table above
  startY += rowHeight + 6;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Remarks and Delivery Conditions:', 18, startY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  const obsLines = [
    '• The equipment was inspected, confirmed, and accepted by the client in perfect working condition;',
    '• The client is responsible for transporting the equipment from the delivery site to the final destination;',
    '• Upon delivery of the equipment, the seller shall be released from all expenses, charges, and damages that may arise.'
  ];
  
  startY += 5;
  obsLines.forEach(line => {
    doc.text(line, 18, startY);
    startY += 5;
  });

  // Repositioned Signatures Section with ample space
  startY += 12;
  doc.setFont('Helvetica', 'bold');
  doc.text('Chinangol Representative', 45, startY, { align: 'center' });
  doc.line(20, startY + 15, 75, startY + 15);
  doc.text(`Date: ${term.delivery_date || '___/___/______'}`, 45, startY + 20, { align: 'center' });

  doc.text('Client / Recipient', 155, startY, { align: 'center' });
  doc.line(130, startY + 15, 185, startY + 15);
  doc.text(`Date: ${term.delivery_date || '___/___/______'}`, 155, startY + 20, { align: 'center' });

  return doc;
};

export function DeliveryTermsPage() {
  const { deliveryTerms = [], saveDeliveryTerm, deleteDeliveryTerm } = useData();
  const { toast } = useToast();
  
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryTerm | null>(null);
  const [form, setForm] = useState<Partial<DeliveryTerm>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return deliveryTerms.filter(t => 
      (t.client || '').toLowerCase().includes(search.toLowerCase()) || 
      (t.equipment || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [deliveryTerms, search]);

  const handleSave = async () => {
    if (!form.client || !form.equipment || !form.delivery_date) {
      toast({ 
        title: 'Required fields missing', 
        description: 'Please fill in Client, Equipment, and Delivery Date.', 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    try {
      const result = await saveDeliveryTerm(form as DeliveryTerm);
      
      if (!result.success) {
        toast({ 
          title: 'Error saving to Database', 
          description: result.error || 'Unknown error returned by server', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Success!', description: 'Delivery term saved successfully.' });
        setDialogOpen(false);
        setForm({});
        setEditing(null);
      }
    } catch (err: any) {
      toast({ 
        title: 'Critical execution error', 
        description: err.message || 'An unexpected error occurred.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (term: DeliveryTerm) => {
    setEditing(term);
    setForm(term);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader 
        title="Delivery Terms" 
        description="Management of SANY equipment delivery and issuance of official terms"
        action={
          <Button onClick={() => { setEditing(null); setForm({}); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Term
          </Button>
        } 
      />

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by client or equipment..." />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Serial No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No delivery terms registered.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.client}</TableCell>
                    <TableCell>{t.equipment}</TableCell>
                    <TableCell>{t.model}</TableCell>
                    <TableCell>{t.serial_number}</TableCell>
                    <TableCell>{formatDate(t.delivery_date)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => previewPDF(generateDeliveryTermPDF(t))} title="Preview PDF">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id!)} title="Delete">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Delivery Term' : 'New Delivery Term'}</DialogTitle>
            <DialogDescription>Fill in all required data according to the official SANY/Chinangol template.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Client *</Label>
              <Input placeholder="Client name" value={form.client || ''} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div>
              <Label>Address</Label>
              <Input placeholder="Client address" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div>
              <Label>Person in Charge</Label>
              <Input placeholder="Name of person in charge" value={form.responsible || ''} onChange={e => setForm({...form, responsible: e.target.value})} />
            </div>
            <div>
              <Label>Equipment *</Label>
              <Input placeholder="Ex: SANY Excavator" value={form.equipment || ''} onChange={e => setForm({...form, equipment: e.target.value})} />
            </div>
            <div>
              <Label>Model</Label>
              <Input placeholder="Ex: SY215C" value={form.model || ''} onChange={e => setForm({...form, model: e.target.value})} />
            </div>
            <div>
              <Label>Year of Manufacture</Label>
              <Input placeholder="Ex: 2024" value={form.fabrication_year || ''} onChange={e => setForm({...form, fabrication_year: e.target.value})} />
            </div>
            <div>
              <Label>Serial Number</Label>
              <Input placeholder="Serial No." value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input placeholder="Phone number" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Included Accessories</Label>
              <Input placeholder="Ex: Standard bucket, manual, toolkit" value={form.included_accessories || ''} onChange={e => setForm({...form, included_accessories: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Delivery Location</Label>
              <Input placeholder="Exact delivery location" value={form.delivery_location || ''} onChange={e => setForm({...form, delivery_location: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Delivery Date *</Label>
              <Input type="date" value={form.delivery_date || ''} onChange={e => setForm({...form, delivery_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Term
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog 
        open={!!deleteId} 
        onOpenChange={open => !open && setDeleteId(null)} 
        onConfirm={() => {
          if (deleteId) deleteDeliveryTerm(deleteId);
          setDeleteId(null);
        }} 
        title="Delete Term?" 
        description="This action cannot be undone and will permanently remove the record." 
        destructive 
      />
    </div>
  );
}