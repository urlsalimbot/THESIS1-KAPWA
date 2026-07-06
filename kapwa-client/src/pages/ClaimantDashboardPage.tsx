import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Link } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
  const { data: servicesData } = useSWR<{ services?: ServiceRecord[]; caseStatus?: string }>(
    queryKeys.beneficiaries.myServices(),
  );
  const { data: consents = [] } = useSWR<ConsentRecord[]>(queryKeys.beneficiaries.myConsent());
  const { data: prefs } = useSWR<NotificationPreference[]>('/notifications/preferences');
  const loading = !servicesData && !consents.length;

  const services = servicesData?.services || [];
  const caseStatus = servicesData?.caseStatus || 'No active case';
  const lastSync = servicesData ? Date.now() : null;

  const [preferences, setPreferences] = useState<Record<string, Record<string, boolean>>>(() => {
    const map: Record<string, Record<string, boolean>> = {};
    for (const cat of DEFAULT_CATEGORIES) {
      map[cat] = { sms: cat === 'system', in_app: cat === 'system' };
    }
    for (const p of prefs || []) {
      if (!map[p.category]) map[p.category] = { sms: false, in_app: false };
      map[p.category][p.channel] = p.optedIn;
    }
    return map;
  });
  const [prefDirty, setPrefDirty] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);

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
      await Promise.all(updates.map(u => api.put('/notifications/preferences', u)));
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

  if (loading) {
    return (
      <PageShell title="My Dashboard" description="Your case and assistance overview">
        <CardGridSkeleton count={4} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="My Dashboard"
      description="Service history, case status, and consent management"
      cachedAt={lastSync ?? undefined}
    >
      {/* Access Card Link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Access Card</p>
            <p className="text-sm font-medium text-primary">View your KAPWA Access Card</p>
          </div>
          <Link to="/my-access-card">
            <Button variant="default" size="sm">View Card</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Case Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Case Status</p>
              <p className="text-lg font-semibold text-primary">{caseStatus}</p>
            </div>
            <Badge variant={
              caseStatus === 'Disbursed' ? 'default' :
              caseStatus === 'Approved' ? 'secondary' :
              'outline'
            }>{caseStatus}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Service History */}
      <Card>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">Service History</h3>
        </div>
        {services.length === 0 ? (
          <CardContent>
            <EmptyState variant="no-data" />
          </CardContent>
        ) : (
          <div className="divide-y">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  {s.amount > 0 && <p className="text-sm font-semibold">₱{s.amount.toLocaleString()}</p>}
                  <span className={`text-xs ${s.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Consent Hub */}
      <Card>
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-primary">Consent Management</h3>
          <Button variant="default" size="sm">Manage Consent</Button>
        </div>
        {consents.length === 0 ? (
          <CardContent>
            <EmptyState variant="no-data" />
          </CardContent>
        ) : (
          <div className="divide-y">
            {consents.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.purpose}</p>
                  <p className="text-xs text-muted-foreground">Via {c.channel} · {new Date(c.grantedAt).toLocaleDateString()}</p>
                </div>
                <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
              </div>
            ))}
          </div>
        )}
        <div className="border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">Your data is processed per RA 10173 (Data Privacy Act). You may revoke consent at any time.</p>
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-primary">Notification Preferences</h3>
          <Button
            onClick={handleSave}
            disabled={!prefDirty || prefSaving}
            variant={prefDirty ? 'default' : 'outline'}
            size="sm"
          >
            {prefSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
        {prefSaved && (
          <div className="mx-4 mt-2 rounded bg-green-50 px-3 py-2 text-xs text-green-700">
            Preferences saved
          </div>
        )}
        <div className="p-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs">
            <div className="font-medium text-muted-foreground">Category</div>
            {NOTIF_CHANNELS.map(ch => (
              <div key={ch.key} className="text-center font-medium text-muted-foreground">{ch.label}</div>
            ))}
            {NOTIF_CATEGORIES.map(cat => (
              <div key={cat.key} className={`contents ${cat.locked ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 py-1">
                  {cat.locked && <span className="text-muted-foreground">🔒</span>}
                  <span className="text-sm">{cat.label}</span>
                  {cat.locked && <span className="text-xs text-muted-foreground">(always active)</span>}
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
                          ? 'bg-primary cursor-not-allowed'
                          : (preferences[cat.key]?.[ch.key]
                              ? 'bg-primary'
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
      </Card>
    </PageShell>
  );
}
