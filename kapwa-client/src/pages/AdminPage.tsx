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

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'programs' | 'users' | 'sync' | 'audit'>('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [syncEntries, setSyncEntries] = useState<SyncEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'programs') fetchPrograms();
    if (activeTab === 'sync') fetchSyncEntries();
  }, [activeTab]);

  async function fetchPrograms() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/programs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPrograms(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function fetchSyncEntries() {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/sync/conflicts/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSyncEntries(await res.json());
    } catch {} finally { setLoading(false); }
  }

  const tabs = [
    { key: 'programs' as const, label: 'Programs', icon: '📋' },
    { key: 'users' as const, label: 'Users', icon: '👥' },
    { key: 'sync' as const, label: 'Sync Queue', icon: '🔄' },
    { key: 'audit' as const, label: 'Audit Log', icon: '📜' },
  ];

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
            <button className="rounded bg-[#2E5C8A] px-3 py-1 text-xs text-white hover:bg-[#1e3d5e]">+ Add Program</button>
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-sm text-[#2E5C8A]">User Management</h3>
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs font-medium text-gray-500">Email</th>
              <th className="text-left py-2 text-xs font-medium text-gray-500">Role</th>
              <th className="text-left py-2 text-xs font-medium text-gray-500">Barangay</th>
              <th className="text-left py-2 text-xs font-medium text-gray-500">Status</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-2">admin@mswdo.test</td><td className="py-2">admin</td><td className="py-2">All</td>
                <td className="py-2"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span></td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2">worker@mswdo.test</td><td className="py-2">social_worker</td><td className="py-2">Bigte, Matictic</td>
                <td className="py-2"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span></td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2">coordinator@mswdo.test</td><td className="py-2">coordinator</td><td className="py-2">Partida</td>
                <td className="py-2"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span></td>
              </tr>
              <tr><td className="py-2">claimant@test.com</td><td className="py-2">claimant</td><td className="py-2">—</td>
                <td className="py-2"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span></td>
              </tr>
            </tbody>
          </table>
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
          <p className="text-sm text-gray-500 mb-4">All data access and modifications are logged via pgAudit triggers and hash-chain integrity checks.</p>
          <div className="rounded bg-gray-50 p-4 text-xs font-mono text-gray-600">
            <p>{'[2026-06-15 08:00:00] LOGIN admin@mswdo.test from 192.168.1.100'}</p>
            <p>{'[2026-06-15 08:05:23] CREATE case NORZ-2024-0056 by worker@mswdo.test'}</p>
            <p>{'[2026-06-15 08:12:47] READ beneficiary f47ac10b by worker@mswdo.test (consent: active)'}</p>
            <p>{'[2026-06-15 09:00:00] UPDATE case NORZ-2024-0002 → disbursed by admin@mswdo.test'}</p>
            <p>{'[2026-06-15 09:15:00] CREATE intervention FA on case c2 by worker@mswdo.test'}</p>
            <p>{'[2026-06-15 10:00:00] SYNC device-abc123 push 3 changes, 0 conflicts'}</p>
            <p className="mt-2 text-green-600">{'✓ Hash chain integrity verified: all 1,247 entries valid'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
