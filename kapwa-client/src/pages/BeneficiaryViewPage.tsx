import { useState, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import {
  ArrowLeft, User, MapPin, Users as UsersIcon, Gift, FileText, Plus,
  ChevronDown, ChevronRight, Shield, ClipboardList
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadSignature, uploadReceipt, dataURItoBlob } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { FamilyGraph } from '../components/family/FamilyGraph';
import { ConsentManager } from '../components/consent/ConsentManager';
import SignaturePad from '../components/forms/SignaturePad';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  category: string;
  householdSize: number;
  status: string;
  accessCardCode?: string;
  cases: { id: string; program: string; status: string; date: string; amount?: string }[];
  interventions: { id: string; type: string; description: string; date: string; fundSource?: string }[];
}

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  occupation?: string;
  income?: number;
  status?: string;
  isPrimary: boolean;
}

interface TrackerEntry {
  id: string;
  trackerId?: string;
  dailySeqNum: number;
  interventionRemarks?: string;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  approved: 'default',
  disbursed: 'secondary',
  pending_assessment: 'outline',
  active: 'default',
  closed: 'outline',
};

const statusBadgeLabel: Record<string, string> = {
  approved: 'Approved',
  disbursed: 'Disbursed',
  pending_assessment: 'Pending',
  active: 'Active',
  closed: 'Closed',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusBadgeVariant[status] || 'outline'}>
      {statusBadgeLabel[status] || status}
    </Badge>
  );
}

