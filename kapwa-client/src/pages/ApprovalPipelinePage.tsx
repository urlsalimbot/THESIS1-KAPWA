import { useState, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';
import { stepperStatus } from '@/components/case-view/CaseStepper';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../lib/query-keys';
import { getCurrentUser } from '../lib/auth-context';
import SignaturePad from '../components/forms/SignaturePad';
import { CheckCircle, Upload, FileText, ArrowRight, ListChecks, Check } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionBar } from '@/components/bulk-actions/BulkActionBar';
import { BulkApproveDialog } from '@/components/bulk-actions/BulkApproveDialog';
import { BulkExportDialog } from '@/components/bulk-actions/BulkExportDialog';
import { showBulkProgress } from '@/components/bulk-actions/BulkProgressToast';

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
  const { mutate: globalMutate } = useSWRConfig();
  const { data: rawCases, isLoading: loading } = useSWR<ApprovalCase[] | { data: ApprovalCase[] }>(queryKeys.cases.list());
  const cases = Array.isArray(rawCases) ? rawCases : (rawCases?.data ?? []);
  const [user, setUser] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<ApprovalCase | null>(null);
  const [signature, setSignature] = useState<string>('');
  const [action, setAction] = useState<'approve' | 'disburse' | null>(null);
  const [saving, setSaving] = useState(false);
  const lastSync = cases.length > 0 ? Date.now() : null;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveDialogOpen, setBulkApproveDialogOpen] = useState(false);
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

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

  // FormData uploads stay on raw fetch (D-10 deferred — JSON-only api client).
  async function handleApprove(caseId: string) {
    setSaving(true);
    try {
      const targetStatus = action === 'disburse' ? 'transitioning' : 'active';
      await api.patch(`/cases/${caseId}/approve`, { status: targetStatus, signature });
      setSelectedCase(null);
      setAction(null);
      setSignature('');
      globalMutate(queryKeys.cases.all);
    } catch (e) { console.error('Approve failed', e); }
    setSaving(false);
  }

  async function handleBulkApprove(reason?: string) {
    const ids = Array.from(selectedIds);
    await showBulkProgress(ids, async (id) => {
      await api.patch(`/cases/${id}/approve`, { status: 'active', signature: reason || '' });
    }, t('approvals.approving', 'Approving'));
    globalMutate(queryKeys.cases.all);
    clearSelection();
  }

  function openApproval(c: ApprovalCase, act: 'approve' | 'disburse') {
    setSelectedCase(c);
    setAction(act);
    setSignature('');
  }

  const selectAllChecked = cases.length > 0 && cases.every(c => selectedIds.has(c.id));
  const selectSomeChecked = cases.some(c => selectedIds.has(c.id)) && !selectAllChecked;

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
      actions={
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleSelectMode}
        >
          <ListChecks size={16} className="mr-1.5" />
          {selectMode ? t('approvals.exitSelectMode', 'Exit Select Mode') : t('approvals.selectMode', 'Select Mode')}
        </Button>
      }
    >
      {selectMode && cases.length > 0 && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <Checkbox
            checked={selectAllChecked || (selectSomeChecked ? 'indeterminate' : false)}
            onCheckedChange={() => {
              if (selectAllChecked) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(cases.map(c => c.id)));
              }
            }}
            aria-label={t('approvals.selectAllCases', 'Select all cases')}
          />
          <span className="text-sm text-muted-foreground">
            {t('approvals.selectAllCases', 'Select all cases')}
          </span>
        </div>
      )}

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
                    {selectMode && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelectId(c.id)}
                          aria-label={t('approvals.selectCaseAria', 'Select {{controlNo}}', { controlNo: c.controlNo })}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {selectedIds.has(c.id) ? t('approvals.selected', 'Selected') : t('approvals.select', 'Select')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm text-foreground">{c.controlNo}</span>
                        {c.beneficiary && (
                          <p className="text-xs text-muted-foreground mt-0.5">{c.beneficiary.surname}, {c.beneficiary.firstName}</p>
                        )}
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

                    {group.key === 'phase-in' && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          {t('approvals.docsGeneratedNote', 'Certificate of Eligibility and Petty Cash Voucher are generated automatically upon approval.')}
                        </p>
                        {user?.role === 'admin' && (
                          <Button onClick={() => openApproval(c, 'approve')} size="sm" className="w-full mt-1">
                            <CheckCircle size={14} /> {t('approvals.approveAndSign', 'Approve & Sign')}
                          </Button>
                        )}
                      </div>
                    )}

                    {group.key !== 'phase-in' && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-border">
                        {c.certificateUrl && (
                          <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs textemerald-600">
                            <FileText size={14} /> {t('approvals.viewCertificate', 'View Certificate')}
                          </a>
                        )}
                        {c.pettyCashVoucherUrl && (
                          <a href={c.pettyCashVoucherUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs textemerald-600">
                            <FileText size={14} /> {t('approvals.viewVoucher', 'View Voucher')}
                          </a>
                        )}
                        {c.status === 'active' && user?.role === 'admin' && (
                          <Button onClick={() => openApproval(c, 'disburse')} size="sm" variant="secondary" className="w-full mt-1">
                            <ArrowRight size={14} /> {t('approvals.markTransitioned', 'Mark Transitioned')}
                          </Button>
                        )}
                      </div>
                    )}
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onApprove={() => selectedIds.size > 0 && setBulkApproveDialogOpen(true)}
        onReassign={() => {}}
        onExport={() => selectedIds.size > 0 && setBulkExportDialogOpen(true)}
        onClearSelection={clearSelection}
      />

      {/* Bulk Approve Dialog */}
      <BulkApproveDialog
        open={bulkApproveDialogOpen}
        onOpenChange={setBulkApproveDialogOpen}
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onConfirm={handleBulkApprove}
      />

      {/* Bulk Export Dialog */}
      <BulkExportDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onComplete={() => {
          clearSelection();
          setSelectMode(false);
        }}
      />

      {/* Signature Modal */}
      {selectedCase && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md border border-border">
            <h3 className="font-semibold text-foreground mb-1">
              {action === 'approve' ? t('approvals.approveCase', 'Approve Case') : t('approvals.markDisbursed', 'Mark as Disbursed')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{selectedCase.controlNo}</p>

            <SignaturePad onSave={setSignature} label={t('approvals.signatureLabel', 'Authorized Signatory E-Signature')} />

            {signature && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">{t('approvals.signaturePreview', 'Signature Preview:')}</p>
                <img src={signature} alt={t('approvals.signatureAlt', 'Signature')} className="h-12 border rounded bg-card" />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setSelectedCase(null); setAction(null); }} disabled={saving}>
                {t('approvals.cancel', 'Cancel')}
              </Button>
              <Button onClick={() => handleApprove(selectedCase.id)} disabled={!signature || saving}>
                {saving ? t('approvals.saving', 'Saving...') : <><CheckCircle size={16} /> {action === 'approve' ? t('approvals.approve', 'Approve') : t('approvals.disburse', 'Disburse')}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
