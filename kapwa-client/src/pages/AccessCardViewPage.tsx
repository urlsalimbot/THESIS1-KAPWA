import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, User, MapPin, Calendar, Phone, Users, Plus } from 'lucide-react';

interface AccessCardService {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
  category?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  case_service: 'Case Service',
  referral: 'Referral',
  community_service: 'Community Service',
  seminar: 'Seminar',
};

const CATEGORY_TABS = ['', 'case_service', 'referral', 'community_service', 'seminar'];
const CATEGORY_TAB_LABELS: Record<string, string> = {
  '': 'All',
  case_service: 'Case Services',
  referral: 'Referrals',
  community_service: 'Community',
  seminar: 'Seminars',
};

function CategoryBadge({ category }: { category?: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    case_service: 'default',
    referral: 'secondary',
    community_service: 'outline',
    seminar: 'secondary',
  };
  return (
    <Badge variant={variants[category || ''] || 'outline'} className="text-[10px]">
      {CATEGORY_LABELS[category || ''] || category || 'Unknown'}
    </Badge>
  );
}

export function AccessCardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ serviceRendered: '', serviceDate: '', cost: '', agency: '', workerNameSign: '', category: 'referral' });
  const [adding, setAdding] = useState(false);

  const { data: ben } = useSWR<Record<string, unknown>>(
    id ? queryKeys.beneficiaries.detail(id) : null,
  );
  const { data: famGraph } = useSWR<{ members?: Array<{ fullName: string; relationship: string; age: number }> }>(
    id ? queryKeys.beneficiaries.familyGraph(id) : null,
  );
  const { data: cardData, mutate: cardMutate } = useSWR<{ beneficiary: any; code: string; services: AccessCardService[] }>(
    id ? queryKeys.accessCards.detail(id) : null,
  );

  const filteredServices = (cardData?.services || []).filter(
    s => !activeTab || s.category === activeTab,
  );

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!cardData?.code) return;
    setAdding(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: cardData.code,
        serviceRendered: addForm.serviceRendered,
        serviceDate: addForm.serviceDate,
        cost: addForm.cost ? parseFloat(addForm.cost) : undefined,
        agency: addForm.agency || undefined,
        workerNameSign: addForm.workerNameSign || undefined,
        category: addForm.category,
      });
      await cardMutate();
      setShowAddForm(false);
      setAddForm({ serviceRendered: '', serviceDate: '', cost: '', agency: '', workerNameSign: '', category: 'referral' });
    } catch (err) {
      console.error('Failed to add entry:', err);
    } finally {
      setAdding(false);
    }
  }

  const loading = !ben && id;

  if (loading) {
    return (
      <PageShell title="Access Card" description="Loading..." backTo={{ label: 'Back', onClick: () => navigate(-1) }}>
        <CardGridSkeleton />
      </PageShell>
    );
  }

  if (!cardData) {
    return (
      <PageShell title="Access Card" description="" backTo={{ label: 'Back', onClick: () => navigate(-1) }}>
        <EmptyState variant="no-data" />
      </PageShell>
    );
  }

  const benInfo = cardData.beneficiary || {};
  const fullName = ben
    ? `${ben.firstName || ''} ${ben.middleName || ''} ${ben.surname || ''}`.replace(/\s+/g, ' ').trim()
    : `${benInfo.first_name || ''} ${benInfo.surname || ''}`.trim();

  return (
    <PageShell
      title="Access Card"
      description={`Service record for ${fullName}`}
      backTo={{ label: 'Back', onClick: () => navigate(-1) }}
    >
      <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {fullName ? fullName.charAt(0) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-foreground truncate">{fullName}</h2>
                <p className="font-mono text-sm text-primary">{cardData.code}</p>
              </div>
              <Badge variant="default" className="text-[10px]">{cardData.services.length} total</Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User size={13} /> {benInfo.gender || ben?.gender || '—'}</span>
              <span className="flex items-center gap-1"><MapPin size={13} /> {benInfo.barangay || ben?.address || '—'}</span>
              {ben?.phone ? <span className="flex items-center gap-1"><Phone size={13} /> {String(ben.phone)}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {famGraph?.members && famGraph.members.length > 0 && (
        <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Users size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Family Members ({famGraph.members.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {famGraph.members.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {m.fullName}
                <span className="ml-1 text-muted-foreground">({m.relationship}, {m.age})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-card shadow-sm border border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Service Records</h3>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus size={14} className="mr-1" /> Add Entry
          </Button>
        </div>

        <div className="px-4 pb-2 flex gap-1 overflow-x-auto">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {CATEGORY_TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {showAddForm && (
          <form onSubmit={handleAddEntry} className="mx-4 mb-3 p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Category *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="referral">Referral</option>
                  <option value="community_service">Community Service</option>
                  <option value="seminar">Seminar</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Service Date *</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={addForm.serviceDate}
                  onChange={e => setAddForm(f => ({ ...f, serviceDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Service Rendered *</label>
              <input
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={addForm.serviceRendered}
                onChange={e => setAddForm(f => ({ ...f, serviceRendered: e.target.value }))}
                placeholder="e.g., Medical Referral to Norzagaray RHU"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Cost (₱)</label>
                <input type="number" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.cost} onChange={e => setAddForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Agency</label>
                <input className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.agency} onChange={e => setAddForm(f => ({ ...f, agency: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Worker Name</label>
                <input className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.workerNameSign} onChange={e => setAddForm(f => ({ ...f, workerNameSign: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={adding}>{adding ? 'Saving...' : 'Save Entry'}</Button>
              <Button variant="outline" size="sm" type="button" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="px-4 pb-4">
          {filteredServices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No records found</p>
          ) : (
            <div className="space-y-1">
              {filteredServices.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <CategoryBadge category={s.category} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.serviceRendered}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.serviceDate).toLocaleDateString()}
                      {s.agency && ` · ${s.agency}`}
                      {s.workerNameSign && ` · ${s.workerNameSign}`}
                    </p>
                  </div>
                  {s.cost != null && Number(s.cost) > 0 && (
                    <span className="text-xs font-semibold shrink-0">₱{Number(s.cost).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
