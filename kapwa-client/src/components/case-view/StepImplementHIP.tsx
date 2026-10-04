import { useMemo, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { interventionRequirementsMet, requiredDocumentKeys } from '@/lib/case-progress';
import { INTERVENTION_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, Lock, FolderOpen, Ban, CheckCircle2, HandCoins } from 'lucide-react';
import { CaseRequirements } from './CaseRequirements';
import { FileUploadList } from './FileUploadList';
import { StepLockBar, type StepLock } from './StepLockBar';
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
  services?: string[];
}

interface StepImplementHIPProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
  /** This step's own seal row, or null — the case view resolves it. */
  stepLock?: StepLock | null;
  /**
   * Whether this step may still be sealed/released, kept apart from the actions'
   * `readOnly`: a sealed step's controls are read-only *because* of the seal, so
   * folding that into the same flag would hide the one control that lifts it.
   * Defaults to `false`, so omitting it can never hide a sealed step's Unlock;
   * a caller that wants the seal control withheld passes `true`.
   */
  lockReadOnly?: boolean;
}

export function StepImplementHIP({ caseId, caseData, userRole, readOnly, lockReadOnly = false, stepLock }: StepImplementHIPProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [], mutate } = useSWR<Intervention[]>(
    queryKeys.cases.interventions(caseId),
  );
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.list());
  // The case's program enrollments (Step 2, Program Enrollments). Per MSWDO
  // practice the treatment plan anchors the services: an intervention is a
  // service rendered under one of these enrollments, so the dialog's program
  // select is scoped to them instead of re-listing the whole catalog.
  const { data: enrollments = [] } = useSWR<Array<{
    id: string; programId: string; programName: string; services?: string[];
  }>>(queryKeys.cases.enrollments(caseId));

  const [addOpen, setAddOpen] = useState(false);
  const EMPTY_FORM = {
    programId: '',
    interventionType: '',
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
  /** Open the dialog; when the case has enrollments, default to the first one
   *  so the worker lands on an enrolled program instead of an empty select.
   *  The default is applied by the effect below when the enrollment list
   *  arrives (SWR resolves after this handler runs). */
  function openAdd() {
    setAddOpen(true);
  }

  useEffect(() => {
    if (!addOpen || form.programId || enrollments.length === 0) return;
    setForm(prev => (prev.programId ? prev : { ...prev, programId: `enr:${enrollments[0].id}` }));
  }, [addOpen, enrollments, form.programId]);
  const [saving, setSaving] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const interventionNotNeeded = Boolean(caseData?.interventionNotNeeded);

  const { data: docs = [] } = useSWR<any[]>(
    caseId ? queryKeys.filing.byCase(caseId) : null,
  );
  const caseDocs = docs.filter((d: any) => !d.requirementKey);

  // Whether every required document of the linked programs is satisfied — this
  // step's own call into `interventionRequirementsMet`, over the two lists and
  // the checklist it already has, rather than a second copy of the rule. The
  // case view derives the same answer from the same shared function for the
  // stepper, so the three surfaces agree because they call one function, not
  // because one of them threads a value the others might not.
  const requirementsMet = useMemo(
    () => interventionRequirementsMet(interventions, programs || [], caseData?.requirementsChecklist),
    [interventions, programs, caseData?.requirementsChecklist],
  );

  /* The program the open dialog has selected, and the documents it will demand
     once saved. Hoisted out of `handleAdd` because the preview below and the
     write both need it, and two lookups that could disagree would show the
     worker one program while recording another. An ad-hoc service matches no
     program and so has no documents to preview.
     When the case has enrollments, the select's value is `enr:<enrollmentId>`
     and the effective program is the enrollment's program — the redundancy
     resolution: services are anchored to enrollments, not re-picked from the
     full catalog. Without enrollments (or after the recorded "not needed"
     decision) the legacy full-catalog fallback applies. */
  const selectedEnrollment = enrollments.find(e => form.programId === `enr:${e.id}`);
  const selectedProgram = programs.find(p => p.id === form.programId);
  const dialogProgram = selectedEnrollment
    ? programs.find(p => p.id === selectedEnrollment.programId) ?? null
    : (selectedProgram ?? null);
  const selectedDocKeys = dialogProgram ? requiredDocumentKeys(dialogProgram) : [];
  // The Program → Services matrix: a chosen (enrolled) program offers only its
  // own services (spec §6.2); no program / ad-hoc offers the whole catalog.
  const serviceOptions =
    (selectedEnrollment?.services && selectedEnrollment.services.length > 0)
      ? selectedEnrollment.services
      : (dialogProgram?.services && dialogProgram.services.length > 0)
        ? dialogProgram.services
        : [...INTERVENTION_TYPES];
  /* The scope the header's checklist is given: nothing selected means nothing
     to preview — the form is reset whenever the dialog closes, so this is empty
     for the whole of the dialog's closed life and the saved interventions are
     the only source of requirements then, each rendered inside its own card.
     Memoised because it reaches `CaseRequirements` as a prop: rebuilt on every
     render it would hand a fresh array each time and silently defeat a future
     `React.memo`. */
  const pendingProgramIds = useMemo(
    () => (dialogProgram ? [dialogProgram.id] : []),
    [dialogProgram],
  );

  // Document uploads stay available for eligible roles regardless of step
  // completion or closure — recording an intervention (readOnly) or closing the
  // case must not remove the ability to attach supporting evidence.
  const canUpload = Boolean(userRole && ['admin', 'social_worker', 'coordinator', 'claimant'].includes(userRole));

  async function handleAdd() {
    setSaving(true);
    try {
      const programId = form.programId?.startsWith('adhoc:')
        ? null
        : selectedEnrollment
          ? selectedEnrollment.programId
          : form.programId || null;
      const serviceName = dialogProgram?.name || form.serviceName;
      const category = dialogProgram?.category || form.category || undefined;
      await api.post(`/cases/${caseId}/interventions`, {
        programId,
        // Services are anchored to the case's program enrollment (the treatment
        // plan); the unenrolled fallback sends no enrollment.
        programEnrollmentId: selectedEnrollment ? selectedEnrollment.id : null,
        interventionType: form.interventionType || null,
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

  return (
    <div className="space-y-4">
      {/* One card, titled inside it the way every other card on this page is:
          icon, name and the step's seal state on one row, with the actions that
          complete this step beside the title they belong to. The title used to
          sit above the box, naming a card it was not in. Below a rule come the
          deliveries themselves, each carrying the documents its program demands
          — the checklist is no longer a block of its own — and the seal, being a
          statement about the whole step rather than a field of this record,
          stands below the card. The two mutually exclusive ways to complete step
          2 are in the title row: log a delivery, or record that none is issued. */}
      <section className="space-y-2">
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HandCoins size={16} className="text-primary" />
                {/* `h3`, like every card heading in all five steps: one heading
                    level for cards throughout the case view, so heading-by-heading
                    navigation does not jump a level here for no reason. */}
                <h3 className="text-sm font-semibold">{t('caseView.implement.toBeIssued', 'Intervention to be issued')}</h3>
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
          <Separator />
          {/* Renders nothing at all until a program is picked in the dialog
              above — scoped to the pending selection, so a saved program's
              documents show with their own entry below and are never repeated
              here. */}
          <CaseRequirements
            caseId={caseId}
            caseData={caseData}
            userRole={userRole}
            programIds={pendingProgramIds}
            readOnly={readOnly}
            embedded
          />
          {/* The record itself: every delivery this step has logged, each with
              the documents its own program demands. */}
          {interventions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {interventionNotNeeded
                ? t('caseView.implement.noInterventionsDecided', 'No intervention will be issued for this case. The service is covered by an inter-agency referral.')
                : t('caseView.implement.noInterventions', 'No interventions recorded yet. Click "Add Intervention" to document delivered services.')}
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {interventions.map(intv => {
                /* The program this card is about, and the documents it demands —
                   the same helper the checklist itself uses, so the guard below
                   cannot disagree with what would have rendered. An ad-hoc service
                   names no program, so there is nothing to list and no separator
                   to draw above it. */
                const reqKeys = intv.programId
                  ? requiredDocumentKeys(programs.find(p => p.id === intv.programId))
                  : [];
                return (
                  /* A delivered service is the substantive fact of this step, so it
                     carries the accent border and the larger type — the supporting
                     metadata stays quiet beneath it. The program's requirements are
                     part of that fact, so they are sections of this card rather than
                     a checklist somewhere else. */
                  <div key={intv.id} className="rounded-lg border border-primary/30 border-l-4 border-l-primary bg-primary/5">
                    <div className="px-4 py-3">
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
                    {reqKeys.length > 0 && (
                      <>
                        <Separator />
                        {/* Scoped to this card's program: two interventions from two
                            programs each list their own documents, and a document
                            both ask for stays one row in each because the checklist
                            is keyed on the requirement, not on the card. */}
                        <CaseRequirements
                          caseId={caseId}
                          caseData={caseData}
                          userRole={userRole}
                          programIds={[intv.programId as string]}
                          readOnly={readOnly}
                          embedded
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* The seal, below the card: a statement about the whole step rather
            than a field of the record above it. Its own predicate reads exactly
            what that card shows — the recorded interventions and their
            documents — so it sits against the evidence for enabling it instead
            of adrift at the bottom of the step. */}
        <StepLockBar
          caseId={caseId}
          stepKey="interventions"
          caseData={caseData}
          // The count comes from the list this card already renders, which is the
          // same row set the server counts.
          interventionCount={interventions.length}
          opts={{ requirementsMet }}
          locked={stepLock}
          readOnly={lockReadOnly}
          onChanged={() => globalMutate(queryKeys.cases.detail(caseId))}
        />
      </section>

      {/* Add-intervention modal — a delivery is a record with eight fields, so
          it is confirmed in a dialog the way the referral step already does,
          rather than expanded inline above the list it would push down. */}
      <Dialog open={addOpen} onOpenChange={(open) => (open ? openAdd() : closeAdd())}>
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
                onChange={e => setForm(f => ({ ...f, programId: e.target.value, interventionType: '' }))}
              >
                <option value="">
                  {t('caseView.implement.selectProgram', enrollments.length > 0 ? '— Select an enrolled program —' : '— Select a program —')}
                </option>
                {/* Per MSWDO practice the treatment plan anchors the services: the
                    select lists the case's ENROLLED programs (step 2) when any
                    exist — no redundant re-picking from the whole catalog. The
                    legacy full-catalog fallback applies only when there are no
                    enrollments (or the "no enrollment needed" decision was
                    recorded). */}
                {enrollments.length > 0 ? (
                  enrollments.map(e => (
                    <option key={e.id} value={`enr:${e.id}`}>{e.programName}</option>
                  ))
                ) : (
                  programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.requiredDocuments?.length ? ` (${p.requiredDocuments.length} ${t('caseView.implement.req', 'req.')})` : ''}</option>
                  ))
                )}
                <option value="adhoc:other">
                  {t('caseView.implement.otherService', 'Other service (specify)…')}
                </option>
              </select>
              {/* The checklist in the card behind this dialog lists the same
                  documents, but the modal's overlay hides it — so the select
                  says here what the choice will oblige the worker to, which is
                  the only moment at which it can still change their mind. */}
              {selectedDocKeys.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('caseView.implement.programDocsRequired', 'Requires: {{docs}}', { docs: selectedDocKeys.join(', ') })}
                </p>
              )}
              {enrollments.length === 0 && !caseData?.enrollmentsNotNeeded && (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {t('caseView.implement.noEnrollmentHint', 'This case has no program enrollment yet — the service will be recorded without one. Add enrollments in the Program Enrollments step to anchor services to a program.')}
                </p>
              )}
            </div>

            {!form.programId.startsWith('adhoc:') && form.programId && (
              <div className="space-y-1.5">
                <Label htmlFor="intv-service-type">{t('caseView.implement.serviceType', 'Service *')}</Label>
                <select
                  id="intv-service-type"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.interventionType}
                  onChange={e => setForm(f => ({ ...f, interventionType: e.target.value }))}
                >
                  <option value="">{t('caseView.implement.selectService', '— Select the service rendered —')}</option>
                  {serviceOptions.map((code) => (
                    <option key={code} value={code}>{t(`interventionType.${code}`, code)}</option>
                  ))}
                </select>
              </div>
            )}
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
            <Button onClick={handleAdd} disabled={saving || (!form.programId && !form.serviceName) || Boolean(form.programId && !form.programId.startsWith('adhoc:') && !form.interventionType)}>
              {saving ? t('caseView.saving', 'Saving...') : t('caseView.implement.saveIntervention', 'Save Intervention')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Progress note, visible even when readOnly so a worker who has already
          logged interventions (or recorded that none are needed) can see that
          this step is what the review gate asks for.

          It carries no control. This used to render a `ReviewButton` here, and
          two controls for one transition means one of them is a way around the
          rule: the server refuses `assessed -> in_review` until every step *due*
          at this position is sealed, and `CaseActionBar` is the control that
          carries that gate and its confirm dialog. A button here would be an
          ungated bypass around the whole feature. */}
      {(interventions.length > 0 || interventionNotNeeded) && caseData?.status === 'assessed' && userRole === 'social_worker' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-primary">{interventions.length > 0 ? t('caseView.implement.recorded', 'Interventions recorded') : t('caseView.implement.noInterventionRecorded', 'No intervention needed — referral-only case')}</p>
          <p className="text-xs text-muted-foreground">{t('caseView.implement.submitForReviewHint', 'Submit for admin review to activate the case.')}</p>
        </div>
      )}
    </div>
  );
}
