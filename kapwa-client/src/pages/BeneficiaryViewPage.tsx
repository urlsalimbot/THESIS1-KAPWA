import { useState, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import {
  ArrowLeft, User, MapPin, Users as UsersIcon, Gift, FileText, Plus,
  ChevronDown, ChevronRight, Shield, ClipboardList, Phone, Calendar, Tag, Home, CreditCard
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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

export function BeneficiaryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { mutate: globalMutate } = useSWRConfig();

  const { data: ben } = useSWR<Record<string, unknown>>(
    id ? queryKeys.beneficiaries.detail(id) : null,
  );
  const { data: cases } = useSWR<Array<Record<string, unknown>>>(queryKeys.cases.list());
  const { data: famGraph, isLoading: famLoading, error: famError } = useSWR<{
    totalCount?: number;
    members?: Array<FamilyMember & { depth: number; statusIncome?: string }>;
    primary?: FamilyMember & { depth: number; statusIncome?: string };
  }>(id ? queryKeys.beneficiaries.familyGraph(id) : null);
  const { data: trackerEntries, isLoading: trackerLoading } = useSWR<TrackerEntry[]>(
    id ? queryKeys.tracker.list() : null,
  );

  const loading = !ben && id;
  const [familyExpanded, setFamilyExpanded] = useState(true);
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

  useEffect(() => {
    if (!id) return;
    if (ben) {
      const b = ben as Record<string, unknown>;
      const age = b.dob ? (() => { const today = new Date(); const birth = new Date(b.dob as string); let a = today.getFullYear() - birth.getFullYear(); if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a; })() : 0;
      const addrParts = ((b.address as string) || '').split(',').map((s: string) => s.trim());
      const beneficiaryCases = (cases || []).filter(
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
      <PageShell title="Beneficiary Details" description="" backTo={{ label: "Back", onClick: () => navigate(-1) }}>
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
      backTo={{ label: "Back", onClick: () => navigate(-1) }}
    >
      {assignSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-700 mb-3">
          {assignSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* --- Left column (2/3) --- */}
        <div className="lg:col-span-2 space-y-4">

          {/* Profile Header */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {beneficiary.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground truncate">{beneficiary.name}</h2>
                    <p className="text-xs text-muted-foreground">ID: {beneficiary.id}</p>
                  </div>
                  <StatusBadge status={beneficiary.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User size={13} /> {beneficiary.gender}, {beneficiary.age} yrs</span>
                  <span className="flex items-center gap-1"><MapPin size={13} /> {beneficiary.barangay}{beneficiary.purok ? `, ${beneficiary.purok}` : ''}</span>
                  <span className="flex items-center gap-1"><Calendar size={13} /> {beneficiary.birthDate}</span>
                  {beneficiary.contact && <span className="flex items-center gap-1"><Phone size={13} /> {beneficiary.contact}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Cases + Interventions + Tracker — 3-column sub-grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Active Cases */}
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <FileText size={16} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Cases</h3>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full h-7 w-7" aria-label="Add case" onClick={() => {
                  if (!ben) return;
                  navigate('/intake', {
                    state: {
                      prefill: {
                        surname: (ben.surname as string) || '',
                        firstName: (ben.firstName as string) || '',
                        middleName: (ben.middleName as string) || '',
                        gender: (ben.gender as string) || '',
                        dob: (ben.dob as string) || '',
                        placeOfBirth: (ben.placeOfBirth as string) || '',
                        civilStatus: (ben.civilStatus as string) || '',
                        cellularNumber: (ben.phone as string) || '',
                        occupation: (ben.occupation as string) || '',
                        estimatedMonthlyIncome: (ben.estimatedMonthlyIncome as number)?.toString() || '',
                        philhealthNumber: (ben.philhealthNumber as string) || '',
                      },
                    },
                  });
                }}><Plus size={14} /></Button>
              </div>
              {beneficiary.cases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active cases</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {beneficiary.cases.map(c => (
                    <div key={c.id} className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-2 text-sm">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-medium text-foreground truncate">{c.program}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        <StatusBadge status={c.status} />
                        {c.status === 'disbursed' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setInterventionCaseId(c.id === interventionCaseId ? null : c.id)}
                          >
                            <ClipboardList size={10} className="mr-1" />
                            Log
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interventions */}
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Gift size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Interventions</h3>
              </div>
              {beneficiary.interventions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interventions recorded</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {beneficiary.interventions.map(intv => (
                    <div key={intv.id} className="rounded bg-muted/50 px-2.5 py-2 text-sm">
                      <p className="font-medium text-foreground">{intv.type}</p>
                      <p className="text-xs text-muted-foreground">{intv.description}</p>
                      {intv.fundSource && <p className="text-xs font-medium text-primary">Fund: {intv.fundSource}</p>}
                      <p className="text-xs text-muted-foreground">{intv.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tracker Log */}
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-2 text-primary mb-3">
                <ClipboardList size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Tracker Log</h3>
              </div>
              {(trackerEntries || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {(trackerEntries || []).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-2 text-sm">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-medium text-foreground truncate">{entry.trackerId || 'Entry'}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.interventionRemarks}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">#{entry.dailySeqNum}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Intervention Form (compact inline) */}
          {interventionCaseId && (
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <ClipboardList size={16} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Log Intervention</h3>
                </div>
                <span className="text-xs text-muted-foreground">Case: {interventionCaseId}</span>
              </div>
              {intError && <div className="mb-3 rounded bg-destructive/10 p-2 text-xs text-destructive">{intError}</div>}
              <form onSubmit={handleLogIntervention} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Type</label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={intForm.type} onChange={e => setIntForm({ ...intForm, type: e.target.value })} aria-label="Intervention Type">
                      <option value="FA">Financial Assistance</option>
                      <option value="C">Counseling</option>
                      <option value="CSR">CSR</option>
                      <option value="R">Referral</option>
                      <option value="H">Healthcare</option>
                      <option value="HV">Home Visit</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Amount (₱)</label>
                    <input className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" type="number" min="0" step="0.01" value={intForm.amount} onChange={e => setIntForm({ ...intForm, amount: e.target.value })} aria-label="Amount" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Fund Source</label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={intForm.fundSource} onChange={e => setIntForm({ ...intForm, fundSource: e.target.value })} aria-label="Fund Source">
                      <option value="Regular">Regular</option>
                      <option value="PDAF">PDAF</option>
                      <option value="Legislative">Legislative</option>
                      <option value="Donation">Donation</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SignaturePad onSave={(dataUrl: string) => setIntSigDataUrl(dataUrl)} label="Worker Signature" />
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Receipt (optional)</label>
                    <input type="file" accept="image/*" className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground" onChange={e => setIntReceiptFile(e.target.files?.[0] || null)} aria-label="Client Receipt" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={intSubmitting}>
                    {intSubmitting ? 'Saving...' : 'Submit Intervention'}
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => { setInterventionCaseId(null); setIntError(''); setIntSigDataUrl(null); setIntReceiptFile(null); }}>Cancel</Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* --- Right column (1/3) - sidebar --- */}
        <div className="space-y-4">

          {/* Personal Info */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <User size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Personal Info</h3>
            </div>
            <div className="space-y-2">
              <InfoRow icon={Calendar} label="Birth Date" value={beneficiary.birthDate || 'N/A'} />
              <InfoRow icon={Phone} label="Contact" value={beneficiary.contact || 'N/A'} />
              <InfoRow icon={Tag} label="Category" value={beneficiary.category || 'N/A'} />
              <InfoRow icon={Home} label="Household" value={`${beneficiary.householdSize} members`} />
            </div>
          </div>

          {/* Access Card */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <CreditCard size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Access Card</h3>
            </div>
            {beneficiary.accessCardCode ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Card Code</p>
                  <p className="font-mono text-sm font-medium text-primary">{beneficiary.accessCardCode}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => navigate(`/beneficiary/${id}/card/print`)}>Print</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleReprint}>Reprint</Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleAssignCard} disabled={assigning} className="w-full" size="sm">
                {assigning ? 'Assigning...' : 'Generate & Assign Card'}
              </Button>
            )}
          </div>

          {/* Family Composition */}
          {family.length > 0 && (
            <div className="rounded-lg bg-card shadow-sm border border-border">
              <button onClick={() => setFamilyExpanded(!familyExpanded)} className="flex items-center gap-2 text-primary w-full px-4 py-3 text-left">
                {familyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <UsersIcon size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Family ({family.length})</span>
              </button>
              {familyExpanded && (
                <div className="px-4 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {family.map((m, i) => {
                    const bgColors = ['bg-muted/40', 'bg-muted/20', 'bg-muted/30'];
                    const dotColors = ['bg-primary', 'bg-accent', 'bg-secondary'];
                    return (
                      <div key={m.id} className={`rounded-lg ${bgColors[i % 3]} px-3 py-2 transition-colors hover:bg-muted/50`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'} text-[10px] font-semibold shadow-sm`}>
                              {m.fullName.charAt(0)}
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColors[i % 3]} ring-1 ring-card`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-foreground truncate">{m.fullName}</p>
                                {m.isPrimary && <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-medium text-primary leading-none">Primary</span>}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span>{m.relationship}</span>
                                <span>&middot;</span>
                                <span>{m.age} yrs</span>
                                {m.occupation && <><span>&middot;</span><span className="truncate">{m.occupation}</span></>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {m.status && (
                              <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground leading-none">{m.status}</span>
                            )}
                            {m.income != null && (
                              <span className="text-[10px] font-semibold text-foreground">₱{Number(m.income).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Family Tree (interactive graph) */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <UsersIcon size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Family Tree</h3>
            </div>
            <FamilyGraph
              loading={famLoading && !famGraph}
              error={famError ? (famError as any)?.message || 'Failed to load family graph' : null}
              members={(famGraph?.members || []) as any}
              primary={(famGraph?.primary || null) as any}
            />
          </div>

          {/* Consent */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <Shield size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Consent & Privacy</h3>
            </div>
            {id && beneficiary && (
              <ConsentManager
                beneficiaryId={id}
                currentConsentStatus={beneficiary.status}
                onConsentChange={handleConsentChange}
              />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
