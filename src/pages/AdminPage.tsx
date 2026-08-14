import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, EmptyState } from '@/components/shared';
import { FilterBar, Pagination } from '@/components/shared/table-helpers';
import { ConfirmDialog } from '@/components/shared/dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShieldCheck, Pencil, Trash2, Users, Lock, KeyRound } from 'lucide-react';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_ORDER, ROLE_COLORS, formatDate } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Profile, UserRole, UserStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const PERMISSIONS_MATRIX = [
  { module: 'Equipment', admin: 'Full', user: 'Edit' },
  { module: 'Inspections', admin: 'Full', user: 'Edit' },
  { module: 'Folha de Obra', admin: 'Full', user: 'Edit' },
  { module: 'Guia de Viagem', admin: 'Full', user: 'Edit' },
  { module: 'Requisitions', admin: 'Full', user: 'Create' },
  { module: 'Documents', admin: 'Full', user: 'View' },
  { module: 'Admin Panel', admin: 'Full', user: 'None' },
];

const PERM_COLORS: Record<string, string> = {
  Full: 'text-emerald-600 dark:text-emerald-400',
  Edit: 'text-blue-600 dark:text-blue-400',
  Create: 'text-amber-600 dark:text-amber-400',
  View: 'text-muted-foreground',
  None: 'text-red-500 dark:text-red-400',
};

const PAGE_SIZE = 8;

export function AdminPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Error loading users', description: error.message, variant: 'destructive' });
      } else if (data) {
        setUsers(data as Profile[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openEdit = (user: Profile) => {
    setEditingUser(user);
    setForm(user);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      role: form.role,
      status: form.status,
      full_name: form.full_name,
      phone: form.phone,
    }).eq('id', editingUser!.id);
    if (error) {
      toast({ title: 'Error updating user', description: error.message, variant: 'destructive' });
    } else {
      setUsers((prev) => prev.map((u) => u.id === editingUser!.id ? { ...u, ...form } as Profile : u));
      toast({ title: 'User updated' });
      setDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('profiles').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Error removing user', description: error.message, variant: 'destructive' });
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== deleteId));
      toast({ title: 'User removed' });
    }
    setDeleteId(null);
  };

  if (profile?.role !== 'admin') {
    return (
      <div>
        <PageHeader title="Admin Panel" />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Lock className="w-12 h-12" />}
              title="Access Restricted"
              description="Only administrators can access the Admin Panel."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        description="Manage users, assign roles, and review CRUD permissions"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-xl font-bold mt-1">{users.length}</p>
              </div>
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        {ROLE_ORDER.map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                    <p className="text-xl font-bold mt-1">{count}</p>
                  </div>
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', ROLE_COLORS[role])}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            CRUD Permissions Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {ROLE_ORDER.map((r) => <TableHead key={r} className="text-center text-xs">{ROLE_LABELS[r]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS_MATRIX.map((row) => (
                <TableRow key={row.module}>
                  <TableCell className="font-medium">{row.module}</TableCell>
                  {ROLE_ORDER.map((r) => (
                    <TableCell key={r} className="text-center">
                      <span className={cn('text-xs font-medium', PERM_COLORS[row[r as 'admin' | 'user']] || '')}>
                        {row[r as 'admin' | 'user']}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users Table */}
      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by name or email..."
        filters={
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLE_ORDER.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : paginated.length === 0 ? (
            <EmptyState icon={<Users className="w-12 h-12" />} title="No users found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className={cn('text-xs font-semibold', ROLE_COLORS[user.role as UserRole] || ROLE_COLORS.user)}>
                            {user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge className={ROLE_COLORS[user.role as UserRole] || ROLE_COLORS.user}>{ROLE_LABELS[user.role as UserRole] || 'User'}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        user.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {user.id !== profile?.id && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(user.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role || 'user'} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[form.role as UserRole]}</p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || 'active'} onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove User"
        description="This will remove the user's profile. The auth account will need to be managed separately in Supabase."
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
}
