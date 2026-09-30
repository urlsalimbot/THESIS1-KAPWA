import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { api, downloadFilingDoc, filingDocIdFromUrl } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, FileText, Lock, FolderOpen, Ban, CheckCircle2 } from 'lucide-react';
import { CaseRequirements } from './CaseRequirements';
import { FileUploadList } from './FileUploadList';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../lib/format';
import { humanizeError } from '@/lib/errors';

interface Intervention {
  id: string;
  caseId: string;
  programId?: string;
  serviceName: string;
  category?: string;
  deliveryDate?: string;
  amount?: number;
  modeOfDelivery?: string;
  fundSource?: string;
  notes?: string;
  deliveredBy?: string;
}

interface Program {
  id: string;
  name: string;
  category?: string;
  requiredDocuments?: string[];
}

interface StepImplementHIPProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
}

export function StepImplementHIP({ caseId, caseData, userRole, readOnly }: StepImplementHIPProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [], mutate } = useSWR<Intervention[]>(
    queryKeys.cases.interventions(caseId),
  );
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());

  const [addOpen, setAddOpen] = useState(false);
  const EMPTY_FORM = {
    programId: '',
    serviceName: '',
    category: '',
    deliveryDate: '',
    amount: '',
    modeOfDelivery: '',
    fundSource: '',
    notes: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);
  /** Cancel discards a half-typed intervention, so the reset has to happen on
   *  the way out too — otherwise reopening the dialog shows stale values. */
  function closeAdd() {
    setAddOpen(false);
    setForm(EMPTY_FORM);
  }
  const [saving, setSaving] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const interventionNotNeeded = Boolean(caseData?.interventionNotNeeded);

  const { data: docs = [] } = useSWR<any[]>(
    caseId ? queryKeys.filing.byCase(caseId) : null,
  );
  const caseDocs = docs.filter((d: any) => !d.requirementKey);

  // Document uploads stay available for eligible roles regardless of step
  // completion or closure — recording an intervention (readOnly) or closing the
  // case must not remove the ability to attach supporting evidence.
  const canUpload = Boolean(userRole && ['admin', 'social_worker', 'coordinator', 'claimant'].includes(userRole));

  async function handleAdd() {
    setSaving(true);
    try {
      const selectedProgram = programs.find(p => p.id === form.programId);
      const serviceName = selectedProgram?.name || form.serviceName;
      const category = selectedProgram?.category || form.category || undefined;
      await api.post(`/cases/${caseId}/interventions`, {
        programId: form.programId?.startsWith('adhoc:') ? null : form.programId || null,
        serviceName,
        category,
        deliveryDate: form.deliveryDate || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        modeOfDelivery: form.modeOfDelivery || null,
        fundSource: form.fundSource || null,
        notes: form.notes || null,
      });
      await mutate();
      closeAdd();
      // The requirements checklist is derived from the interventions of this
      // case, so a newly logged delivery changes which documents step 2 asks
      // for — revalidate the detail or the checklist stays one step behind.
      await globalMutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to add intervention:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.del(`/cases/${caseId}/interventions/${id}`);
      await mutate();
    } catch (e) {
      console.error('Failed to delete intervention:', e);
    }
  }

  async function saveDecision(notNeeded: boolean) {
    setSavingDecision(true);
    try {
      await api.patch(`/cases/${caseId}/intervention-decision`, { notNeeded });
      await globalMutate(queryKeys.cases.detail(caseId));
      await globalMutate(queryKeys.cases.list());
    } catch (e) {
      toast.error(t('caseView.implement.interventionDecisionFailed', 'Could not save the intervention decision'), {
        description: humanizeError(e),
      });
    } finally {
      setSavingDecision(false);
    }
  }

  const totalAmount = interventions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  // Generated documents sit behind the Bearer token; opening the raw API URL in
  // a new tab cannot attach it (401). Download through the authenticated helper.
  async function viewGeneratedDoc(url: string, fallbackName: string) {
    const docId = filingDocIdFromUrl(url);
    if (!docId) {
      toast.error(t('cases.downloadFailed', 'Download failed'));
      return;
    }
    try {
      await downloadFilingDoc(docId, fallbackName);
    } catch {
      toast.error(t('cases.downloadFailed', 'Download failed'));
    }
  }

  return (
    <div className="space-y-4">
      {/* Generated approval documents — COE + PCV are produced at approval */}
      {(caseData?.certificateUrl || caseData?.pettyCashVoucherUrl) && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <h3 className="text-sm font-semibold mb-2">{t('caseView.implement.generatedDocs', 'Generated Documents')}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {caseData.certificateUrl && (
              <button
                type="button"
                onClick={() => viewGeneratedDoc(caseData.certificateUrl, 'certificate-of-eligibility.pdf')}
                className="inline-flex items-center gap-1.5 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <FileText size={14} /> {t('caseView.implement.viewCertificate', 'View Certificate of Eligibility')}
              </button>
            )}
            {caseData.pettyCashVoucherUrl && (
              <button
                type="button"
                onClick={() => viewGeneratedDoc(caseData.pettyCashVoucherUrl, 'petty-cash-voucher.pdf')}
                className="inline-flex items-center gap-1.5 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <FileText size={14} /> {t('caseView.implement.viewVoucher', 'View Petty Cash Voucher')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Record header — the two mutually exclusive ways to complete step 2 sit
          together: log a delivery, or record that none is issued. Recorded in
          the header (not a separate card further down) so the worker never has
          to hunt for the other option. */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.implement.interventionRecord', 'Intervention Record')}</h3>
            {interventionNotNeeded && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CheckCircle2 size={10} /> {t('caseView.implement.interventionNotNeededBadge', 'Intervention not needed')}
              </Badge>
            )}
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {interventionNotNeeded ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingDecision}
                  onClick={() => saveDecision(false)}
                >
                  {t('caseView.implement.undoInterventionNotNeeded', 'Undo decision')}
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus size={14} className="mr-1" /> {t('caseView.implement.addIntervention', 'Add Intervention')}
                  </Button>
                  {/* "No intervention" and a logged delivery are mutually
                      exclusive — the server's activation gate rejects a case
                      that is both — so the second option disappears once a
                      delivery exists. */}
                  {interventions.length === 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={savingDecision}
                      onClick={() => saveDecision(true)}
                    >
                      <Ban size={14} className="mr-1" /> {t('caseView.implement.markInterventionNotNeeded', 'No interventions issued')}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {interventionNotNeeded
            ? t('caseView.implement.interventionNotNeededActive', 'No intervention is issued for this case; referrals cover the service.')
            : (
              <>
                {interventions.length} {t('caseView.implement.interventionUnit', { count: interventions.length, defaultValue: interventions.length !== 1 ? 'interventions' : 'intervention' })} {t('caseView.implement.delivered', 'delivered')}
                {totalAmount > 0 && ` · ₱${totalAmount.toLocaleString()} ${t('caseView.implement.total', 'total')}`}
              </>
            )}
        </p>
      </div>

      {/* Add-intervention modal — a delivery is a record with eight fields, so
          it is confirmed in a dialog the way the referral step already does,
          rather than expanded inline above the list it would push down. */}
      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : closeAdd())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('caseView.implement.newIntervention', 'New Intervention')}</DialogTitle>
            <DialogDescription>
              {t('caseView.implement.newInterventionDesc', 'Record a service delivered to this client. The linked program decides which documents step 2 then requires.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="intv-program">{t('caseView.implement.programService', 'Program / Service *')}</Label>
              <select
                id="intv-program"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.programId}
                onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
              >
                <option value="">{t('caseView.implement.selectProgram', '— Select a program —')}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.requiredDocuments?.length ? ` (${p.requiredDocuments.length} ${t('caseView.implement.req', 'req.')})` : ''}</option>
                ))}
                <option value="adhoc:other">
                  {t('caseView.implement.otherService', 'Other service (specify)…')}
                </option>
              </select>
            </div>

            {form.programId.startsWith('adhoc:') && (
              <div className="space-y-1.5">
                <Label htmlFor="intv-service-name">{t('caseView.implement.serviceName', 'Service Name *')}</Label>
                <Input
                  id="intv-service-name"
                  value={form.serviceName}
                  onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                  placeholder={t('caseView.implement.serviceNamePlaceholder', 'e.g., Counseling Session, Home Visit')}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="intv-delivery-date">{t('caseView.implement.deliveryDate', 'Delivery Date')}</Label>
                <Input id="intv-delivery-date" type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intv-amount">{t('caseView.implement.amount', 'Amount (₱)')}</Label>
                <Input id="intv-amount" type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/,/g, '') }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="intv-mode">{t('caseView.implement.modeOfDeliveryLabel', 'Mode of Delivery')}</Label>
                <select id="intv-mode" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.modeOfDelivery} onChange={e => setForm(f => ({ ...f, modeOfDelivery: e.target.value }))}>
                  <option value="">—</option>
                  {[
                    { value: 'Cash', label: t('caseView.implement.modeOfDelivery.cash', 'Cash') },
                    { value: 'Cheque', label: t('caseView.implement.modeOfDelivery.cheque', 'Cheque') },
                    { value: 'Guarantee Letter', label: t('caseView.implement.modeOfDelivery.guaranteeLetter', 'Guarantee Letter') },
                    { value: 'In-kind', label: t('caseView.implement.modeOfDelivery.inKind', 'In-kind') },
                    { value: 'Service', label: t('caseView.implement.modeOfDelivery.service', 'Service') },
                  ].map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intv-fund">{t('caseView.implement.fundSourceLabel', 'Fund Source')}</Label>
                <select id="intv-fund" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fundSource} onChange={e => setForm(f => ({ ...f, fundSource: e.target.value }))}>
                  <option value="">—</option>
                  {[
                    { value: 'DSWD', label: t('caseView.implement.fundSource.dswd', 'DSWD') },
                    { value: 'LGU', label: t('caseView.implement.fundSource.lgu', 'LGU') },
                    { value: 'PDAF', label: t('caseView.implement.fundSource.pdaf', 'PDAF') },
                    { value: 'Donation', label: t('caseView.implement.fundSource.donation', 'Donation') },
                    { value: 'Other', label: t('caseView.implement.fundSource.other', 'Other') },
                  ].map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intv-notes">{t('caseView.implement.notes', 'Notes')}</Label>
              <textarea
                id="intv-notes"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('caseView.implement.notesPlaceholder', 'Additional details about this intervention...')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>{t('caseView.cancel', 'Cancel')}</Button>
            <Button onClick={handleAdd} disabled={saving || (!form.programId && !form.serviceName)}>
              {saving ? t('caseView.saving', 'Saving...') : t('caseView.implement.saveIntervention', 'Save Intervention')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intervention List */}
      {interventions.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {interventionNotNeeded
            ? t('caseView.implement.noInterventionsDecided', 'No intervention will be issued for this case. The service is covered by an inter-agency referral.')
            : t('caseView.implement.noInterventions', 'No interventions recorded yet. Click "Add Intervention" to document delivered services.')}
        </div>
      ) : (
        <div className="space-y-2">
          {interventions.map(intv => (
            /* A delivered service is the substantive fact of this step, so it
               carries the accent border and the larger type — the supporting
               metadata stays quiet beneath it. */
            <div key={intv.id} className="rounded-lg border border-primary/30 border-l-4 border-l-primary bg-primary/5 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className="text-lg font-semibold leading-tight tracking-tight">{intv.serviceName}</h4>
                    {intv.category && <Badge variant="secondary" className="text-[10px]">{intv.category}</Badge>}
                    {intv.amount != null && intv.amount !== ('' as unknown) && (
                      <span className="text-base font-semibold tabular-nums text-primary">
                        ₱{Number(intv.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {intv.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(intv.deliveryDate)}
                      </span>
                    )}
                    {intv.modeOfDelivery && <span>{intv.modeOfDelivery}</span>}
                    {intv.fundSource && <span>{intv.fundSource}</span>}
                  </div>
                  {intv.notes && <p className="text-sm text-muted-foreground/80 mt-1">{intv.notes}</p>}
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(intv.id)} aria-label={t('caseView.implement.deleteIntervention', 'Delete intervention')}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case Documents — uploads always available regardless of program config */}
      {canUpload && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-2">
            <FolderOpen size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">{t('caseView.implement.caseDocuments', 'Case Documents')}</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {t('caseView.implement.caseDocumentsHint', 'Upload receipts, certificates, and supporting evidence')}
            </span>
          </div>
          <Separator />
          <div className="px-4 py-2">
            <FileUploadList
              docs={caseDocs}
              canUpload={canUpload}
              onChanged={() => globalMutate(queryKeys.filing.byCase(caseId))}
              formExtras={{ caseId }}
            />
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      <CaseRequirements caseId={caseId} caseData={caseData} userRole={userRole} />

      {/* Status transition — visible even when readOnly so a worker who has already
          logged interventions (or recorded that none are needed) can still submit
          the assessed case for admin review. */}
      {(interventions.length > 0 || interventionNotNeeded) && caseData?.status === 'assessed' && userRole === 'social_worker' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{interventions.length > 0 ? t('caseView.implement.recorded', 'Interventions recorded') : t('caseView.implement.noInterventionRecorded', 'No intervention needed — referral-only case')}</p>
              <p className="text-xs text-muted-foreground">{t('caseView.implement.submitForReviewHint', 'Submit for admin review to activate the case.')}</p>
            </div>
            <ReviewButton caseId={caseId} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewButton({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  async function handleReview() {
    setLoading(true);
    try {
      await api.patch(`/cases/${caseId}/status`, { status: 'in_review' });
      // The panel's own bound mutate targets only the interventions key — using
      // it here never touched the case detail, so the header status badge stayed
      // stale until reload. Revalidate the detail key and the cases list through
      // the global mutate (same pattern as useCaseActions.handleAction).
      await mutate(queryKeys.cases.detail(caseId), undefined, { revalidate: true });
      await mutate(queryKeys.cases.all, undefined, { revalidate: true });
    } catch (e) {
      console.error('Failed to submit for review:', e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button onClick={handleReview} disabled={loading} size="sm">
      {loading ? t('caseView.submitting', 'Submitting...') : t('caseView.implement.submitForReview', 'Submit for Review →')}
    </Button>
  );
}
