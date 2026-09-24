import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { statusLabel } from '@/i18n/display';
import { stepperStatus } from '@/components/case-view/CaseStepper';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../lib/query-keys';
import { ArrowRight, Check } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';

interface ApprovalCase {
  id: string;
  controlNo: string;
  status: string;
  serviceRequested?: string[];
  requirementsChecklist?: Record<string, boolean>;
  certificateUrl?: string;
  pettyCashVoucherUrl?: string;
  beneficiary?: { firstName?: string; surname?: string };
  assignedWorkerId?: string;
  updatedAt: string;
  problemsPresented?: string;
  clientCategory?: string;
  interventionCount?: number;
  referrals?: unknown[];
  selfRelianceLevel?: number;
  sustainabilityPlan?: string;
  clientSignature?: string;
  closureOutcome?: string;
}

export function ApprovalPipelinePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Fetch each pipeline status explicitly: the default `/cases` list is
  // paginated (newest 10) and ordered by createdAt, so in-review / transitioning
  // cases were routinely missing from their columns.
  const { data: rawInReview, isLoading: loadingInReview } = useSWR<ApprovalCase[] | { data: ApprovalCase[] }>(queryKeys.cases.list({ status: 'in_review', limit: 200 }));
  const { data: rawActive, isLoading: loadingActive } = useSWR<ApprovalCase[] | { data: ApprovalCase[] }>(queryKeys.cases.list({ status: 'active', limit: 200 }));
  const { data: rawTransitioning, isLoading: loadingTransitioning } = useSWR<ApprovalCase[] | { data: ApprovalCase[] }>(queryKeys.cases.list({ status: 'transitioning', limit: 200 }));
  const unwrapCases = (d: ApprovalCase[] | { data: ApprovalCase[] } | undefined): ApprovalCase[] =>
    Array.isArray(d) ? d : (d?.data ?? []);
  const cases = [...unwrapCases(rawInReview), ...unwrapCases(rawActive), ...unwrapCases(rawTransitioning)];
  const loading = loadingInReview || loadingActive || loadingTransitioning;
  const lastSync = cases.length > 0 ? Date.now() : null;

  // Aligned with the case stepper: Phase-In (Assessment) → Implementation
  // (Implement HIP + Service Delivery) → Phase-Out (Transition + Closure).
  const pipelinePhases = [
    { key: 'phase-in', label: t('approvals.phaseIn', 'Phase-In'), statuses: ['in_review'], steps: [0], dot: 'bg-amber-400' },
    { key: 'implementation', label: t('approvals.phaseImplementation', 'Implementation'), statuses: ['active'], steps: [1, 2], dot: 'bg-emerald-400' },
    { key: 'phase-out', label: t('approvals.phaseOut', 'Phase-Out'), statuses: ['transitioning'], steps: [3, 4], dot: 'bg-primary/40' },
  ];
  const grouped = pipelinePhases.map(phase => ({
    ...phase,
    items: cases.filter(c => phase.statuses.includes(c.status)),
  }));

  if (loading) {
    return (
      <PageShell title={t('approvals.title', 'Approval Pipeline')} description={t('approvals.description', 'Certificate of Eligibility review, Petty Cash Voucher management, and sign-off.')}>
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  const allEmpty = grouped.every(g => g.items.length === 0);

  return (
    <PageShell
      title={t('approvals.title', 'Approval Pipeline')}
      description={t('approvals.description', 'Certificate of Eligibility review, Petty Cash Voucher management, and sign-off.')}
      cachedAt={lastSync ?? undefined}
    >
      {allEmpty ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {grouped.map(group => (
            <div key={group.key} className="bg-card rounded-lg border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-base">
                <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                {group.label}
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.items.length}</span>
              </h2>
              <div className="space-y-3">
                {group.items.map(c => (
                  <div
                    key={c.id}
                    className="border border-border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <span className="font-medium text-sm text-foreground block truncate">
                          {[
                            c.beneficiary ? `${c.beneficiary.firstName || ''} ${c.beneficiary.surname || ''}`.trim() : '',
                            (c.serviceRequested || []).join(', '),
                          ].filter(Boolean).join(' - ') || c.controlNo}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.controlNo}</p>
                      </div>
                      <Badge variant={
                        c.status === 'in_review' ? 'secondary' :
                        c.status === 'active' ? 'default' : 'secondary'
                      }>{statusLabel(t, c.status)}</Badge>
                    </div>
                    {c.serviceRequested && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.serviceRequested.map((s, i) => (
                          <span key={i} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Case stepper progress — mirrors the case view stepper */}
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                      {stepperStatus(c, c.interventionCount ?? 0).map((done, si) => (
                        <span
                          key={si}
                          title={done ? t('approvals.stepDone', 'Step done') : t('approvals.stepPending', 'Step pending')}
                          className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {done ? <Check size={11} /> : si + 1}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{t('approvals.caseProgress', 'Case progress')}</span>
                    </div>

                    {/* Transitions (approve / disburse) are performed in the
                        case view only — this page is a read-only overview.
                        Clicking a card opens the case. */}
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                      {t('approvals.openCase', 'Open case to act')}
                      <ArrowRight size={12} aria-hidden="true" />
                    </span>
                  </div>
                ))}
                {group.items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('approvals.noCases', 'No cases')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </PageShell>
  );
}
