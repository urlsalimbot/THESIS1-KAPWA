import { useState } from 'react';
import useSWR from 'swr';
import { mutate } from 'swr';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { Search, Plus, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { DataTable } from '@/components/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface AppUser {
  id: string; email: string; fullName: string; role: string;
  assignedBarangay: string; isActive: boolean; createdAt: string;
  phone?: string; permittedBarangays?: string[]; agencyId?: string;
}

interface UsersResponse {
  data: AppUser[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'MSWDO Admin',
  social_worker: 'MSWDO Social Worker',
  coordinator: 'Barangay Coordinator',
  claimant: 'Claimant',
  mayor: "Mayor's Office",
  auditor: 'Auditor',
  agency_staff: 'Agency Staff',
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS);

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

function EditableRoleCell({ user, onRoleChange, roleLabel }: { user: AppUser; onRoleChange: (user: AppUser, role: string) => void; roleLabel: (r: string) => string }) {
  return (
    <Select defaultValue={user.role} onValueChange={(v) => onRoleChange(user, v)}>
      <SelectTrigger aria-label={`Role for ${user.email}`} className="h-7 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">{roleLabel(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ isActive, t }: { isActive: boolean; t: TFunction }) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
      {isActive ? t('usersPanel.active', 'Active') : t('usersPanel.inactive', 'Inactive')}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function UsersPanel() {
  const { t } = useTranslation();
  const roleLabel = (r: string) => t(`usersPanel.role.${r}`, ROLE_LABELS[r] || r);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPermittedBarangays, setEditPermittedBarangays] = useState('');
  const [editAgencyId, setEditAgencyId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState('social_worker');
  const [formPhone, setFormPhone] = useState('');
  const [formBarangay, setFormBarangay] = useState('');
  const [formPermittedBarangays, setFormPermittedBarangays] = useState('');
  const [createAgencyId, setCreateAgencyId] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const effectiveRole = roleFilter === 'all' ? undefined : roleFilter;

  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  const { data: response, isLoading } = useSWR<UsersResponse>(
    ['users', search, effectiveRole, pagination.pageIndex + 1, pagination.pageSize] as const,
    ([_key, s, r, p, l]: readonly [string, string, string | undefined, number, number]) => {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (r) params.set('role', r);
      params.set('page', String(p));
      params.set('limit', String(l));
      return api.get(`/users?${params.toString()}`);
    },
  );

  const users = response?.data ?? [];
  const total = response?.total ?? 0;

  async function toggleUserStatus(user: AppUser) {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      await revalidate();
    } catch (e) { console.error('UsersPanel:', e); }
  }

  async function updateUserRole(user: AppUser, role: string) {
    try {
      await api.put(`/users/${user.id}`, { role });
      await revalidate();
    } catch (e) { console.error('UsersPanel:', e); }
  }

  function openEdit(user: AppUser) {
    setEditUser(user);
    setEditFullName(user.fullName || '');
    setEditRole(user.role);
    setEditBarangay(user.assignedBarangay || '');
    setEditPermittedBarangays((user.permittedBarangays || []).join(', '));
    setEditAgencyId(user.agencyId || '');
  }

  async function saveEdit() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName: editFullName,
        role: editRole,
      };
      if (editBarangay) body.assignedBarangay = editBarangay;
      if (editPermittedBarangays.trim()) {
        body.permittedBarangays = editPermittedBarangays.split(',').map(b => b.trim()).filter(Boolean);
      } else {
        body.permittedBarangays = [];
      }
      if (editAgencyId) body.agencyId = editAgencyId;
      await api.put(`/users/${editUser.id}`, body);
      setEditUser(null);
      await revalidate();
    } catch (e) {
      console.error('UsersPanel:', e);
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.del(`/users/${deleteId}`);
      setDeleteId(null);
      await revalidate();
    } catch (e) { console.error('UsersPanel:', e); }
  }

  async function revalidate() {
    await mutate(
      (key) => Array.isArray(key) && key[0] === 'users',
      undefined,
      { revalidate: true },
    );
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormSuccess('');
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        email: formEmail,
        password: formPassword,
        role: formRole,
      };
      if (formFullName) body.full_name = formFullName;
      if (formPhone) body.phone = formPhone;
      if (formBarangay) body.assigned_barangay = formBarangay;
      if (formPermittedBarangays.trim()) {
        body.permitted_barangays = formPermittedBarangays.split(',').map(b => b.trim()).filter(Boolean);
      }
      if (createAgencyId) body.agency_id = createAgencyId;
      const data = await api.post<{ user?: { email?: string } }>('/users', body);
      setFormSuccess(t('usersPanel.userCreated', 'User {{email}} created successfully', { email: data.user?.email || formEmail }));
      setFormEmail('');
      setFormPassword('');
      setFormFullName('');
      setFormRole('social_worker');
      setFormPhone('');
      setFormBarangay('');
      setFormPermittedBarangays('');
      setCreateAgencyId('');
      await revalidate();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('usersPanel.createFailed', 'Failed to create user'));
    } finally {
      setFormSubmitting(false);
    }
  }

  const columns: ColumnDef<AppUser>[] = [
    {
      accessorKey: 'email',
      header: t('usersPanel.email', 'Email'),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'fullName',
      header: t('usersPanel.name', 'Name'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.fullName || '—'}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: t('usersPanel.roleCol', 'Role'),
      cell: ({ row }) => (
        <EditableRoleCell user={row.original} onRoleChange={updateUserRole} roleLabel={roleLabel} />
      ),
    },
    {
      accessorKey: 'assignedBarangay',
      header: t('usersPanel.barangay', 'Barangay'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.assignedBarangay || '—'}</span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: t('usersPanel.status', 'Status'),
      cell: ({ row }) => (
        <button onClick={() => toggleUserStatus(row.original)} className="hover:opacity-80 transition-opacity">
          <StatusBadge isActive={row.original.isActive} t={t} />
        </button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('usersPanel.created', 'Created'),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: t('usersPanel.actions', 'Actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row.original)}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            aria-label={t('usersPanel.editAria', 'Edit {{email}}', { email: row.original.email })}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteId(row.original.id)}
            className="w-7 h-7 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={t('usersPanel.deleteAria', 'Delete {{email}}', { email: row.original.email })}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t('usersPanel.searchPlaceholder', 'Search by email or name...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="w-44">
              <Select
                value={roleFilter}
                onValueChange={(v) => { setRoleFilter(v); setPagination(p => ({ ...p, pageIndex: 0 })); }}
              >
                <SelectTrigger aria-label={t('usersPanel.filterRole', 'Filter by role')} className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('usersPanel.allRoles', 'All Roles')}</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={statusFilter}
                onValueChange={(v) => { setStatusFilter(v); setPagination(p => ({ ...p, pageIndex: 0 })); }}
              >
                <SelectTrigger aria-label={t('usersPanel.filterStatus', 'Filter by status')} className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{t(`usersPanel.statusFilter.${o.value}`, o.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setPagination(p => ({ ...p, pageIndex: 0 })); }}>
              <RotateCcw size={14} className="mr-1.5" />
              {t('usersPanel.reset', 'Reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create / New User */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{t('usersPanel.createNewUser', 'Create New User')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? t('usersPanel.hide', 'Hide') : <><Plus size={14} className="mr-1" /> {t('usersPanel.newUser', 'New User')}</>}
          </Button>
        </CardHeader>
        {showCreate && (
          <CardContent>
            {formSuccess && (
              <div className="mb-4 rounded bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{formSuccess}</div>
            )}
            {formError && (
              <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>
            )}
            <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="panel-email">{t('usersPanel.email', 'Email')} *</Label>
                <Input id="panel-email" type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="panel-password">{t('usersPanel.password', 'Password')} *</Label>
                <Input id="panel-password" type="password" required minLength={8} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder={t('usersPanel.minChars', 'Min 8 characters')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="panel-name">{t('usersPanel.fullName', 'Full Name')}</Label>
                <Input id="panel-name" value={formFullName} onChange={e => setFormFullName(e.target.value)} placeholder="Juan Dela Cruz" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="panel-role">{t('usersPanel.roleCol', 'Role')} *</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger id="panel-role" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formRole === 'agency_staff' && (
                <div className="space-y-1">
                  <Label htmlFor="panel-agency">{t('usersPanel.agency', 'Agency')} *</Label>
                  <Select value={createAgencyId} onValueChange={setCreateAgencyId}>
                    <SelectTrigger id="panel-agency" className="h-10">
                      <SelectValue placeholder={t('usersPanel.selectAgency', 'Select agency...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(agencies || []).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="panel-phone">{t('usersPanel.phone', 'Phone')}</Label>
                <Input id="panel-phone" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="09171234567" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="panel-barangay">{t('usersPanel.assignedBarangay', 'Assigned Barangay')}</Label>
                <Input id="panel-barangay" value={formBarangay} onChange={e => setFormBarangay(e.target.value)} placeholder="Norzagaray" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="panel-barangays">{t('usersPanel.permittedBarangays', 'Permitted Barangays (comma-separated)')}</Label>
                <Input id="panel-barangays" value={formPermittedBarangays} onChange={e => setFormPermittedBarangays(e.target.value)} placeholder="Norzagaray, Angat, San Jose" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={formSubmitting || (formRole === 'agency_staff' && !createAgencyId)}
                >
                  {formSubmitting ? t('usersPanel.creating', 'Creating...') : t('usersPanel.createUser', 'Create User')}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* User Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={users}
            rowCount={total}
            loading={isLoading}
            pagination={pagination}
            sorting={sorting}
            onPaginationChange={setPagination}
            onSortingChange={setSorting}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('usersPanel.editUser', 'Edit User')}</DialogTitle>
            <DialogDescription>
              {t('usersPanel.editDesc', 'Update details for {{email}}', { email: editUser?.email })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name">{t('usersPanel.fullName', 'Full Name')}</Label>
              <Input id="edit-name" value={editFullName} onChange={e => setEditFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-role">{t('usersPanel.roleCol', 'Role')}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editRole === 'agency_staff' && (
              <div className="space-y-1">
                <Label htmlFor="edit-agency">{t('usersPanel.agency', 'Agency')}</Label>
                <Select value={editAgencyId} onValueChange={setEditAgencyId}>
                  <SelectTrigger id="edit-agency">
                    <SelectValue placeholder={t('usersPanel.selectAgency', 'Select agency...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(agencies || []).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="edit-barangay">{t('usersPanel.assignedBarangay', 'Assigned Barangay')}</Label>
              <Input id="edit-barangay" value={editBarangay} onChange={e => setEditBarangay(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-barangays">{t('usersPanel.permittedBarangays', 'Permitted Barangays (comma-separated)')}</Label>
              <Input id="edit-barangays" value={editPermittedBarangays} onChange={e => setEditPermittedBarangays(e.target.value)} />
            </div>
            {editUser && (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">{t('usersPanel.accountStatus', 'Account status')}</span>
                <Button
                  variant={editUser.isActive ? 'outline' : 'default'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={async () => {
                    await toggleUserStatus(editUser);
                  }}
                >
                  {editUser.isActive ? t('usersPanel.deactivate', 'Deactivate') : t('usersPanel.activate', 'Activate')}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">{t('usersPanel.cancel', 'Cancel')}</Button>
            </DialogClose>
            <Button size="sm" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? t('usersPanel.saving', 'Saving...') : t('usersPanel.saveChanges', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('usersPanel.deleteTitle', 'Delete User?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('usersPanel.deleteDesc', 'This will permanently remove this user from the system. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('usersPanel.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('usersPanel.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
