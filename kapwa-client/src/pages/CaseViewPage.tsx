import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { referralStatusLabel, statusLabel } from '@/i18n/display';
import useSWR, { useSWRConfig } from 'swr';
import {
  User, Users, Clock, AlertTriangle, Phone, MapPin, FileText, Download, FileWarning,
  Plus, Lock, Send, ExternalLink, MoreHorizontal, RotateCcw, Activity, CreditCard, ClipboardList,
} from 'lucide-react';
import { useCaseActions } from '../hooks/useCaseActions';
import { api, downloadCsrPdf, downloadFilingDoc, getFilingObjectUrl, downloadGisPdf } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { addressNames } from '@/lib/psgc';
import { formatDate, formatDateTime } from '../lib/format';
import { isAssessmentStepDone, interventionRequirementsMet } from '../lib/case-progress';
import { setCaseLabel } from '../lib/breadcrumbs';
import { humanizeError } from '../lib/errors';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { FamilyGraph } from '../components/family/FamilyGraph';
import { CaseStepper, stepperStepDone, StepperProgressOpts } from '@/components/case-view/CaseStepper';
import { isFourPsCase } from '@/components/case-view/FourPsComplianceSection';
import { StepAssessment } from '@/components/case-view/StepAssessment';
import { StepImplementHIP } from '@/components/case-view/StepImplementHIP';
import { StepIntegratedDelivery } from '@/components/case-view/StepIntegratedDelivery';
import { StepTransition } from '@/components/case-view/StepTransition';
import { StepClosure } from '@/components/case-view/StepClosure';
import { InterAgencyReferral } from '@/components/referrals/referral-utils';

const STATUS_BADGES: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  enrolled: 'outline',
  assessed: 'secondary',
  in_review: 'secondary',
  active: 'default',
  transitioning: 'secondary',
  closed: 'outline',
};

function findFirstPendingStep(caseData: any, interventionCount: number, opts: StepperProgressOpts = {}): number {
  if (!isAssessmentStepDone(caseData)) return 0;
  for (let i = 1; i < 5; i++) {
    if (!stepperStepDone(i, caseData, interventionCount, opts)) return i;
  }
  return 4;
}

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  assessed: 'Assessed',
  in_review: 'In Review',
  active: 'Active',
  transitioning: 'Transitioning',
  closed: 'Closed',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'MSWDO Admin',
  social_worker: 'MSWDO Social Worker',
  coordinator: 'Barangay Coordinator',
  claimant: 'Claimant',
  mayor: "Mayor's Office",
  auditor: 'Auditor',
  agency_staff: 'Agency Staff',
};

