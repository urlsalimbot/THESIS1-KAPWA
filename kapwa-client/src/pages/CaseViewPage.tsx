import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, User, Users, Clock, AlertTriangle, CheckCircle, Phone, MapPin, Calendar, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import SignaturePad from '../components/forms/SignaturePad';
import {
  NATURE_OF_SERVICE,
  FINANCIAL_SUBSIDIES,
  SOURCE_OF_FUND,
  OTHER_ASSISTANCE,
  CLIENT_CATEGORIES_V2,
} from '../lib/constants';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

function formatMoney(val: string): string {
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return val.replace(/,/g, '');
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending_assessment: 'outline',
  in_review: 'secondary',
  approved: 'default',
  disbursed: 'secondary',
  closed: 'outline',
};

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending Assessment',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age?: number;
  occupation?: string;
  income?: number;
  status?: string;
}

interface Household {
  id: string;
  barangay?: string;
  estimatedIncome?: number;
  primaryBeneficiaryId?: string;
  members: FamilyMember[];
}

interface CaseDetail {
  id: string;
  controlNo: string;
  status: string;
  serviceRequested: string[];
  requirementsChecklist?: Record<string, boolean>;
  certificateUrl?: string;
  pettyCashVoucherUrl?: string;
  approvedBySignature?: string;
  approvedByRole?: string;
  assignedWorkerId?: string;
  problemsPresented?: string;
  socialWorkerAssessment?: string;
  clientCategory?: string;
  natureOfService?: string[];
  financialSubsidies?: Record<string, unknown>;
  amountAssistance?: number;
  modeFinancialAssistance?: string;
  sourceOfFund?: string;
  legislatorSpecify?: string;
  otherAssistance?: Record<string, unknown>;
  interviewedBy?: string;
  clientSignature?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  slaOverdue?: boolean;
  beneficiary?: {
    id: string;
    surname: string;
    firstName: string;
    middleName?: string;
    gender?: string;
    dob?: string;
    address?: string;
    phone?: string;
    philsysNumber?: string;
    accessCardCode?: string;
    category?: string;
    household?: Household;
  };
}

interface CaseHistoryEntry {
  id: string;
  fromStatus?: string;
  toStatus: string;
  changedByRole?: string;
  changedById?: string;
  remarks?: string;
  transitionType: string;
  overrideReason?: string;
  createdAt: string;
}