export function BeneficiaryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { mutate: globalMutate } = useSWRConfig();

  const { data: ben } = useSWR<Record<string, unknown>>(
    id ? queryKeys.beneficiaries.detail(id) : null,
  );
  const { data: cases = [] } = useSWR<Array<Record<string, unknown>>>(queryKeys.cases.list());
  const { data: famGraph } = useSWR<{ totalCount?: number; members?: FamilyMember[] }>(
    id ? queryKeys.beneficiaries.familyGraph(id) : null,
  );
  const { data: trackerEntries = [], isLoading: trackerLoading } = useSWR<TrackerEntry[]>(
    id ? queryKeys.tracker.list() : null,
  );

  const loading = !ben && id;
  const [familyExpanded, setFamilyExpanded] = useState(false);
  const [interventionCaseId, setInterventionCaseId] = useState<string | null>(null);
  const [intForm, setIntForm] = useState({ type: 'FA', amount: '', fundSource: 'Regular' });
  const [intSigDataUrl, setIntSigDataUrl] = useState<string | null>(null);
  const [intReceiptFile, setIntReceiptFile] = useState<File | null>(null);
  const [intSubmitting, setIntSubmitting] = useState(false);
  const [intError, setIntError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [beneficiary, setBeneficiary] = useState<BeneficiaryDetail | null>(null);

  // Sync SWR fetches into a derived beneficiary shape (same as legacy code).
  useEffect(() => {
    if (!id) return;
    if (ben) {
      const b = ben as Record<string, unknown>;
      const age = b.dob ? (() => { const today = new Date(); const birth = new Date(b.dob as string); let a = today.getFullYear() - birth.getFullYear(); if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a; })() : 0;
      const addrParts = ((b.address as string) || '').split(',').map((s: string) => s.trim());
      const beneficiaryCases = (cases as Array<Record<string, unknown>>).filter(
        (c) => c.beneficiaryId === id || ((c.beneficiary as Record<string, unknown>)?.id as string) === id,
      );
      setBeneficiary({
        id: b.id as string,
        name: `${b.firstName || ''} ${b.middleName || ''} ${b.surname || ''}`.replace(/\s+/g, ' ').trim(),
        age,
        birthDate: (b.dob as string) || '',
        gender: (b.gender as string) || '',
        contact: (b.phone as string) || '',
        barangay: addrParts[addrParts.length - 1] || '',
        purok: addrParts.length > 1 ? addrParts[0] : '',
        category: (b.category as string) || '',
        householdSize: famGraph?.totalCount || 1,
        status: (b.consentStatus as string) || 'active',
        accessCardCode: (b.accessCardCode as string) || undefined,
        cases: beneficiaryCases.map((c: Record<string, unknown>) => {
          const sr = c.serviceRequested;
          return {
            id: (c.controlNo || c.id) as string,
            program: Array.isArray(sr) ? sr.join(', ') : 'General',
            status: (c.status as string) || 'pending',
            date: c.createdAt ? new Date(c.createdAt as string).toLocaleDateString() : '',
          };
        }),
        interventions: [],
      });
    }
    if (famGraph?.members) setFamily(famGraph.members);
  }, [ben, cases, famGraph, id]);

  useEffect(() => {
    if (assignSuccess) {
      const t = setTimeout(() => setAssignSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [assignSuccess]);

  async function handleLogIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!interventionCaseId) return;
    setIntError('');
    setIntSubmitting(true);
    try {
      let workerSignatureUrl = '';
      let receiptUrl = '';

      if (intSigDataUrl) {
        const blob = dataURItoBlob(intSigDataUrl);
        workerSignatureUrl = await uploadSignature(blob, `sig-${Date.now()}.png`);
      }

      if (intReceiptFile) {
        receiptUrl = await uploadReceipt(intReceiptFile, intReceiptFile.name);
      }

      await api.post('/interventions', {
        caseId: interventionCaseId,
        interventionType: intForm.type,
        amount: parseFloat(intForm.amount) || 0,
        fundSource: intForm.fundSource,
        workerSignatureUrl: workerSignatureUrl || undefined,
        clientReceiptUrl: receiptUrl || undefined,
      } as Record<string, unknown>);

      setInterventionCaseId(null);
      setIntForm({ type: 'FA', amount: '', fundSource: 'Regular' });
      setIntSigDataUrl(null);
      setIntReceiptFile(null);
    } catch (err: any) {
      setIntError(err.message || 'Failed to log intervention');
    }
    setIntSubmitting(false);
  }

  async function handleAssignCard() {
    if (!id) return;
    setAssigning(true);
    try {
      const result = await api.post<{ accessCardCode: string }>(`/access-cards/assign/${id}`);
      setBeneficiary(prev => prev ? { ...prev, accessCardCode: result.accessCardCode } : prev);
      setAssignSuccess(`Access Card assigned: ${result.accessCardCode}`);
    } catch (err: any) {
      setAssignSuccess('');
    }
    setAssigning(false);
  }

  function handleReprint() {
    if (!beneficiary) return;
    const confirmed = window.confirm(
      `Reprint Access Card — Reprint card for ${beneficiary.name}? ` +
      `Current code: ${beneficiary.accessCardCode} will remain valid. ` +
      `Verify claimant identity before proceeding.`
    );
    if (!confirmed) return;
    navigate(`/beneficiary/${id}/card/print`);
  }

  if (loading) {
    return (
      <PageShell title="Beneficiary Details" description="Viewing beneficiary information and case records.">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  if (!beneficiary) {
    return (
      <PageShell title="Beneficiary Details" description="">
        <EmptyState variant="no-data" />
      </PageShell>
    );
  }

  function handleConsentChange(newStatus: string) {
    setBeneficiary(prev => prev ? { ...prev, status: newStatus } : prev);
  }

  return (
    <PageShell
      title="Beneficiary Details"
      description={`Viewing information for ${beneficiary.name}`}
    >
      {/* Back button (no-print) */}
      <button onClick={() => navigate(-1)} className="no-print flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft size={16} /> Back
      </button>

      {assignSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm font-medium text-green-700">
          {assignSuccess}
        </div>
      )}

      {/* Profile Card */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {beneficiary.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{beneficiary.name}</h2>
              <p className="text-sm text-muted-foreground">ID: {beneficiary.id}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><User size={14} /> {beneficiary.gender}, {beneficiary.age} yrs old</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {beneficiary.barangay}{beneficiary.purok ? `, ${beneficiary.purok}` : ''}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={beneficiary.status} />
        </div>
      </div>

      {/* Access Card Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
        <div className="mb-3 flex items-center gap-2 text-primary"><Shield size={20} /> <h3 className="text-sm font-semibold">Access Card</h3></div>
        {beneficiary.accessCardCode ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Card Code</p>
              <p className="font-mono text-sm font-medium text-primary">
                {beneficiary.accessCardCode}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/beneficiary/${id}/card/print`)}
              >
                Print Card
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReprint}
              >
                Reprint Card
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleAssignCard} disabled={assigning} className="w-full">
            {assigning ? 'Assigning...' : 'Generate & Assign Access Card'}
          </Button>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
          <div className="mb-3 flex items-center gap-2 text-primary"><UsersIcon size={20} /> <h3 className="text-sm font-semibold">Personal Info</h3></div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Birth Date</span><span>{beneficiary.birthDate}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{beneficiary.contact || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{beneficiary.category || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Household</span><span>{beneficiary.householdSize} members</span></div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary"><FileText size={20} /> <h3 className="text-sm font-semibold">Active Cases</h3></div>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Add case"><Plus size={16} /></Button>
          </div>
          {beneficiary.cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active cases</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.cases.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded bg-muted p-2 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{c.program}</p>
                    <p className="text-xs text-muted-foreground">{c.id} · {c.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {c.status === 'disbursed' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setInterventionCaseId(c.id === interventionCaseId ? null : c.id)}
                        title="Log Intervention"
                      >
                        <ClipboardList size={12} className="inline mr-1" />
                        Log
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
          <div className="mb-3 flex items-center gap-2 text-primary"><Gift size={20} /> <h3 className="text-sm font-semibold">Interventions</h3></div>
          {beneficiary.interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interventions recorded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficiary.interventions.map(intv => (
                <div key={intv.id} className="rounded bg-muted p-2 text-sm">
                  <p className="font-medium text-foreground">{intv.type}</p>
                  <p className="text-xs text-muted-foreground">{intv.description}</p>
                  {intv.fundSource && <p className="text-xs font-medium text-primary">Fund: {intv.fundSource}</p>}
                  <p className="text-xs text-muted-foreground">{intv.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Case Tracker Log Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <FileText size={20} />
          <h3 className="text-sm font-semibold">Case Tracker Log</h3>
        </div>
        {trackerEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracker entries</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trackerEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between rounded bg-muted p-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">{entry.trackerId}</p>
                  <p className="text-xs text-muted-foreground">{entry.interventionRemarks}</p>
                </div>
                <span className="text-xs text-muted-foreground">#{entry.dailySeqNum}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intervention Form (inline, shown when a disbursed case selected) */}
      {interventionCaseId && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <ClipboardList size={20} />
            <h3 className="text-sm font-semibold">Log Intervention for Case {interventionCaseId}</h3>
          </div>
          {intError && <div className="mb-4 rounded bg-destructive/10 p-3 text-sm text-destructive">{intError}</div>}
          <form onSubmit={handleLogIntervention} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Type</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={intForm.type} onChange={e => setIntForm({ ...intForm, type: e.target.value })} aria-label="Intervention Type">
                  <option value="FA">Financial Assistance</option>
                  <option value="C">Counseling</option>
                  <option value="CSR">CSR</option>
                  <option value="R">Referral</option>
                  <option value="H">Healthcare</option>
                  <option value="HV">Home Visit</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Amount (₱)</label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" type="number" min="0" step="0.01" value={intForm.amount} onChange={e => setIntForm({ ...intForm, amount: e.target.value })} aria-label="Amount" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Fund Source</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={intForm.fundSource} onChange={e => setIntForm({ ...intForm, fundSource: e.target.value })} aria-label="Fund Source">
                <option value="Regular">Regular</option>
                <option value="PDAF">PDAF</option>
                <option value="Legislative">Legislative</option>
                <option value="Donation">Donation</option>
              </select>
            </div>
            <SignaturePad
              onSave={(dataUrl: string) => setIntSigDataUrl(dataUrl)}
              label="Worker Signature"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Client Receipt (optional photo)</label>
              <input
                type="file"
                accept="image/*"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onChange={e => setIntReceiptFile(e.target.files?.[0] || null)}
                aria-label="Client Receipt"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={intSubmitting}>
                {intSubmitting ? 'Saving...' : 'Submit Intervention'}
              </Button>
              <Button variant="outline" type="button" onClick={() => { setInterventionCaseId(null); setIntError(''); setIntSigDataUrl(null); setIntReceiptFile(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {family.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
          <button onClick={() => setFamilyExpanded(!familyExpanded)} className="flex items-center gap-2 text-primary mb-3">
            {familyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <UsersIcon size={20} />
            <h3 className="text-sm font-semibold">Family Composition ({family.length})</h3>
          </button>
          {familyExpanded && (
            <div className="space-y-1">
              {family.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {m.fullName.charAt(0)}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{m.fullName} {m.isPrimary && <span className="text-xs text-primary">(Primary)</span>}</p>
                      <p className="text-xs text-muted-foreground">{m.relationship} · {m.age} yrs{m.occupation ? ` · ${m.occupation}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status && <span className="text-xs text-muted-foreground">{m.status}</span>}
                    {m.income != null && (
                      <span className="text-xs font-medium">₱{Number(m.income).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Family Graph Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <UsersIcon size={20} />
          <h3 className="text-sm font-semibold">Family Tree</h3>
        </div>
        {id && <FamilyGraph beneficiaryId={id} />}
      </div>

      {/* Consent Management Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-border">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Shield size={20} />
          <h3 className="text-sm font-semibold">Consent & Privacy</h3>
        </div>
        {id && beneficiary && (
          <ConsentManager
            beneficiaryId={id}
            currentConsentStatus={beneficiary.status}
            onConsentChange={handleConsentChange}
          />
        )}
      </div>
    </PageShell>
  );
}
