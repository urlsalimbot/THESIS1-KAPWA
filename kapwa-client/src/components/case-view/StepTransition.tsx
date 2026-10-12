import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/errors';
import { toastSaved } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Calendar, FileText, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isSelfSufficient } from '@/lib/self-reliance';
import { formatDate } from '../../lib/format';
import { StepLockBar, type StepLock } from './StepLockBar';
import { stepsInPhase, STEP_LABEL_KEYS } from './CaseStepper';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface FollowUpVisit {
  date: string;
  type: string;
  notes: string;
  outcome: string;
}

interface ScheduledVisit {
  id: string;
  eventType: string;
  eventDate: string;
  startTime?: string | null;
  notes?: string | null;
  status: string;
}

interface StepTransitionProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  readOnly?: boolean;
  /** This step's own seal row, or null — the case view resolves it. */
  stepLock?: StepLock | null;
  /**
   * Whether this step may still be sealed/released, kept apart from the actions'
   * `readOnly`: a sealed step's plan and follow-up visits are read-only
   * *because* of the seal, so folding that into the same flag would hide the one
   * control that lifts it. Defaults to `false`, so omitting it can never hide a
   * sealed step's Unlock; a caller that wants the seal control withheld passes
   * `true`.
   */
  lockReadOnly?: boolean;
}

