import React, { useState, useEffect } from 'react';
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

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'programs' | 'users' | 'sync' | 'audit'>('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [syncEntries, setSyncEntries] = useState<SyncEntry[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'programs') fetchPrograms();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'sync') fetchSyncEntries();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  async function fetchPrograms() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/programs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPrograms(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json().then(d => d.data || d));
    } catch {} finally { setLoading(false); }
  }

  async function fetchSyncEntries() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/sync/conflicts/admin`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSyncEntries(await res.json());
    } catch {} finally { setLoading(false); }
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
    } catch {} finally { setLoading(false); }
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
    } catch {}
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
    } catch {}
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchUsers();
    } catch {}
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
        <h2 className="text-xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Panel</h2>
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
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[#2E5C8A]">User Management</h3>
            <input type="text" placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm w-64" />
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
                        <select value={u.role} onChange={e => updateUserRole(u, e.target.value)} className="rounded border border-gray-200 px-2 py-0.5 text-xs">
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
                        <button onClick={() => deleteUser(u.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No users found</div>}
            </div>
          )}
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
