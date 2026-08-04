import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { User, Users, Clock, AlertTriangle, Phone, MapPin, FileText, Download, FileWarning, Plus, Lock } from 'lucide-react';
import { api, downloadCsrPdf, downloadCertificate, type CertificateType } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FamilyGraph } from '../components/family/FamilyGraph';
import { CaseStepper } from '@/components/case-view/CaseStepper';
import { StepAssessment } from '@/components/case-view/StepAssessment';
import { StepImplementHIP } from '@/components/case-view/StepImplementHIP';
import { StepIntegratedDelivery } from '@/components/case-view/StepIntegratedDelivery';
import { StepTransition } from '@/components/case-view/StepTransition';
import { StepClosure } from '@/components/case-view/StepClosure';

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  enrolled: 'outline',
  assessed: 'secondary',
  in_review: 'secondary',
  active: 'default',
  transitioning: 'secondary',
  closed: 'outline',
};

function findFirstPendingStep(caseData: any, interventionCount: number): number {
  const checks = [
    (d: any) => !!d?.problemsPresented && !!d?.clientCategory,
    () => interventionCount > 0,
    (d: any) => interventionCount > 0 || (d?.referrals?.length || 0) > 0,
    (d: any) => !!d?.selfRelianceLevel && !!d?.sustainabilityPlan,
    (d: any) => !!d?.clientSignature && !!d?.closureOutcome,
  ];
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i](caseData)) return i;
  }
  return checks.length - 1;
}

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  assessed: 'Assessed',
  in_review: 'In Review',
  active: 'Active',
  transitioning: 'Transitioning',
  closed: 'Closed',
};