export function CaseViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: caseData, isLoading } = useSWR<CaseDetail>(
    id ? queryKeys.cases.detail(id) : null,
  );
  const { data: history, isLoading: historyLoading } = useSWR<CaseHistoryEntry[]>(
    id ? queryKeys.cases.detail(`${id}/history`) : null,
  );

  const ben = caseData?.beneficiary;
  const dob = ben?.dob;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
  const ageRange = dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '';

  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [assessment, setAssessment] = useState({
    problemsPresented: caseData?.problemsPresented || '',
    socialWorkerAssessment: caseData?.socialWorkerAssessment || '',
    clientCategory: caseData?.clientCategory || '',
    natureOfService: (caseData?.natureOfService || []) as string[],
    financialSubsidies: (caseData?.financialSubsidies || {}) as Record<string, unknown>,
    amountAssistance: caseData?.amountAssistance !== undefined && caseData?.amountAssistance !== null ? caseData.amountAssistance : '' as string | number,
    modeFinancialAssistance: caseData?.modeFinancialAssistance || '',
    sourceOfFund: caseData?.sourceOfFund || '',
    legislatorSpecify: caseData?.legislatorSpecify || '',
    otherAssistance: (caseData?.otherAssistance || {}) as Record<string, unknown>,
    clientSignature: caseData?.clientSignature || '',
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  useEffect(() => {
    if (caseData) {
      setAssessment({
        problemsPresented: caseData.problemsPresented || '',
        socialWorkerAssessment: caseData.socialWorkerAssessment || '',
        clientCategory: caseData.clientCategory || '',
        natureOfService: (caseData.natureOfService || []) as string[],
        financialSubsidies: (caseData.financialSubsidies || {}) as Record<string, unknown>,
        amountAssistance: caseData.amountAssistance !== undefined && caseData.amountAssistance !== null ? caseData.amountAssistance : '',
        modeFinancialAssistance: caseData.modeFinancialAssistance || '',
        sourceOfFund: caseData.sourceOfFund || '',
        legislatorSpecify: caseData.legislatorSpecify || '',
        otherAssistance: (caseData.otherAssistance || {}) as Record<string, unknown>,
        clientSignature: caseData.clientSignature || '',
      });
    }
  }, [caseData]);

  async function saveAssessment() {
    setSavingAssessment(true);
    try {
      await api.patch(`/cases/${id}/assessment`, {
        ...assessment,
        interviewedBy: user?.fullName || '',
        amountAssistance: typeof assessment.amountAssistance === 'string'
          ? (assessment.amountAssistance === '' ? undefined : parseFloat(assessment.amountAssistance.replace(/,/g, '')))
          : assessment.amountAssistance,
      });
      await mutate(queryKeys.cases.detail(id!));
      setEditingAssessment(false);
    } catch (e) {
      console.error('Failed to save assessment:', e);
    } finally {
      setSavingAssessment(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Loading..." description="">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading case...</div>
      </PageShell>
    );
  }

  if (!caseData) {
    return (
      <PageShell title="Case Not Found" description="">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Case not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/cases')}>Back to Cases</Button>
        </div>
      </PageShell>
    );
  }

  const household = ben?.household;
  const familyMembers = household?.members || [];

  return (
    <PageShell
      title={`Case ${caseData.controlNo}`}
      description={`Beneficiary: ${ben?.firstName || ''} ${ben?.surname || ''}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/cases')}>
          <ArrowLeft size={16} className="mr-1" /> Back to Cases
        </Button>
        {caseData.slaOverdue && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle size={12} /> OVERDUE
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* === LEFT COLUMN (2/3) — Main Case Content === */}
        <div className="lg:col-span-2 space-y-4">

          {/* Case info card */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{caseData.controlNo}</h2>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(caseData.createdAt).toLocaleDateString()} &middot;
                  Updated {new Date(caseData.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={STATUS_BADGES[caseData.status] || 'outline'} className="text-sm px-3 py-1">
                {STATUS_LABELS[caseData.status] || caseData.status}
              </Badge>
            </div>
            <Separator />
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Service Requested</span>
                <p className="font-medium">{(caseData.serviceRequested || []).join(', ') || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned Worker ID</span>
                <p className="font-medium">{caseData.assignedWorkerId || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Certificate URL</span>
                <p className="font-medium truncate">{caseData.certificateUrl || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Petty Cash Voucher</span>
                <p className="font-medium truncate">{caseData.pettyCashVoucherUrl || '—'}</p>
              </div>
              {caseData.approvedByRole && (
                <div>
                  <span className="text-muted-foreground">Approved By</span>
                  <p className="font-medium">{caseData.approvedByRole}</p>
                </div>
              )}
              {caseData.remarks && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Remarks</span>
                  <p className="font-medium">{caseData.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section III: Assessment */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">III. Assessment</h3>
              <Button variant="outline" size="sm" onClick={() => setEditingAssessment(!editingAssessment)}>
                {editingAssessment ? 'Cancel' : caseData?.problemsPresented ? 'Edit' : 'Add Assessment'}
              </Button>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-3">
              {editingAssessment ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">13a. Problem/s Presented *</label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]" required value={assessment.problemsPresented} onChange={e => setAssessment(a => ({ ...a, problemsPresented: e.target.value }))} aria-label="Problems Presented" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">13b. Social Worker's Assessment *</label>
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]" required value={assessment.socialWorkerAssessment} onChange={e => setAssessment(a => ({ ...a, socialWorkerAssessment: e.target.value }))} aria-label="Social Worker Assessment" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">14. Client Category *</label>
                    <div className="mt-1 space-y-1">
                      {CLIENT_CATEGORIES_V2.map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="clientCategory" value={cat} checked={assessment.clientCategory === cat} onChange={e => setAssessment(a => ({ ...a, clientCategory: e.target.value }))} className="text-primary" />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Problem/s Presented</span>
                    <p className="font-medium">{caseData?.problemsPresented || '—'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Social Worker's Assessment</span>
                    <p className="font-medium">{caseData?.socialWorkerAssessment || '—'}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Client Category</span>
                    <p className="font-medium">{caseData?.clientCategory || '—'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section IV: Recommended Services & Assistance */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">IV. Recommended Services & Assistance</h3>
              {!editingAssessment && (
                <Button variant="outline" size="sm" onClick={() => setEditingAssessment(true)}>
                  {caseData?.natureOfService?.length ? 'Edit' : 'Add Services'}
                </Button>
              )}
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-3">
              {editingAssessment ? (
                <>
                  <div>
                    <label className="text-sm font-medium">15. Nature of Service/Assistance *</label>
                    <div className="mt-1 space-y-1">
                      {NATURE_OF_SERVICE.map(n => (
                        <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="natureOfService" value={n} checked={assessment.natureOfService.includes(n)} onChange={() => setAssessment(a => ({ ...a, natureOfService: [n] }))} className="text-primary" />
                          {n}
                        </label>
                      ))}
                    </div>
                  </div>

                  {assessment.natureOfService.includes('Financial Assistance') && (
                    <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                      <p className="text-xs font-medium text-muted-foreground">Sub-options</p>
                      <div className="grid grid-cols-2 gap-2">
                        {FINANCIAL_SUBSIDIES.map(sub => (
                          <label key={sub} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={!!assessment.financialSubsidies[sub]} onChange={() => {
                              const newVal = !assessment.financialSubsidies[sub];
                              const updates: Record<string, unknown> = { financialSubsidies: { ...assessment.financialSubsidies, [sub]: newVal } };
                              if (sub === 'Guarantee Letter' && newVal) {
                                updates.modeFinancialAssistance = '';
                              }
                              setAssessment(a => ({ ...a, ...updates }));
                            }} className="rounded border-input text-primary" />
                            {sub}
                          </label>
                        ))}
                      </div>
                      {Boolean(assessment.financialSubsidies['Medical']) && (
                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground">Medical — Specify</label>
                          <Input value={(assessment.financialSubsidies['medicalSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, financialSubsidies: { ...a.financialSubsidies, medicalSpecify: e.target.value } }))} placeholder="Specify medical need" aria-label="Medical specify" />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">15a. Amount (₱)</label>
                          <Input type="text" inputMode="numeric" value={assessment.amountAssistance} onChange={e => setAssessment(a => ({ ...a, amountAssistance: e.target.value.replace(/,/g, '') }))} onBlur={e => { const formatted = formatMoney(e.target.value); setAssessment(a => ({ ...a, amountAssistance: formatted })); }} aria-label="Amount" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">15b. Mode of Financial Assistance</label>
                          {assessment.financialSubsidies['Guarantee Letter'] ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <input type="checkbox" checked className="rounded border-input text-primary" />
                              Guarantee Letter (Cash/Cheque disabled)
                            </div>
                          ) : (
                            <div className="flex gap-4 mt-1">
                              {['Cash', 'Cheque'].map(m => (
                                <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="radio" name="modeFinancialAssistance" value={m} checked={assessment.modeFinancialAssistance === m} onChange={e => setAssessment(a => ({ ...a, modeFinancialAssistance: e.target.value }))} className="text-primary" />
                                  {m}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">15c. Source of Fund</label>
                        <div className="mt-1 space-y-1">
                          {SOURCE_OF_FUND.map(s => (
                            <div key={s}>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="sourceOfFund" value={s} checked={assessment.sourceOfFund === s} onChange={e => setAssessment(a => ({ ...a, sourceOfFund: e.target.value }))} className="text-primary" />
                                {s}
                              </label>
                              {assessment.sourceOfFund === s && s === 'Priority Development Assistance Fund' && (
                                <Input className="mt-1 ml-6" value={assessment.legislatorSpecify} onChange={e => setAssessment(a => ({ ...a, legislatorSpecify: e.target.value }))} placeholder="Specify Legislator" aria-label="Legislator" />
                              )}
                              {assessment.sourceOfFund === s && s === 'Others' && (
                                <Input className="mt-1 ml-6" value={assessment.legislatorSpecify} onChange={e => setAssessment(a => ({ ...a, legislatorSpecify: e.target.value }))} placeholder="Specify source" aria-label="Other source" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">16. Other Assistance</label>
                    <div className="mt-1 space-y-1">
                      {OTHER_ASSISTANCE.map(o => (
                        <div key={o}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={!!assessment.otherAssistance[o]} onChange={() => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, [o]: !a.otherAssistance[o] } }))} className="rounded border-input text-primary" />
                            {o}
                          </label>
                          {Boolean(assessment.otherAssistance[o]) && o === 'Assistive Devices' && (
                            <Input className="mt-1 ml-6" value={(assessment.otherAssistance['assistiveDevicesSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, assistiveDevicesSpecify: e.target.value } }))} placeholder="Specify assistive devices" aria-label="Assistive devices specify" />
                          )}
                          {Boolean(assessment.otherAssistance[o]) && o === 'Other' && (
                            <Input className="mt-1 ml-6" value={(assessment.otherAssistance['otherSpecify'] as string) || ''} onChange={e => setAssessment(a => ({ ...a, otherAssistance: { ...a.otherAssistance, otherSpecify: e.target.value } }))} placeholder="Specify other assistance" aria-label="Other specify" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Interviewed by</label>
                    <Input value={user?.fullName || ''} disabled className="bg-muted" aria-label="Interviewed by" />
                  </div>
                  <SignaturePad onSave={(sig: string) => setAssessment(a => ({ ...a, clientSignature: sig }))} label="Client Signature" />

                  <Button onClick={saveAssessment} disabled={savingAssessment}>
                    {savingAssessment ? 'Saving...' : 'Save Assessment'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Nature of Service</span>
                    <p className="font-medium">{(caseData?.natureOfService || []).join(', ') || '—'}</p>
                  </div>
                  {caseData?.amountAssistance && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <p className="font-medium">₱{Number(caseData.amountAssistance).toLocaleString()}</p>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Source of Fund</span>
                    <p className="font-medium">{caseData?.sourceOfFund || '—'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* History timeline */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <Clock size={20} className="text-primary" />
              <h3 className="text-sm font-semibold">Case History</h3>
              {historyLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
            </div>
            <Separator />
            <div className="px-4 py-3">
              {!history || history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No history recorded.</p>
              ) : (
                <div className="relative pl-5 space-y-3">
                  {history.map((entry, i) => (
                    <div key={entry.id} className="relative">
                      {i < history.length - 1 && (
                        <div className="absolute left-[-18px] top-[18px] w-px h-full bg-border" />
                      )}
                      <div className="absolute left-[-22px] top-[6px] w-2.5 h-2.5 rounded-full border-2 border-primary bg-background" />
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {entry.fromStatus
                              ? `${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} → ${STATUS_LABELS[entry.toStatus] || entry.toStatus}`
                              : STATUS_LABELS[entry.toStatus] || entry.toStatus}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {entry.transitionType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt).toLocaleString()}
                          {entry.changedByRole && ` · by ${entry.changedByRole.replace(/_/g, ' ')}`}
                        </p>
                        {entry.remarks && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.remarks}</p>
                        )}
                        {entry.overrideReason && (
                          <p className="text-xs text-amber-600 mt-0.5">Override: {entry.overrideReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN (1/3) — Beneficiary + Household Sidebar === */}
        <div className="space-y-4">

          {/* Beneficiary card */}
          {ben && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <User size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Beneficiary</h3>
              </div>
              <Separator />
              <div className="px-4 py-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Full Name</span>
                  <p className="font-medium">{ben.firstName} {ben.middleName || ''} {ben.surname}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground text-xs">Gender</span>
                    <p>{ben.gender || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Age</span>
                    <p>{ageRange || '—'}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Date of Birth</span>
                  <p>{dob ? new Date(dob).toLocaleDateString() : '—'}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground text-xs">Address</span>
                    <p>{ben.address || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground text-xs">Phone</span>
                    <p>{ben.phone || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground text-xs">Philsys #</span>
                    <p>{ben.philsysNumber || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Access Card</span>
                    <p>{ben.accessCardCode || '—'}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/beneficiaries/${ben.id}`)}
                >
                  <User size={14} className="mr-1" /> View Profile
                </Button>
              </div>
            </div>
          )}

          {/* Household card */}
          {household && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <Users size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Household</h3>
              </div>
              <Separator />
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="shrink-0 text-muted-foreground" />
                  <span>{household.barangay || '—'}</span>
                </div>
                {household.estimatedIncome && (
                  <div>
                    <span className="text-muted-foreground text-xs">Estimated Income</span>
                    <p>₱{Number(household.estimatedIncome).toLocaleString()}/mo</p>
                  </div>
                )}
                {familyMembers.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                      <Users size={12} /> {familyMembers.length} Member{familyMembers.length > 1 ? 's' : ''}
                    </span>
                    <div className="space-y-2">
                      {familyMembers.map(m => (
                        <div key={m.id} className="rounded-md bg-muted/40 p-2.5 text-xs">
                          <div className="font-medium">{m.fullName}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {m.relationship}
                            {m.age && ` · ${m.age} yrs`}
                            {m.occupation && ` · ${m.occupation}`}
                          </div>
                          {m.income ? (
                            <div className="text-muted-foreground mt-0.5">₱{Number(m.income).toLocaleString()}/mo</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requirements checklist */}
          {caseData.requirementsChecklist && Object.keys(caseData.requirementsChecklist).length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <CheckCircle size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Requirements</h3>
              </div>
              <Separator />
              <div className="px-4 py-3 space-y-1.5 text-sm">
                {Object.entries(caseData.requirementsChecklist).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={value ? 'text-green-600' : 'text-muted-foreground'}>
                      {value ? '✓' : '○'}
                    </span>
                    <span className={value ? '' : 'text-muted-foreground'}>{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}