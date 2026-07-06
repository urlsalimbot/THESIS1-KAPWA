import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Program {
  id: string; name: string; category: string; isActive: boolean;
  waitingPeriodDays: number; fundSources: string[];
}

interface SyncEntry {
  id: string; deviceId: string; tableName: string; operation: string;
  status: string; conflictReason: string; createdAt: string;
}

interface AppUser {
  id: string; email: string; fullName: string; role: string;
  assignedBarangay: string; isActive: boolean; createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'MSWDO Admin',
  social_worker: 'MSWDO Social Worker',
  coordinator: 'Barangay Coordinator',
  claimant: 'Claimant',
  mayor: "Mayor's Office",
  auditor: 'Auditor',
};

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>('programs');
  const [userSearch, setUserSearch] = useState('');
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  // Create user form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState('social_worker');
  const [formPhone, setFormPhone] = useState('');
  const [formBarangay, setFormBarangay] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [formPermittedBarangays, setFormPermittedBarangays] = useState('');

  // 4 conditional useSWR hooks — one per activeTab value. The null key
  // tells SWR to skip the fetch for inactive tabs (SWR official docs).
  // The api.get fetcher is bound globally in routes.tsx.
  const { data: programsRaw, isLoading: loadingPrograms } = useSWR<Program[]>(
    activeTab === 'programs' ? queryKeys.admin.programs() : null,
  );
  const { data: usersRaw, isLoading: loadingUsers } = useSWR<unknown>(
    activeTab === 'users' ? queryKeys.admin.users() : null,
  );
  const { data: syncEntriesRaw, isLoading: loadingSync } = useSWR<SyncEntry[]>(
    activeTab === 'sync' ? queryKeys.admin.syncEntries() : null,
  );
  const { data: auditLogs, isLoading: loadingAudit } = useSWR<unknown>(
    activeTab === 'audit' ? queryKeys.admin.auditLogs() : null,
  );
  // Default to [] so the inactive-tab content branches still have safe values
  // (Radix Tabs renders all panels; the active one is just visible).
  const programs = programsRaw ?? [];
  const syncEntries = syncEntriesRaw ?? [];
  // The /users endpoint returns { data: AppUser[] } or AppUser[] — handle both shapes.
  const users = ((usersRaw as { data?: AppUser[] } | undefined)?.data
    ?? (usersRaw as AppUser[] | undefined)
    ?? []) as AppUser[];
  // The /admin/auditLogs endpoint returns [coaExport, hashChain] — keep the array shape.
  const auditLogsArr = Array.isArray(auditLogs) ? auditLogs as any[] : [];

  // Single loading flag for the active tab's skeleton
  const loading =
    (activeTab === 'programs' && loadingPrograms) ||
    (activeTab === 'users' && loadingUsers) ||
    (activeTab === 'sync' && loadingSync) ||
    (activeTab === 'audit' && loadingAudit);

  const lastSync = Date.now();

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
      const data = await api.post<{ user?: { email?: string } }>('/users', body);
      setFormSuccess(`User ${data.user?.email || formEmail} created successfully`);
      setFormEmail('');
      setFormPassword('');
      setFormFullName('');
      setFormRole('social_worker');
      setFormPhone('');
      setFormBarangay('');
      setFormPermittedBarangays('');
      // Revalidate the users list
      await mutate(queryKeys.admin.users(), undefined, { revalidate: true });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function toggleUserStatus(user: AppUser) {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      await mutate(queryKeys.admin.users(), undefined, { revalidate: true });
    } catch (e) { console.error("AdminPage:", e); }
  }

  async function updateUserRole(user: AppUser, role: string) {
    try {
      await api.put(`/users/${user.id}`, { role });
      await mutate(queryKeys.admin.users(), undefined, { revalidate: true });
    } catch (e) { console.error("AdminPage:", e); }
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.del(`/users/${id}`);
      await mutate(queryKeys.admin.users(), undefined, { revalidate: true });
    } catch (e) { console.error("AdminPage:", e); }
  }

  const filteredUsers = users.filter(u => !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) || (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <PageShell
      title="Admin Panel"
      description="System configuration, users, and monitoring"
      cachedAt={lastSync ?? undefined}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="programs">📋 Programs</TabsTrigger>
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="sync">🔄 Sync Queue</TabsTrigger>
          <TabsTrigger value="audit">📜 Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Program Configurator</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : programs.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                <div className="divide-y">
                  {programs.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} · {p.waitingPeriodDays}d waiting · {p.fundSources?.join(', ')}</p>
                      </div>
                      <Badge variant={p.isActive ? 'default' : 'secondary'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Create User Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create New User</CardTitle>
            </CardHeader>
            <CardContent>
              {formSuccess && (
                <div className="mb-4 rounded bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  {formSuccess}
                </div>
              )}
              {formError && (
                <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="form-email">Email *</Label>
                  <Input id="form-email" type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="user@example.com" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-password">Password *</Label>
                  <Input id="form-password" type="password" required minLength={8} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-name">Full Name</Label>
                  <Input id="form-name" type="text" value={formFullName} onChange={e => setFormFullName(e.target.value)} placeholder="Juan Dela Cruz" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-role">Role *</Label>
                  <select
                    id="form-role"
                    required
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-phone">Phone</Label>
                  <Input id="form-phone" type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="09171234567" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-barangay">Assigned Barangay</Label>
                  <Input id="form-barangay" type="text" value={formBarangay} onChange={e => setFormBarangay(e.target.value)} placeholder="Norzagaray" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="form-barangays">Permitted Barangays (comma-separated)</Label>
                  <Input id="form-barangays" type="text" value={formPermittedBarangays} onChange={e => setFormPermittedBarangays(e.target.value)} placeholder="Norzagaray, Angat, San Jose" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={formSubmitting}>
                    {formSubmitting ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* User Management Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">User Management</CardTitle>
              <Input
                type="text"
                aria-label="Search users"
                placeholder="Search users..."
                className="w-64"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Barangay</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                              No users found
                            </TableCell>
                          </TableRow>
                        ) : filteredUsers.map(u => (
                          <TableRow key={u.id}>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.fullName || '—'}</TableCell>
                            <TableCell>
                              <select
                                aria-label="User role"
                                value={u.role}
                                onChange={e => updateUserRole(u, e.target.value)}
                                className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                              >
                                <option value="admin">admin</option>
                                <option value="social_worker">social_worker</option>
                                <option value="coordinator">coordinator</option>
                                <option value="claimant">claimant</option>
                                <option value="mayor">mayor</option>
                                <option value="auditor">auditor</option>
                              </select>
                            </TableCell>
                            <TableCell>{u.assignedBarangay || '—'}</TableCell>
                            <TableCell>
                              <Button
                                variant={u.isActive ? 'default' : 'secondary'}
                                size="sm"
                                onClick={() => toggleUserStatus(u)}
                              >
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id)} aria-label="Delete User">
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync Queue Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : syncEntries.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                <div className="divide-y">
                  {syncEntries.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-mono">{e.tableName}.{e.operation}</p>
                        <p className="text-xs text-muted-foreground">Device: {e.deviceId.slice(0, 8)}…</p>
                        {e.conflictReason && <p className="text-xs text-amber-600">{e.conflictReason}</p>}
                      </div>
                      <Badge variant={
                        e.status === 'applied' ? 'default' :
                        e.status === 'conflict' ? 'destructive' :
                        'secondary'
                      }>{e.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit Log (RA 10173 / COA)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading audit data...</div>
              ) : auditLogsArr.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                auditLogsArr.map((log, idx) => log && (
                  <div key={idx} className="mb-4 rounded bg-muted p-4 text-xs font-mono text-muted-foreground">
                    {log.generatedAt && (
                      <>
                        <p className="mb-2 font-semibold text-foreground">COA Export Report</p>
                        <p>Generated: {new Date(log.generatedAt).toLocaleString()}</p>
                        <p>Period: {log.period?.startDate} – {log.period?.endDate}</p>
                        <p>Total Interventions: {log.summary?.count || 0}</p>
                        <p>Total Amount: ₱{(log.summary?.totalAmount || 0).toLocaleString()}</p>
                        {log.interventions?.slice(0, 10).map((i: any) => (
                          <p key={i.id} className="pl-4">{i.type} · ₱{Number(i.amount || 0).toLocaleString()} · {i.date ? new Date(i.date).toLocaleDateString() : ''}</p>
                        ))}
                      </>
                    )}
                    {log.valid !== undefined && (
                      <>
                        <p className="mt-2 mb-1 font-semibold text-foreground">Hash Chain Verification</p>
                        <p className={log.valid ? 'text-green-600' : 'text-red-600'}>
                          {log.valid ? '✓ Hash chain integrity verified' : '✗ Hash chain broken!'} {log.brokenAt && `at ${log.brokenAt}`}
                        </p>
                      </>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
