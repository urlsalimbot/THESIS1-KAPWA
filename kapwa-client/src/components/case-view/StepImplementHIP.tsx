import { useMemo, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useInterventionCatalog } from '@/hooks/useInterventionCatalog';
import { interventionRequirementsMet, requiredDocumentKeys } from '@/lib/case-progress';
import { INTERVENTION_TYPES, isFinancialIntervention, interventionFormLabel } from '@/lib/constants';
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
import { formatDate, formatPeso } from '../../lib/format';
import { humanizeError } from '@/lib/errors';
import { toastSaved } from '@/lib/toast';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  // The form obligation copied from the program matrix when the service was
  // logged (null for legacy rows and for services that oblige none).
  requiredForm?: string | null;
}

interface Program {
  id: string;
  name: string;
  category?: string;
  requiredDocuments?: string[];
  interventions?: string[];
  interventionForms?: Record<string, string>;
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

/** Select value for "this service belongs to no program" — the case rendered it
 *  on its own, so the payload carries no program anchors. */
const AD_HOC = 'adhoc';

export function StepImplementHIP({ caseId, caseData, userRole, readOnly, lockReadOnly = false, stepLock }: StepImplementHIPProps) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: interventions = [], mutate } = useSWR<Intervention[]>(
    queryKeys.cases.interventions(caseId),
  );
  const { data: programs = [] } = useSWR<Program[]>(queryKeys.programs.listAll());
  // The case's program enrollments (Step 2, Program Enrollments). Per MSWDO
  // practice the treatment plan anchors the services: an intervention is a
  // service rendered under one of these enrollments, so the dialog's program
  // select is scoped to them instead of re-listing the whole catalog.
  const { data: enrollments = [] } = useSWR<Array<{
    id: string; programId: string; programName: string; services?: string[]; status?: string;
  }>>(queryKeys.cases.enrollments(caseId));

  // Services an admin added locally: offerable on every case, with their own
  // label and money flag (the built-ins get both from the code + i18n).
  const { services: customServices } = useInterventionCatalog();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
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
  const adHoc = form.programId === AD_HOC;
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
  // because one of them threads a value the others might not. In crisis mode,
  // ad-hoc services (no program) additionally weigh their intervention-anchored
  // documentary minimums.
  const { data: crisisDocs = [] } = useSWR<any[]>(queryKeys.cases.interventionDocuments());
  const requirementsMet = useMemo(
    () => interventionRequirementsMet(interventions, programs || [], caseData?.requirementsChecklist, Boolean(caseData?.crisisMode), crisisDocs),
    [interventions, programs, caseData?.requirementsChecklist, caseData?.crisisMode, crisisDocs],
  );

  /* The program the open dialog has selected, and the documents it will demand
     once saved. Hoisted out of `handleAdd` because the preview below and the
     write both need it, and two lookups that could disagree would show the
     worker one program while recording another. The select's value is
     `enr:<enrollmentId>` and the effective program is the enrollment's program —
     an intervention is a service under a program ASSIGNED to this case, so
     there is no unenrolled or ad-hoc path. */
  const selectedEnrollment = enrollments.find(e => form.programId === `enr:${e.id}`);
  const dialogProgram = selectedEnrollment
    ? programs.find(p => p.id === selectedEnrollment.programId) ?? null
    : null;
  const selectedDocKeys = dialogProgram ? requiredDocumentKeys(dialogProgram) : [];
  // The Program → Services matrix: a chosen (enrolled) program offers only its
  // own services (spec §6.2); a program with no service rows (a local custom
  // one) offers the whole catalog.
  const serviceOptions =
    (selectedEnrollment?.services && selectedEnrollment.services.length > 0)
      ? selectedEnrollment.services
      : (dialogProgram?.interventions && dialogProgram.interventions.length > 0)
        ? dialogProgram.interventions
        : [...INTERVENTION_TYPES];
  const customByCode = new Map(
    customServices.filter(s => s.isActive).map(s => [s.code, s] as const),
  );
  // Local services are global: they follow whatever the program's matrix offers.
  const offerableServices = [...new Set([...serviceOptions, ...customByCode.keys()])];
  // A non-financial service renders no money: amount, mode and fund source are
  // financial-form fields and disappear with the service choice that made them
  // irrelevant.
  const financial = isFinancialIntervention(form.interventionType)
    || customByCode.get(form.interventionType)?.isFinancial === true;
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
      // Only an enrollment-anchored service may be recorded — an intervention
      // is a service under a program ASSIGNED to this case. The program list
      // here is active-only, so a deactivated program resolves to null: say so
      // instead of failing silently (audit 3.2.1).
      if (!adHoc && (!selectedEnrollment || !dialogProgram)) {
        setSaving(false);
        toast.error(
          t('caseView.implement.noActiveProgram', 'This program is no longer active — reactivate it to record interventions.'),
        );
        return;
      }
      if (adHoc && !form.serviceName.trim()) {
        setSaving(false);
        toast.error(t('caseView.implement.serviceNameRequired', 'Enter the name of the service rendered.'));
        return;
      }
      // The label the operator picked, not the programme's name: a programme
      // can render many services, and the saved row (and the access card it
      // auto-logs) must say which one was delivered.
      const serviceName = adHoc
        ? form.serviceName.trim()
        : t(
            `interventionType.${form.interventionType}`,
            customByCode.get(form.interventionType)?.label ?? form.interventionType ?? dialogProgram!.name,
          );
      const category = adHoc ? (form.category || undefined) : (dialogProgram!.category || form.category || undefined);
      await api.post(`/cases/${caseId}/interventions`, {
        // An ad-hoc service carries no program anchors: the server records it
        // against the case alone and demands no program documents.
        ...(adHoc ? {} : {
          programId: selectedEnrollment!.programId,
          programEnrollmentId: selectedEnrollment!.id,
        }),
        interventionType: form.interventionType || null,
        serviceName,
        category,
        deliveryDate: form.deliveryDate || null,
        amount: form.amount ? parseFloat(form.amount) : null,        modeOfDelivery: form.modeOfDelivery || null,
        fundSource: form.fundSource || null,
        notes: form.notes || null,
      });
      await mutate();
      closeAdd();
      toastSaved(t('caseView.implement.added', 'Intervention recorded'));
      // The requirements checklist is derived from the interventions of this
      // case, so a newly logged delivery changes which documents step 2 asks
      // for — revalidate the detail or the checklist stays one step behind.
      await globalMutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to add intervention:', e);
      toast.error(t('caseView.implement.addFailed', 'Could not record the intervention'), { description: humanizeError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.del(`/cases/${caseId}/interventions/${id}`);
      await mutate();
      toastSaved(t('caseView.implement.deleted', 'Intervention removed'));
    } catch (e) {
      console.error('Failed to delete intervention:', e);
      toast.error(t('caseView.implement.deleteFailed', 'Could not remove the intervention'), { description: humanizeError(e) });
    }
  }

  async function saveDecision(notNeeded: boolean) {
    setSavingDecision(true);
    try {
      await api.patch(`/cases/${caseId}/intervention-decision`, { notNeeded });
      await globalMutate(queryKeys.cases.detail(caseId));
      await globalMutate(queryKeys.cases.list());
      toastSaved(notNeeded
        ? t('caseView.implement.interventionsNeeded', 'Interventions required again')
        : t('caseView.implement.noInterventionNeeded', 'Recorded: no intervention needed'));
    } catch (e) {
      toast.error(t('caseView.implement.interventionDecisionFailed', 'Could not save the intervention decision'), {
        description: humanizeError(e),
      });
    } finally {
      setSavingDecision(false);
    }
  }

  // Summed in centavos: floats display as ₱3,703.6799999999994 for three
