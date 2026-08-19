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

// --- GERADOR EXATO DO MODELO PDF: TERMO DE ENTREGA ---
export const generateDeliveryTermPDF = (term: DeliveryTerm): jsPDF => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho institucional
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CHINANGOL, LDA', 18, 15);
  doc.setFontSize(10);
  doc.setTextColor(220, 0, 0);
  doc.text('SANY DEPARTMENT', 18, 20);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.text('TERMO DE ENTREGA DE EQUIPAMENTO', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text('Informamos que para os devidos fins, o equipamento indicado abaixo foi entregue ao cliente:', 18, 38);

  let startY = 43;
  const rowHeight = 7.5; // Altura ideal para dar respiro ao texto nas linhas
  
  const drawField = (y: number, label: string, value: string) => {
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.2);
    doc.rect(18, y, 174, rowHeight);
    doc.setFont('Helvetica', 'bold');
    doc.text(label, 21, y + 5);
    doc.setFont('Helvetica', 'normal');
    doc.text(value || '-', 72, y + 5);
  };

  // Bloco 1: Dados do Cliente
  drawField(startY, 'Cliente', term.client);
  drawField(startY += rowHeight, 'Morada', term.address);
  drawField(startY += rowHeight, 'Responsável', term.responsible);
  
  // Título do Bloco 2 com espaçamento seguro abaixo da última linha da tabela do cliente
  startY += rowHeight + 4;
  doc.setFont('Helvetica', 'bold');
  doc.text('Dados do Equipamento', pageWidth / 2, startY, { align: 'center' });
  
  // Margem segura antes de iniciar a segunda tabela
  startY += 5;

  // Bloco 2: Dados do Equipamento
  drawField(startY, 'Equipamento', term.equipment);
  drawField(startY += rowHeight, 'Modelo', term.model);
  drawField(startY += rowHeight, 'Ano de Fabrico', term.fabrication_year);
  drawField(startY += rowHeight, 'Número de Série', term.serial_number);
  drawField(startY += rowHeight, 'Acessórios Incluídos', term.included_accessories);
  drawField(startY += rowHeight, 'Telefone', term.phone);
  drawField(startY += rowHeight, 'Local de Entrega', term.delivery_location);

  // Observações com margem de segurança para evitar colisão com a tabela acima
  startY += rowHeight + 6;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Observações e Condições de Entrega:', 18, startY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  const obsLines = [
    '• O equipamento foi inspecionado, confirmado e aceite pelo cliente em perfeitas condições;',
    '• O cliente é responsável pelo transporte do equipamento no local de entrega até ao destino final;',
    '• Após a entrega do equipamento o vendedor ficará livre de todas as despesas, encargos e danos que possam surgir.'
  ];
  
  startY += 5;
  obsLines.forEach(line => {
    doc.text(line, 18, startY);
    startY += 5;
  });

  // Secção de Assinaturas reposicionada com espaço folgado
  startY += 12;
  doc.setFont('Helvetica', 'bold');
  doc.text('Representante da Chinangol', 45, startY, { align: 'center' });
  doc.line(20, startY + 15, 75, startY + 15);
  doc.text(`Data: ${term.delivery_date || '___/___/______'}`, 45, startY + 20, { align: 'center' });

  doc.text('Cliente / Recebedor', 155, startY, { align: 'center' });
  doc.line(130, startY + 15, 185, startY + 15);
  doc.text(`Data: ${term.delivery_date || '___/___/______'}`, 155, startY + 20, { align: 'center' });

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
        title: 'Campos obrigatórios em falta', 
        description: 'Por favor preencha Cliente, Equipamento e Data de Entrega.', 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    try {
      const result = await saveDeliveryTerm(form as DeliveryTerm);
      
      if (!result.success) {
        toast({ 
          title: 'Erro ao guardar na Base de Dados', 
          description: result.error || 'Erro desconhecido retornado pelo servidor', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Sucesso!', description: 'Termo de entrega gravado com sucesso.' });
        setDialogOpen(false);
        setForm({});
        setEditing(null);
      }
    } catch (err: any) {
      toast({ 
        title: 'Erro crítico de execução', 
        description: err.message || 'Ocorreu um erro inesperado.', 
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
        title="Termos de Entrega" 
        description="Gestão de entrega de equipamentos SANY e emissão de termos oficiais"
        action={
          <Button onClick={() => { setEditing(null); setForm({}); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo Termo
          </Button>
        } 
      />

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Pesquisar por cliente ou equipamento..." />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Nº de Série</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum termo de entrega registado.
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => previewPDF(generateDeliveryTermPDF(t))} title="Visualizar PDF">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id!)} title="Eliminar">
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
            <DialogTitle>{editing ? 'Editar Termo de Entrega' : 'Novo Termo de Entrega'}</DialogTitle>
            <DialogDescription>Preencha todos os dados exigidos pelo modelo oficial SANY/Chinangol.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Cliente *</Label>
              <Input placeholder="Nome do cliente" value={form.client || ''} onChange={e => setForm({...form, client: e.target.value})} />
            </div>
            <div>
              <Label>Morada</Label>
              <Input placeholder="Morada do cliente" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input placeholder="Nome do responsável" value={form.responsible || ''} onChange={e => setForm({...form, responsible: e.target.value})} />
            </div>
            <div>
              <Label>Equipamento *</Label>
              <Input placeholder="Ex: Escavadora SANY" value={form.equipment || ''} onChange={e => setForm({...form, equipment: e.target.value})} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input placeholder="Ex: SY215C" value={form.model || ''} onChange={e => setForm({...form, model: e.target.value})} />
            </div>
            <div>
              <Label>Ano de Fabrico</Label>
              <Input placeholder="Ex: 2024" value={form.fabrication_year || ''} onChange={e => setForm({...form, fabrication_year: e.target.value})} />
            </div>
            <div>
              <Label>Número de Série</Label>
              <Input placeholder="Nº de série" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input placeholder="Contacto telefónico" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Acessórios Incluídos</Label>
              <Input placeholder="Ex: Balde standard, manual, kit de ferramentas" value={form.included_accessories || ''} onChange={e => setForm({...form, included_accessories: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Local de Entrega</Label>
              <Input placeholder="Local exato de entrega" value={form.delivery_location || ''} onChange={e => setForm({...form, delivery_location: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Data de Entrega *</Label>
              <Input type="date" value={form.delivery_date || ''} onChange={e => setForm({...form, delivery_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Termo
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
        title="Eliminar Termo?" 
        description="Esta ação não pode ser desfeita e removerá o registo permanentemente." 
        destructive 
      />
    </div>
  );
}