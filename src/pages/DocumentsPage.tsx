import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, EmptyState } from '@/components/shared';
import { FilterBar, Pagination, StatusFilter } from '@/components/shared/table-helpers';
import { ConfirmDialog } from '@/components/shared/dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, Eye, Download, Trash2, FileCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { getDocumentUrl } from '@/lib/pdf';
import type { DocumentType } from '@/types';
import { useToast } from '@/hooks/use-toast';

const TYPE_LABELS: Record<DocumentType, string> = {
  work_order: 'Folha de Obra',
  travel_log: 'Guia de Viagem',
  inspection: 'Inspection',
  requisition: 'Requisição de Peças',
};

const TYPE_OPTIONS = [
  { value: 'work_order', label: 'Folha de Obra' },
  { value: 'travel_log', label: 'Guia de Viagem' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'requisition', label: 'Requisição de Peças' },
];

const PAGE_SIZE = 10;

export function DocumentsPage() {
  const { documents, deleteDocument } = useData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canDelete = profile?.role === 'admin';

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch = !search ||
        d.number.toLowerCase().includes(search.toLowerCase()) ||
        d.title.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || d.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [documents, search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePreview = async (filePath: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({ title: 'Could not load PDF', variant: 'destructive' });
    }
  };

  const handleDownload = async (filePath: string, filename: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } else {
      toast({ title: 'Could not download PDF', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const doc = documents.find((d) => d.id === deleteId);
    if (doc) {
      await supabase.storage.from('ems-documents').remove([doc.file_path]);
    }
    const { error } = await deleteDocument(deleteId);
    if (error) {
      toast({ title: 'Error deleting', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Document deleted' });
    }
    setDeleteId(null);
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Generated PDFs stored in Supabase Storage — preview, download, or manage"
      />

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="No documents yet"
              description="Generate PDFs from Work Orders, Travel Logs, or Inspections using the 'Save to Storage' button. They'll appear here for preview and download."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <FilterBar
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search by number or title..."
            filters={
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead className="hidden md:table-cell">Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-primary" />
                          <span className="text-sm">{TYPE_LABELS[doc.type]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{doc.number}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{doc.title}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDateTime(doc.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(doc.file_path)} title="Preview PDF">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc.file_path, `${doc.number}.pdf`)} title="Download PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(doc.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {filtered.length > PAGE_SIZE && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        description="This will permanently remove the PDF from storage and the document record."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
