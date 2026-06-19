import { useState, useEffect } from 'react';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  const [activeTab, setActiveTab] = useState<'programs' | 'users' | 'sync' | 'audit'>('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [syncEntries, setSyncEntries] = useState<SyncEntry[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

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

  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'programs') fetchPrograms();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'sync') fetchSyncEntries();
    if (activeTab === 'audit') fetchAuditLogs();
      return () => controller.abort();
  }, [activeTab]);

  async function fetchPrograms() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/programs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPrograms(await res.json());
    } catch (e) { console.error("AdminPage:", e); } finally { setLoading(false); }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json().then(d => d.data || d));
    } catch (e) { console.error("AdminPage:", e); } finally { setLoading(false); }
  }

  async function fetchSyncEntries() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/sync/conflicts/admin`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSyncEntries(await res.json());
    } catch (e) { console.error("AdminPage:", e); } finally { setLoading(false); }
  }

  async function fetchAuditLogs() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const [coaRes, hashRes] = await Promise.all([
        fetch(`${API_URL}/audit/coa-export?startDate=2026-01-01&endDate=2026-12-31`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/audit/hash-chain`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const coa = coaRes.ok ? await coaRes.json() : null;
      const hash = hashRes.ok ? await hashRes.json() : null;
      setAuditLogs([coa, hash].filter(Boolean));
    } catch (e) { console.error("AdminPage:", e); } finally { setLoading(false); }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormSuccess('');
    setFormError('');
    try {
      const token = localStorage.getItem('kapwa_token');
      const body: Record<string, any> = {
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
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to create user: ${res.status}`);
      }
      const data = await res.json();
      setFormSuccess(`User ${data.user?.email || formEmail} created successfully`);
      setFormEmail('');
      setFormPassword('');
      setFormFullName('');
      setFormRole('social_worker');
      setFormPhone('');
      setFormBarangay('');
      setFormPermittedBarangays('');
      fetchUsers();
    } catch (e: any) {
      setFormError(e.message || 'Failed to create user');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function toggleUserStatus(user: AppUser) {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      fetchUsers();
    } catch (e) { console.error("AdminPage:", e); }
  }

  async function updateUserRole(user: AppUser, role: string) {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      fetchUsers();
    } catch (e) { console.error("AdminPage:", e); }
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchUsers();
    } catch (e) { console.error("AdminPage:", e); }
  }

  const tabs = [
    { key: 'programs' as const, label: 'Programs', icon: '📋' },
    { key: 'users' as const, label: 'Users', icon: '👥' },
    { key: 'sync' as const, label: 'Sync Queue', icon: '🔄' },
    { key: 'audit' as const, label: 'Audit Log', icon: '📜' },
  ];

  const filteredUsers = users.filter(u => !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) || (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A] font-sans">Admin Panel</h2>
        <p className="text-sm text-gray-500">System configuration, users, and monitoring</p>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-[#2E5C8A] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'programs' && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[#2E5C8A]">Program Configurator</h3>
          </div>
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="divide-y divide-gray-100">
              {programs.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category} · {p.waitingPeriodDays}d waiting · {p.fundSources?.join(', ')}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {programs.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No programs configured</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Create User Form */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-sm text-[#2E5C8A]">Create New User</h3>
            </div>
            <div className="p-4">
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input type="password" required minLength={8} value={formPassword} onChange={e => setFormPassword(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input type="text" value={formFullName} onChange={e => setFormFullName(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="Juan Dela Cruz" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                  <select required value={formRole} onChange={e => setFormRole(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="09171234567" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Barangay</label>
                  <input type="text" value={formBarangay} onChange={e => setFormBarangay(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="Norzagaray" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Permitted Barangays (comma-separated)</label>
                  <input type="text" value={formPermittedBarangays} onChange={e => setFormPermittedBarangays(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none" placeholder="Norzagaray, Angat, San Jose" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" disabled={formSubmitting}
                    className="rounded bg-[#2E5C8A] px-6 py-2 text-sm font-medium text-white hover:bg-[#1D4A78] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {formSubmitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* User Management Table */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#2E5C8A]">User Management</h3>
              <input type="text" aria-label="Search users" placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm w-64" />
            </div>
            {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Role</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Barangay</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5">{u.email}</td>
                        <td className="px-4 py-2.5">{u.fullName || '—'}</td>
                        <td className="px-4 py-2.5">
                          <select aria-label="User role" value={u.role} onChange={e => updateUserRole(u, e.target.value)} className="rounded border border-gray-200 px-2 py-0.5 text-xs">
                            <option value="admin">admin</option>
                            <option value="social_worker">social_worker</option>
                            <option value="coordinator">coordinator</option>
                            <option value="claimant">claimant</option>
                            <option value="mayor">mayor</option>
                            <option value="auditor">auditor</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">{u.assignedBarangay || '—'}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => toggleUserStatus(u)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => deleteUser(u.id)} className="text-xs text-red-500 hover:text-red-700" aria-label="Delete User">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No users found</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-sm text-[#2E5C8A]">Sync Queue Monitor</h3>
          </div>
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="divide-y divide-gray-100">
              {syncEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No pending sync entries</div>
              ) : syncEntries.map(e => (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono">{e.tableName}.{e.operation}</p>
                    <p className="text-xs text-gray-400">Device: {e.deviceId.slice(0, 8)}…</p>
                    {e.conflictReason && <p className="text-xs text-amber-600">{e.conflictReason}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === 'applied' ? 'bg-green-100 text-green-700' :
                    e.status === 'conflict' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-sm text-[#2E5C8A]">Audit Log (RA 10173 / COA)</h3>
          {loading ? <div className="p-4 text-center text-gray-400 text-sm">Loading audit data...</div> : (
            <>
              {auditLogs.map((log, idx) => log && (
                <div key={idx} className="mb-4 rounded bg-gray-50 p-4 text-xs font-mono text-gray-600">
                  {log.generatedAt && (
                    <>
                      <p className="mb-2 font-semibold text-gray-800">COA Export Report</p>
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
                      <p className="mt-2 mb-1 font-semibold text-gray-800">Hash Chain Verification</p>
                      <p className={log.valid ? 'text-green-600' : 'text-red-600'}>
                        {log.valid ? '✓ Hash chain integrity verified' : '✗ Hash chain broken!'} {log.brokenAt && `at ${log.brokenAt}`}
                      </p>
                    </>
                  )}
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-sm text-gray-400">No audit data available</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