export function StepTransition({ caseId, caseData, userRole, readOnly, lockReadOnly = false, stepLock }: StepTransitionProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState({
    selfRelianceLevel: caseData?.selfRelianceLevel || null,
    sustainabilityPlan: caseData?.sustainabilityPlan || '',
    transitionDate: caseData?.transitionDate || '',
    selfReliancePlan: caseData?.selfReliancePlan || '',
  });

  const [followUps, setFollowUps] = useState<FollowUpVisit[]>(
    (caseData?.followUpVisits || []) as FollowUpVisit[]
  );

  const [newFollowUp, setNewFollowUp] = useState({
    date: '',
    type: '',
    notes: '',
    outcome: '',
  });

  const [addingFollowUp, setAddingFollowUp] = useState(false);

  function addFollowUp() {
    if (!newFollowUp.date || !newFollowUp.type) return;
    setFollowUps(prev => [...prev, { ...newFollowUp }]);
    setNewFollowUp({ date: '', type: '', notes: '', outcome: '' });
    setAddingFollowUp(false);
  }

  function removeFollowUp(index: number) {
    setFollowUps(prev => prev.filter((_, i) => i !== index));
  }

  // --- Scheduled home visits (planned `case_events` rows) ---
  const { data: caseEvents, mutate: mutateEvents } = useSWR<ScheduledVisit[]>(
    queryKeys.cases.events(caseId),
  );
  const [addingScheduled, setAddingScheduled] = useState(false);
  const [newScheduled, setNewScheduled] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: '',
    notes: '',
  });
  const scheduled = (Array.isArray(caseEvents) ? caseEvents : [])
    .filter((e) => e.eventType === 'home_visit' && e.status === 'planned');

  async function scheduleVisit() {
    if (!newScheduled.date) return;
    try {
      await api.post(`/cases/${caseId}/events`, {
        eventType: 'home_visit',
        eventDate: newScheduled.date,
        startTime: newScheduled.time || undefined,
        notes: newScheduled.notes || undefined,
      });
      toast.success(t('caseView.transition.visitScheduled', 'Home visit scheduled'));
      setNewScheduled({ date: new Date().toISOString().slice(0, 10), time: '', notes: '' });
      setAddingScheduled(false);
      await mutateEvents();
    } catch (e) {
      toast.error(t('caseView.transition.visitScheduleFailed', 'Could not schedule the visit'), { description: humanizeError(e) });
    }
  }

  async function completeScheduled(id: string) {
    try {
      await api.patch(`/cases/${caseId}/events/${id}`, { status: 'done' });
      await mutateEvents();
      toastSaved(t('caseView.transition.visitCompleted', 'Visit marked complete'));
    } catch (e) {
      toast.error(t('caseView.transition.visitCompleteFailed', 'Could not complete the visit'), { description: humanizeError(e) });
    }
  }

  async function cancelScheduled(id: string) {
    try {
      await api.patch(`/cases/${caseId}/events/${id}`, { status: 'cancelled' });
      await mutateEvents();
      toastSaved(t('caseView.transition.visitCancelled', 'Visit cancelled'));
    } catch (e) {
      toast.error(t('caseView.transition.visitCancelFailed', 'Could not cancel the visit'), { description: humanizeError(e) });
    }
  }

  // Throws on failure: the seal bar reports it and leaves the step unsealed.
  async function handleSave() {
    setSaving(true);
    try {
      // A sealed step 4 sends only the follow-up visits. Sending the assessment
      // alongside them would make the server's guard refuse the whole body — the
      // guard judges the keys the body carries, not which card they came from — so
      // the visits would be unsaveable too. The assessment is on screen unchanged
      // and is simply not part of this write.
      const body = stepLock != null
        ? { followUpVisits: followUps.length > 0 ? followUps : null }
        : {
            selfRelianceLevel: plan.selfRelianceLevel,
            sustainabilityPlan: plan.sustainabilityPlan || null,
            transitionDate: plan.transitionDate || null,
            selfReliancePlan: plan.selfReliancePlan || null,
            followUpVisits: followUps.length > 0 ? followUps : null,
          };
      await api.patch(`/cases/${caseId}/transition-plan`, body);
      await mutate(queryKeys.cases.detail(caseId));
    } finally {
      setSaving(false);
    }
  }

  // The self-reliance assessment is what step 4's seal claims, so a seal freezes
  // it. The follow-up visits below are not: they are ongoing progress monitoring
  // that keeps accruing after the assessment is done, they are in no step's
  // done-predicate, and the server's `CASE_STEP_UNGUARDED_FIELDS` deliberately
  // lets a body carrying only them past a sealed step 4. The two are therefore
  // separate read-only signals — folding the seal into the visits would put the
  // client and the server at odds and would contradict the comment at the mount.
  //
  // The seal is read from `stepLock` here rather than arriving folded into
  // `readOnly`, which is what makes the two separable at all: by the time this
  // component runs, a sealed step's `readOnly` is true and indistinguishable from
  // a closed case's.
  const assessmentReadOnly = Boolean(readOnly) || stepLock != null;
  const visitsReadOnly = Boolean(readOnly);

  const selfSufficient = isSelfSufficient(plan.selfRelianceLevel);

  return (
    <div className="space-y-4">
      {/* Step 4 guide — the self-reliance level decides renewal vs closure. */}
      <div className={`rounded-lg border px-4 py-3 text-sm ${selfSufficient ? 'border-success/35 bg-alert-success-bg text-success-foreground' : 'border-warning/35 bg-alert-error-bg text-warning-foreground'}`}>
        {selfSufficient
          ? t('caseView.transition.selfSufficient', 'Self-sufficient — proceed to Closure.')
          : t('caseView.transition.notSelfSufficient', 'Not self-sufficient — subject to case renewal.')}
      </div>
      {/* Self-Reliance Assessment */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.transition.selfRelianceAssessment', 'Self-Reliance Assessment')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.transition.selfRelianceLevel', 'Self-Reliance Level *')}</label>
            <RadioGroup
              value={plan.selfRelianceLevel == null ? '' : String(plan.selfRelianceLevel)}
              onValueChange={(v) => setPlan(p => ({ ...p, selfRelianceLevel: Number(v) }))}
              className="space-y-2"
              disabled={assessmentReadOnly}
            >
              {[
                { value: 1, label: t('caseView.transition.level1', 'Level 1 - Dependent'), description: t('caseView.transition.level1Desc', 'Needs full support and assistance') },
                { value: 2, label: t('caseView.transition.level2', 'Level 2 - Partially Self-Reliant'), description: t('caseView.transition.level2Desc', 'Some support needed, making progress') },
                { value: 3, label: t('caseView.transition.level3', 'Level 3 - Self-Sufficient'), description: t('caseView.transition.level3Desc', 'Ready for graduation, can sustain independently') },
              ].map(option => (
                <label key={option.value} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <RadioGroupItem
                    value={String(option.value)}
                    className="mt-0.5"
                    aria-label={option.label}
                  />
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>

      {/* Sustainability Plan */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.transition.sustainabilityPlan', 'Sustainability Plan')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.transition.maintainProgress', 'How will the client maintain progress after case closure?')}</label>
            <Textarea
              className="min-h-[100px]"
              value={plan.sustainabilityPlan}
              onChange={e => setPlan(p => ({ ...p, sustainabilityPlan: e.target.value }))}
              disabled={assessmentReadOnly}
              placeholder={t('caseView.transition.sustainabilityPlaceholder', "Describe the client's plan for sustaining improvements independently...")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.transition.selfRelianceSteps', 'Self-Reliance Steps')}</label>
              <Textarea
                className="min-h-[80px]"
                value={plan.selfReliancePlan}
                onChange={e => setPlan(p => ({ ...p, selfReliancePlan: e.target.value }))}
                disabled={assessmentReadOnly}
                placeholder={t('caseView.transition.selfRelianceStepsPlaceholder', 'Recommendations for skills training, livelihood programs...')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.transition.targetTransitionDate', 'Target Transition Date')}</label>
              <Input
                type="date"
                value={plan.transitionDate}
                onChange={e => setPlan(p => ({ ...p, transitionDate: e.target.value }))}
                disabled={assessmentReadOnly}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Visits */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('caseView.transition.followUpVisits', 'Follow-up Visits')}</h3>
          {!visitsReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setAddingFollowUp(!addingFollowUp)}>
              <Plus size={14} className="mr-1" /> {t('caseView.transition.addVisit', 'Add Visit')}
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {/* Add Visit Form */}
          {addingFollowUp && (
            <div className="grid grid-cols-2 gap-2 text-sm p-2 border rounded-md bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.date', 'Date *')}</label>
                <Input
                  type="date"
                  value={newFollowUp.date}
                  onChange={e => setNewFollowUp(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.type', 'Type *')}</label>
                <Select
                  value={newFollowUp.type}
                  onValueChange={v => setNewFollowUp(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                    { value: 'Home Visit', label: t('caseView.transition.visitType.home', 'Home Visit') },
                    { value: 'Phone Call', label: t('caseView.transition.visitType.phone', 'Phone Call') },
                    { value: 'Office Visit', label: t('caseView.transition.visitType.office', 'Office Visit') },
                    { value: 'Community Visit', label: t('caseView.transition.visitType.community', 'Community Visit') },
                  ].map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">{t('caseView.transition.notes', 'Notes')}</label>
                <Textarea
                  className="min-h-[60px]"
                  value={newFollowUp.notes}
                  onChange={e => setNewFollowUp(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('caseView.transition.notesPlaceholder', 'Visit notes...')}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">{t('caseView.transition.outcome', 'Outcome')}</label>
                <Input
                  value={newFollowUp.outcome}
                  onChange={e => setNewFollowUp(f => ({ ...f, outcome: e.target.value }))}
                  placeholder={t('caseView.transition.outcomePlaceholder', 'e.g., On track, Needs additional support')}
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={addFollowUp} disabled={!newFollowUp.date || !newFollowUp.type}>
                  {t('caseView.transition.add', 'Add')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingFollowUp(false)}>
                  {t('caseView.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Visit List */}
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {t('caseView.transition.noFollowUps', 'No follow-up visits recorded yet.')}
            </p>
          ) : (
            followUps.map((visit, i) => (
              <div key={i} className="flex items-start justify-between p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="font-medium">
                      {formatDate(visit.date)}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>{visit.type}</span>
                  </div>
                  {visit.notes && (
                    <p className="text-xs text-muted-foreground">{visit.notes}</p>
                  )}
                  {visit.outcome && (
                    <p className="text-xs text-primary">{t('caseView.transition.outcomeLabel', 'Outcome: {{outcome}}', { outcome: visit.outcome })}</p>
                  )}
                </div>
                {!visitsReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeFollowUp(i)}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scheduled Home Visits — planned `case_events` rows, distinct from the
          history ledger above. A planned visit syncs to the assigned worker's
          calendar and drives reminders; completing it marks the event done and
          the calendar block is removed. The history stays its own ledger. */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('caseView.transition.scheduledVisits', 'Scheduled Home Visits')}</h3>
          {!visitsReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setAddingScheduled(!addingScheduled)}>
              <Plus size={14} className="mr-1" /> {t('caseView.transition.scheduleVisit', 'Schedule Home Visit')}
            </Button>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {addingScheduled && (
            <div className="grid grid-cols-2 gap-2 text-sm p-2 border rounded-md bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.visitDate', 'Visit Date *')}</label>
                <Input
                  type="date"
                  aria-label={t('caseView.transition.visitDate', 'Visit Date *')}
                  value={newScheduled.date}
                  onChange={e => setNewScheduled(s => ({ ...s, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('caseView.transition.visitTime', 'Time')}</label>
                <Input
                  type="time"
                  aria-label={t('caseView.transition.visitTime', 'Time')}
                  value={newScheduled.time}
                  onChange={e => setNewScheduled(s => ({ ...s, time: e.target.value }))}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">{t('caseView.transition.notes', 'Notes')}</label>
                <Input
                  value={newScheduled.notes}
                  onChange={e => setNewScheduled(s => ({ ...s, notes: e.target.value }))}
                  placeholder={t('caseView.transition.notesPlaceholder', 'Visit notes...')}
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={scheduleVisit} disabled={!newScheduled.date}>
                  {t('caseView.transition.saveVisit', 'Save Visit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingScheduled(false)}>
                  {t('caseView.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}

          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {t('caseView.transition.scheduledEmpty', 'No home visits scheduled.')}
            </p>
          ) : (
            scheduled.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 p-2 rounded border bg-muted/30">
                <div className="space-y-1 text-sm min-w-0">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="font-medium">{formatDate(ev.eventDate)}</span>
                    {ev.startTime && (<><span className="text-muted-foreground">·</span><span>{String(ev.startTime).slice(0, 5)}</span></>)}
                  </div>
                  {ev.notes && <p className="text-xs text-muted-foreground">{ev.notes}</p>}
                </div>
                {!visitsReadOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => completeScheduled(ev.id)}>
                      {t('caseView.transition.completeVisit', 'Complete')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => cancelScheduled(ev.id)}>
                      {t('caseView.transition.cancelVisit', 'Cancel Visit')}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Follow-up visits keep a Save of their own, and only a sealed step needs
          one: while the step is open the seal bar below is the plan's submit, and
          once it is sealed the bar offers Unlock instead. The visits cannot ride
          on that seal — they are in no step's done-predicate and the server's
          `CASE_STEP_UNGUARDED_FIELDS` deliberately lets a visits-only body past a
          sealed step 4 — so sealing the plan must not be what stops one being
          recorded. */}
      {stepLock != null && !visitsReadOnly && (
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              // The bar owns the plan and handles its own failures; this control
              // is the one write with no bar behind it, so it reports both halves
              // itself rather than leaving a rejection unhandled.
              try {
                await handleSave();
                toastSaved(t('caseView.transition.visitsSaved', 'Follow-up visits saved'));
              } catch (e) {
                toast.error(t('caseView.transition.saveFailed', 'Could not save the follow-up visits'), { description: humanizeError(e) });
              }
            }}
            disabled={saving}
          >
            {saving ? t('caseView.saving', 'Saving...') : t('caseView.transition.saveVisits', 'Save Follow-up Visits')}
          </Button>
        </div>
      )}

      {/* Status transition */}
      {caseData?.status === 'active' && userRole === 'admin' && (
        <div className="rounded-lg border bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{t('caseView.transition.planReady', 'Transition plan ready')}</p>
              <p className="text-xs text-muted-foreground">{t('caseView.transition.planReadyHint', 'Mark case as transitioning to begin graduation process.')}</p>
            </div>
            <TransitionButton caseId={caseId} caseData={caseData} mutate={mutate} />
          </div>
        </div>
      )}

      {/* Step 4's seal. `lockReadOnly`, so a sealed step keeps its Unlock even
          though its plan is read-only. This is the step's submit: it saves the
          plan (and any follow-up visits added since the last write) and seals it. */}
      <StepLockBar
        caseId={caseId}
        stepKey="evaluate"
        caseData={{ ...caseData, ...plan }}
        interventionCount={0}
        locked={stepLock}
        readOnly={lockReadOnly}
        onBeforeLock={handleSave}
        onChanged={() => mutate(queryKeys.cases.detail(caseId))}
      />
    </div>
  );
}

function TransitionButton({ caseId, caseData, mutate }: { caseId: string; caseData: any; mutate: any }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  /**
   * The Implementation phase's gate — the client half of `assertStepsSealed` on
   * `active -> transitioning`. Reads `stepsInPhase(…, 'implementation')`, the
   * same phase-filtered set the server asks for, so the two cannot disagree:
   * interventions, referrals and court hearings, each floored at ≤ `active` and
   * therefore each sealable here. Deliberately *not* `stepsDueAt('active')` —
   * that set also holds `evaluate`, which is Phase-Out work owed before `closed`.
   *
   * Deliberately NOT exempting `admin`, unlike the review and close gates: the
   * server exempts admin from those because a case must be able to move at all,
   * but `CASE_FSM_ROLES[ACTIVE]` is empty, so this edge admits `admin` and
   * nobody else. Exempting the only role that can take it would gate nobody —
   * which is why the button names the open steps rather than greying out
   * silently and letting the caller meet a 400.
   */
  const openSteps = stepsInPhase(caseData?.caseCategory, 'implementation')
    .filter((key) => !((caseData?.stepLocks ?? []) as StepLock[]).some((l) => l?.stepKey === key));

  async function handleTransition() {
    setLoading(true);
    try {
      await api.patch(`/cases/${caseId}/disburse`, { status: 'transitioning' });
      await mutate(queryKeys.cases.detail(caseId));
      toastSaved(t('caseView.transition.markedTransitioning', 'Case marked ready for graduation'));
    } catch (e) {
      console.error('Failed to transition:', e);
      toast.error(t('caseView.transition.markFailed', 'Could not mark the case ready for graduation'), { description: humanizeError(e) });
    } finally {
      setLoading(false);
    }
  }

  const label = loading
    ? t('caseView.processing', 'Processing...')
    : t('caseView.transition.markReady', '→ Mark Ready for Graduation');

  if (openSteps.length > 0) {
    const names = openSteps.map((k) => STEP_LABEL_KEYS[k]?.fallback ?? k).join(', ');
    return (
      <div className="space-y-1.5">
        <Button onClick={handleTransition} disabled size="sm">{label}</Button>
        <p className="text-xs text-destructive">
          {t('caseView.transition.lockStepsFirst', 'Lock these steps before transitioning: {{steps}}', { steps: names })}
        </p>
      </div>
    );
  }

  return (
    <Button onClick={handleTransition} disabled={loading} size="sm">{label}</Button>
  );
}