export function CaseViewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const { user } = useAuth();
  const [issuing, setIssuing] = useState<'coe' | 'pcv' | null>(null);

  async function issueDoc(type: 'coe' | 'pcv') {
    setIssuing(type);
    try {
      await api.post(`/cases/${id}/${type === 'coe' ? 'issue-coe' : 'issue-pcv'}`);
      await mutate(queryKeys.cases.detail(id!));
      toast.success(type === 'coe' ? t('cases.coeIssued', 'Certificate of Eligibility issued') : t('cases.pcvIssued', 'Petty Cash Voucher issued'));
    } catch (e) {
      toast.error(humanizeError(e));
    }
    setIssuing(null);
  }

  const [currentStep, setCurrentStep] = useState(0);
  const { actionLoading, handleAction } = useCaseActions();
  const initialNavDone = useRef(false);

  const { data: caseData, isLoading } = useSWR<any>(
    id ? queryKeys.cases.detail(id) : null,
  );
  const { data: interventions = [] } = useSWR<any[]>(
    id ? queryKeys.cases.interventions(id) : null,
  );
  const { data: documents = [] } = useSWR<any[]>(
    id ? queryKeys.filing.byCase(id) : null,
  );
  const canViewIdPhoto = ['admin', 'social_worker'].includes(user?.role ?? '');
  const { data: idPhoto } = useSWR<any>(
    id && canViewIdPhoto ? queryKeys.filing.caseIdPhoto(id) : null,
    async () => {
      try {
        return await api.get(`/filing/case/${id}/id-photo`);
      } catch {
        return null;
      }
    },
  );
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    if (idPhoto?.id) {
      getFilingObjectUrl(idPhoto.id)
        .then((url) => {
          if (!active) {
            URL.revokeObjectURL(url);
            return;
          }
          createdUrl = url;
          setIdPhotoUrl(url);
        })
        .catch(() => {
          if (active) setIdPhotoUrl(null);
        });
    } else {
      setIdPhotoUrl(null);
    }
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [idPhoto]);
  const { data: iarReferrals, isLoading: iarLoading } = useSWR(
    id ? queryKeys.interAgencyReferrals.byCase(id) : null,
    (key) => api.get<InterAgencyReferral[]>(key),
  );

  const { data: programs } = useSWR<any[]>(queryKeys.programs.list());

  // "Service Requested" reflects what is actually being delivered: the latest
  // intervention or inter-agency referral, whichever is newer. Falls back to the
  // intake's serviceRequested when neither exists yet.
  const latestService = useMemo(() => {
    const ints = (interventions || []).map((i: any) => ({ label: i?.serviceName, at: i?.deliveryDate || i?.createdAt }));
    const refs = (iarReferrals || []).map((r: any) => ({ label: r?.reason, at: r?.createdAt }));
    const dated = [...ints, ...refs].filter((x) => x.label && x.at);
    if (dated.length > 0) {
      dated.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return String(dated[0].label);
    }
    return (caseData?.serviceRequested || []).join(', ') || '—';
  }, [interventions, iarReferrals, caseData]);

  const requirementsMet = useMemo(
    () => interventionRequirementsMet(interventions, programs || [], caseData?.requirementsChecklist),
    [interventions, programs, caseData],
  );
  const progressOpts: StepperProgressOpts = useMemo(
    () => ({ requirementsMet, referralNotNeeded: !!caseData?.referralNotNeeded }),
    [requirementsMet, caseData],
  );

  useEffect(() => {
    if (caseData && !initialNavDone.current) {
      const pending = findFirstPendingStep(caseData, interventions.length, progressOpts);
      setCurrentStep(pending);
      initialNavDone.current = true;
    }
  }, [caseData, interventions, progressOpts]);

  // Breadcrumb shows the control number, not the URL's UUID.
  useEffect(() => {
    if (caseData?.id && caseData?.controlNo) setCaseLabel(caseData.id, caseData.controlNo);
  }, [caseData?.id, caseData?.controlNo]);
  const { data: history, isLoading: historyLoading } = useSWR<any[]>(
    id ? queryKeys.cases.detail(`${id}/history`) : null,
  );
  const benId = caseData?.beneficiary?.id;
  const { data: famGraph, isLoading: famLoading } = useSWR<{ members: Array<Record<string, unknown>>; primary: Record<string, unknown> }>(
    benId ? queryKeys.beneficiaries.familyGraph(benId) : null,
  );

  const caseClosed = caseData?.status === 'closed';
  const stepDone = useMemo(() => {
    const opts = progressOpts;
    return [
      isAssessmentStepDone(caseData),
      stepperStepDone(1, caseData, interventions.length, opts),
      stepperStepDone(2, caseData, interventions.length, opts),
      stepperStepDone(3, caseData, interventions.length, opts),
      stepperStepDone(4, caseData, interventions.length, opts),
    ];
  }, [caseData, interventions, progressOpts]);

  const ben = caseData?.beneficiary;
  const benAddress = addressNames(ben?.currentAddress) || ben?.address;
  const claimantAddress = addressNames(caseData?.claimant?.currentAddress) || caseData?.claimant?.address;
  const dob = ben?.dob;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null;
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

  if (isLoading) {
    return (
      <PageShell title={t('cases.loadingTitle', 'Loading case…')} description="">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start" aria-busy="true" aria-live="polite">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-72" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  if (!caseData) {
    return (
      <PageShell title={t('cases.notFoundTitle', 'Case Not Found')} description="" backTo={{ label: t('cases.backToCases', 'Back to Cases'), onClick: () => navigate('/cases') }}>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <FileText size={40} className="opacity-30" aria-hidden="true" />
          <p className="text-sm">{t('cases.notFound', 'This case could not be found. It may have been removed, or the link is incorrect.')}</p>
          <Button variant="outline" size="sm" onClick={() => mutate(queryKeys.cases.detail(id!))}>
            <RotateCcw size={14} className="mr-1.5" /> {t('common.retry', 'Retry')}
          </Button>
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

  const renewCase = () => navigate('/intake', {
    state: {
      renewalOfCaseId: id,
      prefill: {
        surname: (ben?.surname as string) || '', firstName: (ben?.firstName as string) || '',
        middleName: (ben?.middleName as string) || '', gender: (ben?.gender as string) || '',
        dob: (ben?.dob as string) || '', placeOfBirth: (ben?.placeOfBirth as string) || '',
        civilStatus: (ben?.civilStatus as string) || '', cellularNumber: (ben?.phone as string) || '',
        occupation: (ben?.occupation as string) || '',
        estimatedMonthlyIncome: (ben?.estimatedMonthlyIncome as number)?.toString() || '',
        philhealthNumber: (ben?.philhealthNumber as string) || '',
        familyMembers: (famGraph?.members || []).map((m: any) => ({
          id: m.id, surname: m.surname ?? '', firstName: m.firstName ?? '',
          middleName: m.middleName ?? '', extension: m.extension ?? '', gender: m.gender ?? '',
          dob: m.dob ?? '', relationship: m.relationship ?? '', occupation: m.occupation ?? '',
          income: m.income != null ? String(m.income) : '', status: m.status ?? '', done: false,
        })),
      },
    },
  });

  const canRequestReview = caseData.status === 'enrolled'
    && caseData.problemsPresented && caseData.socialWorkerAssessment && caseData.clientCategory
    && user?.role === 'social_worker';

  // `assessed` cases are submitted for admin review from the case view. Mirrors
  // the StepImplementHIP gate (interventions must exist before review because
  // activation requires at least one). Also rendered in the header so the
  // action is discoverable without switching to the Implement HIP step.
  const canSubmitReview = caseData.status === 'assessed'
    && interventions.length > 0
    && user?.role === 'social_worker';

  return (
    <PageShell
      title={t('cases.caseTitle', 'Case {{controlNo}}', { controlNo: caseData.controlNo })}
      description={t('cases.beneficiaryOf', 'Beneficiary: {{name}}', { name: `${ben?.firstName || ''} ${ben?.surname || ''}` })}
      backTo={{ label: t('cases.backToCases', 'Back to Cases'), onClick: () => navigate('/cases') }}
      actions={
        <div className="flex items-center gap-2">
          {isFourPsCase(caseData) && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/cases/${id}/4ps-compliance`)}>
              <ClipboardList size={14} aria-hidden="true" /> {t('cases.fourPsProgram', '4Ps Program')}
            </Button>
          )}
          {caseData.slaOverdue && (
            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
              <AlertTriangle size={12} aria-hidden="true" /> {t('cases.overdueBadge', 'OVERDUE')}
            </span>
          )}
          <Badge variant={STATUS_BADGES[caseData.status] || 'outline'} className="px-3 py-1 text-sm">
            {statusLabel(t, caseData.status)}
          </Badge>
        </div>
      }
    >
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* === LEFT COLUMN (2/3) — Stepper + Active Step === */}
        <div className="lg:col-span-2 space-y-4">

          {/* Case details strip */}
          <section className="rounded-lg border bg-card" aria-label={t('cases.caseDetails', 'Case details')}>
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <dl className="grid flex-1 min-w-[15rem] grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Meta label={t('cases.serviceRequested', 'Service Requested')} value={latestService} />
                <Meta label={t('cases.assignedWorker', 'Assigned Worker')} value={caseData.assignedWorker?.fullName || '—'} />
                {(caseData.approvedByName || caseData.approvedByRole) && (
                  <Meta
                    label={t('cases.approvedBy', 'Approved By')}
                    value={[
                      caseData.approvedByName,
                      caseData.approvedByRole
                        ? (ROLE_LABELS[caseData.approvedByRole] || String(caseData.approvedByRole).replace(/_/g, ' '))
                        : null,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
                <Meta
                  label={t('cases.createdUpdatedLabel', 'Created · Updated')}
                  value={t('cases.createdUpdated', 'Created {{created}} · Updated {{updated}}', { created: formatDate(caseData.createdAt), updated: formatDate(caseData.updatedAt) })}
                />
                {caseData.remarks && (
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('cases.remarks', 'Remarks')}</dt>
                    <dd className="mt-0.5">{caseData.remarks}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                {canRequestReview && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={actionLoading === id}
                    onClick={() => handleAction('request-review', id!)}
                  >
                    <Send size={14} aria-hidden="true" /> {actionLoading === id ? t('cases.saving', 'Saving…') : t('cases.requestReview', 'Request Review')}
                  </Button>
                )}
                {canSubmitReview && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={actionLoading === id}
                    onClick={() => handleAction('submit-review', id!)}
                  >
                    <Send size={14} aria-hidden="true" /> {actionLoading === id ? t('cases.saving', 'Saving…') : t('caseView.implement.submitForReview', 'Submit for Review →')}
                  </Button>
                )}
                {user?.role === 'admin' && !caseData.certificateUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={issuing === 'coe'} onClick={() => issueDoc('coe')}>
                    <FileText size={14} aria-hidden="true" /> {issuing === 'coe' ? t('cases.issuing', 'Issuing…') : t('cases.issueCoe', 'Issue COE')}
                  </Button>
                )}
                {user?.role === 'admin' && !caseData.pettyCashVoucherUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={issuing === 'pcv'} onClick={() => issueDoc('pcv')}>
                    <FileText size={14} aria-hidden="true" /> {issuing === 'pcv' ? t('cases.issuing', 'Issuing…') : t('cases.issuePcv', 'Issue PCV')}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadGisPdf(id!)}>
                  <Download size={14} aria-hidden="true" /> {t('cases.gisPdf', 'GIS (PDF)')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label={t('cases.moreActions', 'More actions')}>
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={renewCase}>
                      <Plus size={14} className="mr-2" aria-hidden="true" /> {t('cases.renewCase', 'Renew Case')}
                    </DropdownMenuItem>
                    {caseData.status === 'closed' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => downloadCsrPdf(id!)}>
                          <FileText size={14} className="mr-2" aria-hidden="true" /> {t('cases.caseStudyReport', 'Case Study Report')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {caseData.renewalOfCaseId && (
              <>
                <Separator />
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  {t('cases.renewalOf', 'Renewal of case')}{' '}
                  <button
                    type="button"
                    className="rounded text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    onClick={() => navigate(`/cases/${caseData.renewalOfCaseId}`)}
                  >
                    {String(caseData.renewalOfCaseId).slice(0, 8)}…
                  </button>
                </p>
              </>
            )}
          </section>

          {/* Stepper — sticky so step switching stays reachable on long cases */}
          <div className="sticky top-2 z-10 rounded-lg border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
            <CaseStepper currentStep={currentStep} onStepClick={(s) => setCurrentStep(s)} caseData={caseData} interventionCount={interventions.length} requirementsMet={requirementsMet} referralNotNeeded={!!caseData?.referralNotNeeded} />
          </div>

          {/* Generated approval documents — COE + PCV produced at approval,
              always available once the case is approved */}
          {(caseData?.certificateUrl || caseData?.pettyCashVoucherUrl) && (
            <div className="rounded-lg border bg-card px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="text-sm font-semibold">{t('caseView.generatedDocs', 'Generated Documents')}</span>
              {caseData.certificateUrl && (
                <a href={api.url(caseData.certificateUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <FileText size={14} /> {t('caseView.viewCertificate', 'View Certificate of Eligibility')}
                </a>
              )}
              {caseData.pettyCashVoucherUrl && (
                <a href={api.url(caseData.pettyCashVoucherUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <FileText size={14} /> {t('caseView.viewVoucher', 'View Petty Cash Voucher')}
                </a>
              )}
            </div>
          )}

          {/* Active Step Content */}
          <div>
            {stepComponents[currentStep]}
          </div>
        </div>

        {/* === RIGHT COLUMN (1/3) — Beneficiary + Household Sidebar === */}
        <aside className="space-y-4" aria-label={t('cases.caseSidebar', 'Case contacts and records')}>

          {/* Beneficiary card */}
          {ben && (
            <SectionCard icon={User} title={t('cases.beneficiary', 'Beneficiary')}>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t('cases.fullName', 'Full Name')}</span>
                  <p className="font-medium">{ben.firstName} {ben.middleName || ''} {ben.surname}</p>
                </div>
                {(ben.gender || age != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {ben.gender && (
                      <div>
                        <span className="text-muted-foreground text-xs">{t('cases.gender', 'Gender')}</span>
                        <p>{ben.gender}</p>
                      </div>
                    )}
                    {age != null && (
                      <div>
                        <span className="text-muted-foreground text-xs">{t('cases.age', 'Age')}</span>
                        <p className="tabular-nums">{age}</p>
                      </div>
                    )}
                  </div>
                )}
                {dob && (
                  <div>
                    <span className="text-muted-foreground text-xs">{t('cases.dateOfBirth', 'Date of Birth')}</span>
                    <p>{formatDate(dob)}</p>
                  </div>
                )}
                {benAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs">{t('cases.address', 'Address')}</span>
                      <p>{benAddress}</p>
                    </div>
                  </div>
                )}
                {ben.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs">{t('cases.phone', 'Phone')}</span>
                      <p>{ben.phone}</p>
                    </div>
                  </div>
                )}
                {(ben.philsysNumber || ben.accessCardCode) && (
                  <div className="grid grid-cols-2 gap-3">
                    {ben.philsysNumber && (
                      <div>
                        <span className="text-muted-foreground text-xs">{t('cases.philsysNumber', 'Philsys #')}</span>
                        <p>{ben.philsysNumber}</p>
                      </div>
                    )}
                    {ben.accessCardCode && (
                      <div>
                        <span className="text-muted-foreground text-xs">{t('cases.accessCard', 'Access Card')}</span>
                        <p>{ben.accessCardCode}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Claimant + household live with the beneficiary: one identity card
                  instead of three near-empty cards. */}
              {caseData?.claimant && (
                <>
                  <Separator />
                  <div className="px-4 py-3 space-y-2 text-sm">
                    <span className="text-muted-foreground text-xs">{t('cases.claimant', 'Claimant')}</span>
                    <p className="font-medium">{caseData.claimant.fullName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {caseData.claimant.relationship !== 'Self' && <span>{caseData.claimant.relationship}</span>}
                      {caseData.claimant.phone && <span>{caseData.claimant.phone}</span>}
                      {claimantAddress && <span>{claimantAddress}</span>}
                    </div>
                  </div>
                </>
              )}

              {household && (
                <>
                  <Separator />
                  <div className="px-4 py-3 space-y-2 text-sm">
                    <span className="text-muted-foreground text-xs">{t('cases.household', 'Household')}</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {household.barangay && <span>{household.barangay}</span>}
                      {household.estimatedIncome && <span className="tabular-nums">₱{Number(household.estimatedIncome).toLocaleString()}/mo</span>}
                      {household.nhtsPrId && <span>{t('nhts.label', 'NHTS-PR / Listahanan ID')}: {household.nhtsPrId}</span>}
                    </div>
                    {(famGraph?.members?.length || 0) > 0 && (
                      <div className="mt-1">
                        <FamilyGraph
                          loading={famLoading && !famGraph}
                          error={null}
                          members={famGraph?.members || [] as any}
                          primary={famGraph?.primary || null as any}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />
              <div className="px-4 py-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/beneficiaries/${ben.id}`)}
                >
                  <User size={14} className="mr-1.5" aria-hidden="true" /> {t('cases.viewProfile', 'View Profile')}
                </Button>
                {ben.accessCardCode && (
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a href={`/beneficiary/${ben.id}/access-card`}>
                      <CreditCard size={14} className="mr-1.5" aria-hidden="true" /> {t('caseView.viewAccessCard', 'View Access Card')}
                    </a>
                  </Button>
                )}
              </div>
            </SectionCard>
          )}

          {/* Documents card */}
          {ben && (
            <SectionCard icon={FileText} title={t('cases.documents', 'Documents')}>
              <div className="px-4 py-3 space-y-1">
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('cases.noDocuments', 'No documents attached to this case.')}</p>
                ) : (
                  documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category || ''}{doc.fileSize ? `${doc.category ? ' · ' : ''}${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('cases.downloadNamed', 'Download {{name}}', { name: doc.originalName || 'document' })}
                        onClick={() => downloadFilingDoc(doc.id, doc.originalName || 'document').catch(() => toast.error(t('cases.downloadFailed', 'Download failed')))}
                      >
                        <Download size={14} className="mr-1.5" aria-hidden="true" /> {t('cases.download', 'Download')}
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {canViewIdPhoto && idPhoto && idPhotoUrl && (
                <div className="border-t px-4 py-3">
                  <h4 className="text-sm font-semibold">{t('cases.idPhoto.title', 'Government ID')}</h4>
                  <img
                    src={idPhotoUrl}
                    alt={t('cases.idPhoto.alt', 'Beneficiary government ID')}
                    className="mt-2 h-40 w-40 rounded border object-cover"
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* Inter-Agency Referrals card */}
          <SectionCard icon={Send} title={t('cases.interAgencyReferrals', 'Inter-Agency Referrals')}>
            <div className="px-4 py-3 space-y-2">
              {iarLoading ? (
                <p className="text-xs text-muted-foreground">{t('cases.loadingCase', 'Loading case...')}</p>
              ) : (iarReferrals || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('cases.noInterAgencyReferrals', 'No inter-agency referrals for this case')}</p>
              ) : (
                (iarReferrals || []).map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/agency/referrals/${r.id}`, { state: { from: `/cases/${id}` } })}
                    className="w-full text-left rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.fromAgency?.name || r.fromAgencyId} → {r.toAgency?.name || r.toAgencyId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={r.status === 'declined' ? 'destructive' : 'default'}>{referralStatusLabel(t, r.status)}</Badge>
                        <ExternalLink size={14} className="text-muted-foreground" aria-hidden="true" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </SectionCard>

          {/* Incident Reports */}
          <SectionCard
            icon={FileWarning}
            title={t('cases.incidentReports', 'Incident Reports')}
            action={(
              <Button size="sm" onClick={() => navigate(`/irf/new?caseId=${id}`)}>
                <Plus size={14} className="mr-1.5" aria-hidden="true" /> {t('cases.newIrfFromCase', 'New IRF')}
              </Button>
            )}
          >
            <IrfCaseList caseId={id!} />
          </SectionCard>

          {/* Case History */}
          <SectionCard icon={Clock} title={t('cases.caseHistory', 'Case History')}>
              <div className="px-4 py-3">
                {historyLoading && !history ? (
                  <div className="space-y-3" aria-busy="true">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                ) : !history || history.length === 0 ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Activity size={14} aria-hidden="true" />
                    {t('cases.noHistory', 'No activity recorded yet.')}
                  </p>
                ) : (
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
                              ? `${statusLabel(t, entry.fromStatus)} → ${statusLabel(t, entry.toStatus)}`
                              : statusLabel(t, entry.toStatus)}
                          </span>
                          <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize">
                            {String(entry.transitionType || '').replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                          {entry.changedByRole && t('cases.byRole', ' · by {{role}}', { role: entry.changedByRole.replace(/_/g, ' ') })}
                        </p>
                        {entry.remarks && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.remarks}</p>
                        )}
                        {entry.overrideReason && (
                          <p className="mt-0.5 text-xs text-warning">{t('cases.override', 'Override: {{reason}}', { reason: entry.overrideReason })}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
          </SectionCard>
        </aside>
      </div>
    </PageShell>
    );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value}</dd>
    </div>
  );
}

