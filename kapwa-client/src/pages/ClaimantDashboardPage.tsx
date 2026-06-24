import { useState, useEffect } from 'react';
import { getNotificationPreferences, updateNotificationPreferences } from '../lib/api';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ServiceRecord {
  id: string; type: string; date: string; amount: number; status: string;
}

interface ConsentRecord {
  id: string; purpose: string; channel: string; status: string; grantedAt: string;
}

interface NotificationPreference {
  id?: string;
  userId?: string;
  channel: 'sms' | 'in_app';
  category: string;
  optedIn: boolean;
}

const NOTIF_CATEGORIES = [
  { key: 'case_update', label: 'Case Updates' },
  { key: 'approval', label: 'Approvals' },
  { key: 'disbursement', label: 'Disbursements' },
  { key: 'sync_conflict', label: 'Sync Conflicts' },
  { key: 'system', label: 'System Alerts', locked: true },
];

const NOTIF_CHANNELS = [
  { key: 'sms', label: 'SMS' },
  { key: 'in_app', label: 'In-App' },
];

const DEFAULT_CATEGORIES = ['case_update', 'approval', 'disbursement', 'sync_conflict', 'system'];

export function ClaimantDashboardPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseStatus, setCaseStatus] = useState<string>('');
  const [preferences, setPreferences] = useState<Record<string, Record<string, boolean>>>({});
  const [prefDirty, setPrefDirty] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    fetchPreferences(controller.signal);
    return () => controller.abort();
  }, []);

  async function fetchData(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const [svcRes, conRes] = await Promise.all([
        fetch(`${API_URL}/beneficiaries/me/services`, { signal,
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/beneficiaries/me/consent`, { signal,
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (svcRes.ok) {
        const data = await svcRes.json();
        setServices(data.services || []);
        setCaseStatus(data.caseStatus || 'No active case');
      }
      if (conRes.ok) setConsents(await conRes.json());
    } catch (e) { console.error("ClaimantDashboard:", e); } finally { setLoading(false); }
  }

  async function fetchPreferences(signal?: AbortSignal) {
    try {
      const prefs: NotificationPreference[] = await getNotificationPreferences(signal);
      const map: Record<string, Record<string, boolean>> = {};
      for (const cat of DEFAULT_CATEGORIES) {
        map[cat] = { sms: cat === 'system', in_app: cat === 'system' };
      }
      for (const p of prefs) {
        if (!map[p.category]) map[p.category] = { sms: false, in_app: false };
        map[p.category][p.channel] = p.optedIn;
      }
      setPreferences(map);
    } catch (e) { console.error("Failed to load preferences:", e); }
  }

  async function handleSave() {
    setPrefSaving(true);
    try {
      const updates: { channel: string; category: string; optedIn: boolean }[] = [];
      for (const [category, channels] of Object.entries(preferences)) {
        if (category === 'system') continue;
        for (const [channel, optedIn] of Object.entries(channels)) {
          updates.push({ channel, category, optedIn });
        }
      }
      await Promise.all(updates.map(u => updateNotificationPreferences(u)));
      setPrefSaved(true);
      setPrefDirty(false);
      setTimeout(() => setPrefSaved(false), 3000);
    } catch (e) { console.error("Failed to save preferences:", e); }
    finally { setPrefSaving(false); }
  }

  function togglePref(category: string, channel: string) {
    if (category === 'system') return;
    setPreferences(prev => ({
      ...prev,
      [category]: { ...prev[category], [channel]: !prev[category]?.[channel] },
    }));
    setPrefDirty(true);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-gray-400">Loading dashboard...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A] font-sans">My Dashboard</h2>
        <p className="text-sm text-gray-500">Service history, case status, and consent management</p>
      </div>

      {/* Case Status */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Case Status</p>
            <p className="text-lg font-semibold text-[#2E5C8A]">{caseStatus}</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${
            caseStatus === 'Disbursed' ? 'bg-green-100 text-green-700' :
            caseStatus === 'Approved' ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>{caseStatus}</div>
        </div>
      </div>

      {/* Service History */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-sm text-[#2E5C8A]">Service History</h3>
        </div>
        {services.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No service records yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.type}</p>
                  <p className="text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  {s.amount > 0 && <p className="text-sm font-semibold">₱{s.amount.toLocaleString()}</p>}
                  <span className={`text-xs ${s.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consent Hub */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#2E5C8A]">Consent Management</h3>
          <button className="rounded bg-[#2E5C8A] px-3 py-1 text-xs text-white hover:bg-[#1e3d5e]">Manage Consent</button>
        </div>
        {consents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No consent records</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {consents.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.purpose}</p>
                  <p className="text-xs text-gray-500">Via {c.channel} · {new Date(c.grantedAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">Your data is processed per RA 10173 (Data Privacy Act). You may revoke consent at any time.</p>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#2E5C8A]">Notification Preferences</h3>
          <button
            onClick={handleSave}
            disabled={!prefDirty || prefSaving}
            className={`rounded px-3 py-1 text-xs text-white ${
              prefDirty ? 'bg-[#2E5C8A] hover:bg-[#1e3d5e]' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {prefSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
        {prefSaved && (
          <div className="mx-4 mt-2 rounded bg-green-50 px-3 py-2 text-xs text-green-700">
            Preferences saved
          </div>
        )}
        <div className="p-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs">
            <div className="font-medium text-gray-500">Category</div>
            {NOTIF_CHANNELS.map(ch => (
              <div key={ch.key} className="text-center font-medium text-gray-500">{ch.label}</div>
            ))}
            {NOTIF_CATEGORIES.map(cat => (
              <div key={cat.key} className={`contents ${cat.locked ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 py-1">
                  {cat.locked && <span className="text-gray-400">🔒</span>}
                  <span className="text-sm">{cat.label}</span>
                  {cat.locked && <span className="text-xs text-gray-400">(always active)</span>}
                </div>
                {NOTIF_CHANNELS.map(ch => (
                  <div key={ch.key} className="flex justify-center py-1">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={preferences[cat.key]?.[ch.key] ?? cat.locked}
                        disabled={cat.locked}
                        onChange={() => togglePref(cat.key, ch.key)}
                        className="peer sr-only"
                      />
                      <div className={`h-5 w-9 rounded-full transition-colors ${
                        cat.locked
                          ? 'bg-[#2E5C8A] cursor-not-allowed'
                          : (preferences[cat.key]?.[ch.key]
                              ? 'bg-[#2E5C8A]'
                              : 'bg-gray-300 peer-hover:bg-gray-400')
                      }`}>
                        <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          (preferences[cat.key]?.[ch.key] ?? cat.locked) ? 'translate-x-[18px]' : 'translate-x-[2px]'
                        }`} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