export function CaseViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const initialNavDone = useRef(false);

  const { data: caseData, isLoading } = useSWR<any>(
    id ? queryKeys.cases.detail(id) : null,
  );
  const { data: interventions = [] } = useSWR<any[]>(
    id ? queryKeys.cases.interventions(id) : null,
  );

  useEffect(() => {
    if (caseData && !initialNavDone.current) {
      const pending = findFirstPendingStep(caseData, interventions.length);
      setCurrentStep(pending);
      initialNavDone.current = true;
    }
  }, [caseData, interventions]);
  const { data: history, isLoading: historyLoading } = useSWR<any[]>(
    id ? queryKeys.cases.detail(`${id}/history`) : null,
  );
  const benId = caseData?.beneficiary?.id;
  const { data: famGraph, isLoading: famLoading } = useSWR<{ members: Array<Record<string, unknown>>; primary: Record<string, unknown> }>(
    benId ? queryKeys.beneficiaries.familyGraph(benId) : null,
  );

  const caseClosed = caseData?.status === 'closed';
  const stepDone = useMemo(() => [
    !!caseData?.problemsPresented && !!caseData?.clientCategory,
    interventions.length > 0,
    interventions.length > 0 || (caseData?.referrals?.length || 0) > 0,
    !!caseData?.selfRelianceLevel && !!caseData?.sustainabilityPlan,
    !!caseData?.clientSignature && !!caseData?.closureOutcome,
  ], [caseData, interventions]);

  const ben = caseData?.beneficiary;
  const dob = ben?.dob;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
  const ageRange = dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '';
  const household = ben?.household;


  const [assessment, setAssessment] = useState({
    problemsPresented: caseData?.problemsPresented || '',
    socialWorkerAssessment: caseData?.socialWorkerAssessment || '',
    clientCategory: caseData?.clientCategory || '',
    frvaScore: caseData?.frvaScore || null,
    swdiScore: caseData?.swdiScore || null,
    familyDialogueNotes: caseData?.familyDialogueNotes || '',
    natureOfService: caseData?.natureOfService || ([] as string[]),
    financialSubsidies: caseData?.financialSubsidies || ({} as Record<string, unknown>),
    amountAssistance: caseData?.amountAssistance ?? ('' as string | number),
    modeFinancialAssistance: caseData?.modeFinancialAssistance || '',
    sourceOfFund: caseData?.sourceOfFund || '',
    legislatorSpecify: caseData?.legislatorSpecify || '',
    otherAssistance: caseData?.otherAssistance || ({} as Record<string, unknown>),
    clientSignature: caseData?.clientSignature || '',
  });
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [certGenerating, setCertGenerating] = useState<CertificateType | null>(null);
  const [certError, setCertError] = useState('');

  useEffect(() => {
    if (caseData) {
      setAssessment({
        problemsPresented: caseData.problemsPresented || '',
        socialWorkerAssessment: caseData.socialWorkerAssessment || '',
        clientCategory: caseData.clientCategory || '',
        frvaScore: caseData.frvaScore || null,
        swdiScore: caseData.swdiScore || null,
        familyDialogueNotes: caseData.familyDialogueNotes || '',
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
        frvaScore: assessment.frvaScore || undefined,
        swdiScore: assessment.swdiScore || undefined,
        familyDialogueNotes: assessment.familyDialogueNotes || undefined,
      });
      await mutate(queryKeys.cases.detail(id!));
    } catch (e) {
      console.error('Failed to save assessment:', e);
    } finally {
      setSavingAssessment(false);
    }
  }

  async function handleGenerateCertificate(type: CertificateType) {
    if (!ben) return;
    setCertGenerating(type);
    setCertError('');
    try {
      await downloadCertificate(type, {
        fullName: [ben.firstName, ben.middleName, ben.surname].filter(Boolean).join(' '),
        address: ben.address || undefined,
        date: new Date().toISOString().split('T')[0],
      });
    } catch (err: any) {
      setCertError(err.message || 'Failed to generate certificate');
    } finally {
      setCertGenerating(null);
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
      <PageShell title="Case Not Found" description="" backTo={{ label: "Back to Cases", onClick: () => navigate('/cases') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Case not found.</p>
        </div>
      </PageShell>
    );
  }

  const stepComponents = [
    <StepAssessment key="assessment" caseId={id!} caseData={caseData} assessment={assessment}
      onAssessmentChange={setAssessment} onSave={saveAssessment} saving={savingAssessment}
      userRole={user?.role} readOnly={stepDone[0] || caseClosed} />,
    <StepImplementHIP key="hip" caseId={id!} caseData={caseData} userRole={user?.role} readOnly={stepDone[1] || caseClosed} />,
    <StepIntegratedDelivery key="delivery" caseId={id!} caseData={caseData} userRole={user?.role} readOnly={stepDone[2] || caseClosed} />,
    <StepTransition key="transition" caseId={id!} caseData={caseData} userRole={user?.role} readOnly={stepDone[3] || caseClosed} />,
    <StepClosure key="closure" caseId={id!} caseData={caseData} readOnly={stepDone[4] || caseClosed} />,
  ];

  return (
    <PageShell
      title={`Case ${caseData.controlNo}`}
      description={`Beneficiary: ${ben?.firstName || ''} ${ben?.surname || ''}`}
      backTo={{ label: 'Back to Cases', onClick: () => navigate('/cases') }}
      actions={caseData.slaOverdue ? (
        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle size={12} /> OVERDUE
        </span>
      ) : undefined}
    >
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* === LEFT COLUMN (2/3) — Stepper + Active Step === */}
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
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_BADGES[caseData.status] || 'outline'} className="text-sm px-3 py-1">
                  {STATUS_LABELS[caseData.status] || caseData.status}
                </Badge>
                {caseData.status === 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => downloadCsrPdf(id!)}
                  >
                    <Download size={14} /> Case Study Report
                  </Button>
                )}
              </div>
            </div>
            <Separator />
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Service Requested</span>
                <p className="font-medium">{(caseData.serviceRequested || []).join(', ') || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned Worker</span>
                <p className="font-medium">{caseData.assignedWorker?.fullName || '—'}</p>
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

          {/* Stepper */}
          <div className="rounded-lg border bg-card">
            <CaseStepper currentStep={currentStep} onStepClick={(s) => setCurrentStep(s)} caseData={caseData} interventionCount={interventions.length} />
          </div>

          {/* Active Step Content */}
          <div>
            {stepComponents[currentStep]}
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

          {/* Certificates card */}
          {ben && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <FileText size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Certificates</h3>
              </div>
              <Separator />
              <div className="px-5 py-3 space-y-2">
                {certError && (
                  <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">{certError}</div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={certGenerating !== null}
                  onClick={() => handleGenerateCertificate('indigency')}
                >
                  {certGenerating === 'indigency' ? 'Generating...' : 'Certificate of Indigency'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={certGenerating !== null}
                  onClick={() => handleGenerateCertificate('eligibility')}
                >
                  {certGenerating === 'eligibility' ? 'Generating...' : 'Certificate of Eligibility'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={certGenerating !== null}
                  onClick={() => handleGenerateCertificate('referral')}
                >
                  {certGenerating === 'referral' ? 'Generating...' : 'Certificate of Referral'}
                </Button>
              </div>
            </div>
          )}

          {/* Claimant card */}
          {caseData?.claimant && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <User size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Claimant</h3>
              </div>
              <Separator />
              <div className="px-4 py-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Full Name</span>
                  <p className="font-medium">{caseData.claimant.fullName}</p>
                </div>
                {caseData.claimant.relationship !== 'Self' && (
                  <div>
                    <span className="text-muted-foreground text-xs">Relationship to Beneficiary</span>
                    <p>{caseData.claimant.relationship}</p>
                  </div>
                )}
                {caseData.claimant.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs">Phone</span>
                      <p>{caseData.claimant.phone}</p>
                    </div>
                  </div>
                )}
                {caseData.claimant.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs">Address</span>
                      <p>{caseData.claimant.address}</p>
                    </div>
                  </div>
                )}
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
                {(famGraph?.members?.length || 0) > 0 && (
                  <div className="mt-2">
                    <span className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                      <Users size={12} /> {famGraph!.members.length} Member{famGraph!.members.length > 1 ? 's' : ''}
                    </span>
                    <FamilyGraph
                      loading={famLoading && !famGraph}
                      error={null}
                      members={famGraph?.members || [] as any}
                      primary={famGraph?.primary || null as any}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Incident Reports */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Incident Reports</h3>
              </div>
              <Button size="sm" onClick={() => navigate(`/irf/new?caseId=${id}`)}>
                <Plus size={14} className="mr-1" /> New IRF from Case
              </Button>
            </div>
            <Separator />
            <IrfCaseList caseId={id!} />
          </div>

          {/* Case History */}
          {history && history.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-3">
                <Clock size={20} className="text-primary" />
                <h3 className="text-sm font-semibold">Case History</h3>
                {historyLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
              </div>
              <Separator />
              <div className="px-4 py-3">
                <div className="relative pl-5 space-y-3">
                  {history.map((entry: any, i: number) => (
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
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
    );
}

function IrfCaseList({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const [irfs, setIrfs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/irf/by-case/${caseId}`).then((d: any) => setIrfs(d)).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <div className="px-4 py-6 text-sm text-muted-foreground">Loading IRFs...</div>;

  if (!irfs || irfs.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">No incident reports linked to this case.</div>;
  }

  return (
    <div className="divide-y">
      {irfs.map((irf: any) => (
        <div key={irf.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/irf/${irf.id}`)}>
          <div>
            <p className="text-sm font-medium">{irf.blotterEntryNumber}</p>
            <p className="text-xs text-muted-foreground">{irf.caseCategory} &middot; {new Date(irf.createdAt).toLocaleDateString()}</p>
          </div>
          <Badge variant={irf.caseDisposition === 'Closed' ? 'default' : 'secondary'} className="text-xs">
            {irf.caseDisposition}
          </Badge>
        </div>
      ))}
    </div>
  );
}