// ₱1,234.56 amounts, which is money on screen that nobody can reconcile.
  const totalAmount = interventions.reduce((cents, i) => cents + Math.round((Number(i.amount) || 0) * 100), 0) / 100;

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
                  <Badge variant="outline" className="gap-1 text-xs">
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
                            {intv.category && <Badge variant="secondary" className="text-xs">{intv.category}</Badge>}
                            {intv.amount != null && intv.amount !== ('' as unknown) && (
                              <span className="text-base font-semibold tabular-nums text-primary">
                                {formatPeso(Number(intv.amount))}
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
                          {intv.notes && <p className="text-sm text-muted-foreground mt-1">{intv.notes}</p>}
                          {/* The form obligation is recorded on the row (copied
                              from the program matrix at logging time), so it
                              renders on the saved card too — it used to exist
                              only inside the Add dialog (audit 3.2.4). */}
                          {intv.requiredForm && (
                            <p className="mt-1 text-xs font-medium text-primary">
                              {t('caseView.implement.requiredFormHint', 'Must accomplish: {{form}}', {
                                form: interventionFormLabel(intv.requiredForm, t),
                              })}
                            </p>
                          )}
                        </div>
                        {!readOnly && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(intv.id)} aria-label={t('caseView.implement.deleteIntervention', 'Delete intervention')}>
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
              <Select
                value={form.programId}
                onValueChange={(v) => setForm(f => ({ ...f, programId: v, interventionType: '' }))}
              >
                <SelectTrigger id="intv-program">
                  <SelectValue placeholder={t('caseView.implement.selectProgram', '— Select an enrolled program —')} />
                </SelectTrigger>
                <SelectContent>
                {/* An intervention is a service under a program ASSIGNED to this
                    case (the treatment plan): the select lists the case's
                    enrollments — A–Z by program name — and nothing else, no
                    re-picking from the whole catalog, no ad-hoc service. */}
                {enrollments
                  // Only a live enrollment can take a new service: a completed
                  // or withdrawn program is history (audit 3.2.7).
                  .filter((e) => (e.status ?? 'active') === 'active')
                  .sort((a, b) => a.programName.localeCompare(b.programName))
                  .map(e => (
                    <SelectItem key={e.id} value={`enr:${e.id}`}>{e.programName}</SelectItem>
                  ))}
                {/* A service the case rendered without a program — a medical
                    mission, donated goods. It needs a name, not an enrollment. */}
                <SelectItem value={AD_HOC}>
                  {t('caseView.implement.adHocOption', 'Not under a program (ad-hoc service)')}
                </SelectItem>
                </SelectContent>
              </Select>
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
                  {t('caseView.implement.noEnrollmentHint', 'This case has no program enrollment yet — record the service as an ad-hoc intervention below, or add enrollments in the Program Enrollments step to anchor it to a program.')}
                </p>
              )}
            </div>

            {adHoc && (
              <div className="space-y-1.5">
                <Label htmlFor="intv-service-name">{t('caseView.implement.serviceName', 'Service Name *')}</Label>
                <Input
                  id="intv-service-name"
                  value={form.serviceName}
                  onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                  placeholder={t('caseView.implement.serviceNamePlaceholder', 'e.g., Counseling Session, Home Visit')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('caseView.implement.adHocHint', 'Recorded against this case only — no program, and no program documents required.')}
                </p>
              </div>
            )}

            {form.programId && (
              <div className="space-y-1.5">
                <Label htmlFor="intv-service-type">
                  {adHoc
                    ? t('caseView.implement.serviceTypeOptional', 'Service type (optional)')
                    : t('caseView.implement.serviceType', 'Service *')}
                </Label>
                <Select
                  value={form.interventionType}
                  onValueChange={(v) => setForm(f => {
                    const next = { ...f, interventionType: v };
                    // A service that carries no money leaves the financial half
                    // of the form behind — including whatever was typed into it.
                    if (next.interventionType && !isFinancialIntervention(next.interventionType)) {
                      next.amount = '';
                      next.modeOfDelivery = '';
                      next.fundSource = '';
                    }
                    return next;
                  })}
                >
                  <SelectTrigger id="intv-service-type">
                    <SelectValue placeholder={t('caseView.implement.selectService', '— Select the service rendered —')} />
                  </SelectTrigger>
                  <SelectContent>
                  {/* Alphabetical, whatever the source order (enrollment services,
                      program services or the full catalog). */}
                  {[...offerableServices].sort((a, b) =>
                    t(`interventionType.${a}`, customByCode.get(a)?.label ?? a)
                      .localeCompare(t(`interventionType.${b}`, customByCode.get(b)?.label ?? b)),
                  ).map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`interventionType.${code}`, customByCode.get(code)?.label ?? code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            )}

            {form.interventionType === 'referral_pao' && (
              <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                {t('caseView.implement.referralAutoLink', 'Saving this also records the inter-agency referral to the Public Attorney’s Office — it will be ready in Inter-agency Referrals.')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="intv-delivery-date">{t('caseView.implement.deliveryDate', 'Delivery Date')}</Label>
                <Input id="intv-delivery-date" type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
              {financial && (
                <div className="space-y-1.5">
                  <Label htmlFor="intv-amount">{t('caseView.implement.amount', 'Amount (₱)')}</Label>
                  <Input id="intv-amount" type="text" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1') }))} />
                </div>
              )}
            </div>

            {/* The program's configured obligation: this intervention must be
                accomplished on the specific form format. */}
            {dialogProgram?.interventionForms?.[form.interventionType] && (
              <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                {t('caseView.implement.requiredFormHint', 'Must accomplish: {{form}}', {
                  form: interventionFormLabel(dialogProgram.interventionForms[form.interventionType], t),
                })}
              </p>
            )}

            {/* The financial half of the form exists only for services that
                carry money or in-kind value — the non-financial services omit
                it entirely (and the server strips it if anyone still sends
                it). */}
            {financial && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="intv-mode">{t('caseView.implement.modeOfDeliveryLabel', 'Mode of Delivery')}</Label>
                  <Select value={form.modeOfDelivery} onValueChange={v => setForm(f => ({ ...f, modeOfDelivery: v }))}>
                    <SelectTrigger id="intv-mode">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                    {[
                      { value: 'Cash', label: t('caseView.implement.modeOfDelivery.cash', 'Cash') },
                      { value: 'Cheque', label: t('caseView.implement.modeOfDelivery.cheque', 'Cheque') },
                      { value: 'Guarantee Letter', label: t('caseView.implement.modeOfDelivery.guaranteeLetter', 'Guarantee Letter') },
                      { value: 'In-kind', label: t('caseView.implement.modeOfDelivery.inKind', 'In-kind') },
                      { value: 'Service', label: t('caseView.implement.modeOfDelivery.service', 'Service') },
                    ].map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="intv-fund">{t('caseView.implement.fundSourceLabel', 'Fund Source')}</Label>
                  <Select value={form.fundSource} onValueChange={v => setForm(f => ({ ...f, fundSource: v }))}>
                    <SelectTrigger id="intv-fund">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                    {[
                      { value: 'DSWD', label: t('caseView.implement.fundSource.dswd', 'DSWD') },
                      { value: 'LGU', label: t('caseView.implement.fundSource.lgu', 'LGU') },
                      { value: 'PDAF', label: t('caseView.implement.fundSource.pdaf', 'PDAF') },
                      { value: 'Donation', label: t('caseView.implement.fundSource.donation', 'Donation') },
                      { value: 'Other', label: t('caseView.implement.fundSource.other', 'Other') },
                    ].map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="intv-notes">{t('caseView.implement.notes', 'Notes')}</Label>
              <Textarea
                id="intv-notes"
                className="min-h-[60px]"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('caseView.implement.notesPlaceholder', 'Additional details about this intervention...')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>{t('caseView.cancel', 'Cancel')}</Button>
            <Button onClick={handleAdd} disabled={saving || (!adHoc && (!selectedEnrollment || !form.interventionType))}>
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
      {/* Destructive removal needs the confirm — an intervention row is a
          delivered service on record. */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('caseView.implement.deleteTitle', 'Delete this intervention?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('caseView.implement.deleteHint', 'The intervention and its documentary requirements will be removed from this case. This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.remove', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