// One consistent panel for every card on the case page: icon + heading +
// optional action, then a divider. Replaces the per-card header boilerplate.
function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  className = '',
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section className={`rounded-lg border bg-card ${className}`} aria-labelledby={headingId}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon size={18} className="shrink-0 text-primary" aria-hidden={true} />
          <h3 id={headingId} className="truncate font-heading text-sm font-semibold">{title}</h3>
        </div>
        {action}
      </header>
      <Separator />
      {children}
    </section>
  );
}

function IrfCaseList({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [irfs, setIrfs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/irf/by-case/${caseId}`).then((d: any) => setIrfs(d)).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-2 px-4 py-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (!irfs || irfs.length === 0) {
    return (
      <p className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
        <FileWarning size={14} aria-hidden="true" />
        {t('irf.noLinked', 'No incident reports linked to this case.')}
      </p>
    );
  }

  return (
    <div className="divide-y">
      {irfs.map((irf: any) => (
        <button
          key={irf.id}
          type="button"
          onClick={() => navigate(`/irf/${irf.id}`)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{irf.blotterEntryNumber}</span>
            <span className="block text-xs tabular-nums text-muted-foreground">{irf.caseCategory} &middot; {formatDate(irf.createdAt)}</span>
          </span>
          <Badge variant={irf.caseDisposition === 'Closed' ? 'default' : 'secondary'} className="shrink-0 text-xs">
            {irf.caseDisposition}
          </Badge>
        </button>
      ))}
    </div>
  );
}

