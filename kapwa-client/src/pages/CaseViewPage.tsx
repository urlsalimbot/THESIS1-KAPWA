import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { User, Users, Clock, AlertTriangle, Phone, MapPin, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FamilyGraph } from '../components/family/FamilyGraph';
import { CaseStepper } from '@/components/case-view/CaseStepper';
import { StepAssessment } from '@/components/case-view/StepAssessment';
import { StepInterventions } from '@/components/case-view/StepInterventions';
import { StepExitPlan } from '@/components/case-view/StepExitPlan';
import { StepSignatures } from '@/components/case-view/StepSignatures';

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

export function CaseViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();

  const [currentStep, setCurrentStep] = useState(0);

  const { data: caseData, isLoading } = useSWR<any>(
    id ? queryKeys.cases.detail(id) : null,
  );
  const { data: history, isLoading: historyLoading } = useSWR<any[]>(
    id ? queryKeys.cases.detail(`${id}/history`) : null,
  );
  const benId = caseData?.beneficiary?.id;
  const { data: famGraph, isLoading: famLoading } = useSWR<{ members: Array<Record<string, unknown>>; primary: Record<string, unknown> }>(
    benId ? queryKeys.beneficiaries.familyGraph(benId) : null,
  );

  const ben = caseData?.beneficiary;
  const dob = ben?.dob;
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
  const ageRange = dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '';
  const household = ben?.household;

  const [editingAssessment, setEditingAssessment] = useState(false);
  const [assessment, setAssessment] = useState({
    problemsPresented: '',
    socialWorkerAssessment: '',
    clientCategory: '',
    natureOfService: [] as string[],
    financialSubsidies: {} as Record<string, unknown>,
    amountAssistance: '' as string | number,
    modeFinancialAssistance: '',
    sourceOfFund: '',
    legislatorSpecify: '',
    otherAssistance: {} as Record<string, unknown>,
    clientSignature: '',
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
      <PageShell title="Case Not Found" description="" backTo={{ label: "Back to Cases", onClick: () => navigate('/cases') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Case not found.</p>
        </div>
      </PageShell>
    );
  }

  const stepComponents = [
    null,
    <StepAssessment key="assessment" caseData={caseData} assessment={assessment}
      editingAssessment={editingAssessment} onEditToggle={() => setEditingAssessment(!editingAssessment)}
      onAssessmentChange={setAssessment} onSave={saveAssessment} saving={savingAssessment} />,
    <StepInterventions key="interventions" caseId={id!} />,
    <StepExitPlan key="exit" caseId={id!} caseData={caseData} />,
    <StepSignatures key="signatures" caseData={caseData} />,
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

          {/* Stepper */}
          <div className="rounded-lg border bg-card">
            <CaseStepper currentStep={currentStep} onStepClick={setCurrentStep} />
          </div>

          {/* Active Step Content */}
          <div>
            {currentStep === 0 ? (
              <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                Client profile data is shown in the sidebar. Select another step to continue.
              </div>
            ) : (
              stepComponents[currentStep]
            )}
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
        </div>
      </div>

      {/* Case History (full width, below both columns) */}
      {history && history.length > 0 && (
        <div className="rounded-lg border bg-card mt-4">
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
    </PageShell>
  );
}
