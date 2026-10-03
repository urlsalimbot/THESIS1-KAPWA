import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Extra data the case view has (programs docs, referral decision) but the
// approval-pipeline cards do not — steps 1/2 fall back to their simple checks
// when these are absent so the pipeline cards keep working.
export interface StepperProgressOpts {
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
  interventionNotNeeded?: boolean;
  /**
   * How many `inter_agency_referrals` rows the case has, as the case detail
   * endpoint stamps it — the same unscoped count the server's seal weighs.
   *
   * Not the length of the caller-scoped `GET /inter-agency-referrals/case/:caseId`
   * list: that list is scoped by agency for display, and a worker whose agency is
   * not on a referral would see 0 and could never seal step 2 while the server
   * would have accepted the seal. Not `case.referrals` either — that is the
   * transition plan's agency list over `case_referrals`, which the referral
   * letter never writes. Absent means zero, the honest answer for a surface with
   * no count to offer.
   */
  interAgencyReferralCount?: number;
}

// Lifecycle position of each status, ascending — the order the FSM moves in.
export const STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5,
};

/**
 * Minimum lifecycle position at which a step may be considered "done". Steps 3
 * (Evaluate Help Given) and 4 (Case Study & Closure) are Phase-Out work: prefilled
 * data on an earlier-status case must not make them look complete.
 *
 * Exported because `stepsDueAt` below is read by `CaseActionBar`, which has to
 * ask the same question the server's `assessed -> in_review` gate asks. The
 * server derives it from its own copy in `case-step-labels.ts`; this is the
 * client half of that pair, and both read a floor array rather than a hand-typed
 * list of step numbers — `case-step-done-fixture.json` is what keeps the floor
 * honest for the done-predicate, and `CaseActionBar.test.tsx` for this.
 */
export const STEP_MIN_STATUS = [0, 0, 0, 3, 4];

/**
 * The steps that are *due* at a lifecycle position: the Phase-In and
 * Implementation work that exists once a case has reached that far.
 *
 * The `assessed -> in_review` gate asks for these, not for all five. Requiring
 * all five meant the gate could never be satisfied by the role it exists for: it
 * fires at status index 1, while steps 3 and 4 are floored at `active`(3) and
 * `transitioning`(4) — so their Lock buttons are disabled in the UI and the seal
 * endpoint rejects them with a 400. A social worker could never flag a case for
 * admin review, which is the one thing the button is for. (The server had
 * exactly this bug and fixed it in `5964197`; this is the client half.)
 *
 * Derived from `STEP_MIN_STATUS` rather than listed separately, which is the
 * point: the set a gate demands is by construction the set the seal endpoint will
 * accept, so "you have not sealed enough" cannot name a step that cannot be
 * sealed. An unknown or missing status is treated as position 0 — before the
 * first step — so it asks for the Phase-In work rather than waving a case
 * through, matching the server's `stepsDueAt`.
 */
export function stepsDueAt(status: string | null | undefined): number[] {
  const index = (status == null ? undefined : STATUS_INDEX[status]) ?? 0;
  return STEP_MIN_STATUS
    .map((min, stepIndex) => ({ min, stepIndex }))
    .filter(({ min }) => min <= index)
    .map(({ stepIndex }) => stepIndex);
}

/**
 * The five step labels, in step order, as i18n keys with their English fallbacks.
 *
 * The stepper renders these through `t`, and `CaseActionBar` needs the same
 * names to tell a worker *which* steps are still open. A literal list of five
 * strings in each file would be two copies of one vocabulary — and the server's
 * own rejection message spells them a third way (`CASE_STEP_LABELS`). Keys are
 * the shared part: every caller goes through `t`, so both surfaces say the same
 * word in both languages.
 */
export const STEP_LABEL_KEYS = [
  { key: 'caseView.stepper.assessment', fallback: 'Assess & Interview' },
  { key: 'caseView.stepper.implementHip', fallback: 'Intervention & Requirements' },
  { key: 'caseView.stepper.serviceDelivery', fallback: 'Inter-agency Referrals' },
  { key: 'caseView.stepper.transition', fallback: 'Evaluate Help Given' },
  { key: 'caseView.stepper.closure', fallback: 'Case Study & Closure' },
] as const;

// Step 1 (Intervention & Requirements) is the step that *submits* an assessed
// case for review, so its completion must not itself require a later status —
// gating it on status >= in_review made "Submit for Review" unreachable and
// trapped assessed cases. Steps 3-4 still require their Phase-Out status.
const STEP_STATUS_INDEPENDENT = new Set([0, 1]);

function statusAtLeast(caseData: any, min: number): boolean {
  const status = caseData?.status;
  const index = status == null ? undefined : STATUS_INDEX[status];
  // Unknown/missing status (e.g. a partial payload) does not cap the step.
  if (index === undefined) return true;
  return index >= min;
}

// Shared done-status per stepper step — reused by the case view stepper, the
// approval pipeline cards and the step-lock bar so all three agree.
//
// The two "not needed" decisions are held on the case row as well as in `opts`,
// and the fallback lives *here* rather than at each call site: a surface that
// has only the case — the approval pipeline cards, the seal button — must not
// answer a different question than the stepper does. `opts.x ?? caseData.x`
// keeps an explicit `false` winning over the row, so a caller that knows better
// than the row still does.
export function stepperStepDone(i: number, caseData: any, interventionCount: number, opts: StepperProgressOpts = {}): boolean {
  if (!STEP_STATUS_INDEPENDENT.has(i) && !statusAtLeast(caseData, STEP_MIN_STATUS[i] ?? 0)) return false;
  switch (i) {
    case 0: return !!caseData?.problemsPresented && !!caseData?.clientCategory;
    // Implement HIP: an intervention (or the recorded "no intervention"
    // decision) is required; when interventions exist, every required document
    // of the linked program must be uploaded to the case filing.
    case 1: return (interventionCount > 0 || Boolean(opts.interventionNotNeeded ?? caseData?.interventionNotNeeded))
      && (interventionCount === 0 || (opts.requirementsMet ?? true));
    // Service Delivery: a referral is issued, or the social worker recorded
    // that no referral is needed. The referral is an `inter_agency_referrals`
    // row — what the endorsement letter writes — never `case.referrals`, which
    // is the transition plan's agency list over `case_referrals` and has 0 rows
    // in every database this project has run. Reading that instead made step 2
    // permanently unsealable, since the seal endpoint refused what no
    // inter-agency referral could satisfy and the step's own escape hatch was
    // hidden by the same condition.
    case 2: return (opts.interAgencyReferralCount ?? 0) > 0
      || Boolean(opts.referralNotNeeded ?? caseData?.referralNotNeeded);
    case 3: return !!caseData?.selfRelianceLevel && !!caseData?.sustainabilityPlan;
    case 4: return !!caseData?.closureOutcome;
    default: return false;
  }
}

export function stepperStatus(caseData: any, interventionCount: number, opts: StepperProgressOpts = {}): boolean[] {
  return [0, 1, 2, 3, 4].map((i) => stepperStepDone(i, caseData, interventionCount, opts));
}

interface CaseStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  caseData: any;
  interventionCount: number;
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
  interventionNotNeeded?: boolean;
  /** `opts.interAgencyReferralCount` — see `StepperProgressOpts`. */
  interAgencyReferralCount?: number;
}

export function CaseStepper({ currentStep, onStepClick, caseData, interventionCount, requirementsMet, referralNotNeeded, interventionNotNeeded, interAgencyReferralCount }: CaseStepperProps) {
  const { t } = useTranslation();
  // Handed straight through: `stepperStepDone` applies the case-row fallback for
  // the two decisions itself, so doing it here as well would be a second place
  // holding the same rule.
  const progress: StepperProgressOpts = { requirementsMet, referralNotNeeded, interventionNotNeeded, interAgencyReferralCount };
  // Labels come from STEP_LABEL_KEYS so this stepper and `CaseActionBar` cannot
  // drift on a step's name; only the description and phase are stated here.
  const STEPS = [
    { labelKey: STEP_LABEL_KEYS[0], description: t('caseView.stepper.assessmentDesc', 'Interview and FRVA/SWDI analysis'), phase: t('caseView.stepper.phaseIn', 'Phase-In') },
    { labelKey: STEP_LABEL_KEYS[1], description: t('caseView.stepper.implementHipDesc', 'Select intervention; client documents; COE/PCV release'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { labelKey: STEP_LABEL_KEYS[2], description: t('caseView.stepper.serviceDeliveryDesc', 'Referral needed: yes or no'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { labelKey: STEP_LABEL_KEYS[3], description: t('caseView.stepper.transitionDesc', 'Self-reliance assessment'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
    { labelKey: STEP_LABEL_KEYS[4], description: t('caseView.stepper.closureDesc', 'Evaluate case study; formal exit'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
  ].map((step) => ({ ...step, label: t(step.labelKey.key, step.labelKey.fallback) }));
  const highestReachable = (() => {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (stepperStepDone(i, caseData, interventionCount, progress)) return i;
    }
    return -1;
  })();

  function handleClick(i: number) {
    const done = stepperStepDone(i, caseData, interventionCount, progress);
    // Intervention (step 1) and referral (step 2) are issued in parallel: with
    // the assessment done, Service Delivery is reachable regardless of whether
    // an intervention exists, because a case may be referral-only.
    const implementationReachable = stepperStepDone(0, caseData, interventionCount, progress);
    // Phase-Out (Evaluate Help Given, Case Study & Closure) requires BOTH
    // implementation steps to be finished — never reachable around an
    // incomplete intervention or referral step.
    const implementationDone =
      stepperStepDone(1, caseData, interventionCount, progress) &&
      stepperStepDone(2, caseData, interventionCount, progress);
    if (i >= 3 && !implementationDone) {
      toast.error(
        t('caseView.stepper.completeImplementationSteps', 'Finish implementation steps first'),
        {
          description: t(
            'caseView.stepper.completeImplementationStepsDesc',
            'Step 4 (Evaluate Help Given) unlocks only after Step 2 (Intervention & Requirements) and Step 3 (Inter-agency Referrals) are both complete.',
          ),
        },
      );
      return;
    }
    if (done || i <= highestReachable + 1 || (i === 2 && implementationReachable)) {
      onStepClick(i);
      return;
    }
    // Explain *why* the step is locked instead of a bare "not available":
    // step 1 (Intervention & Requirements) is the usual blocker, and it needs
    // every program document satisfied before review can proceed.
    if (i >= 2 && !progress.requirementsMet) {
      toast.error(
        t('caseView.stepper.documentsRequired', 'Upload the required documents first'),
        {
          description: t(
            'caseView.stepper.documentsRequiredDesc',
            'Step 2 (Intervention & Requirements) still has unmet documentary needs. Upload or verify each required document, or mark it passed on-site, before continuing.',
          ),
        },
      );
      return;
    }
    toast.error(t('caseView.stepper.stepNotAvailable', 'Step not available'), { description: t('caseView.stepper.accomplishStepFirst', 'Accomplish current step first.') });
  }

  // Group steps by phase
  const phases = [
    { name: t('caseView.stepper.phaseIn', 'Phase-In'), steps: [0] },
    { name: t('caseView.stepper.phaseImplementation', 'Implementation'), steps: [1, 2] },
    { name: t('caseView.stepper.phaseOut', 'Phase-Out'), steps: [3, 4] },
  ];

  return (
    <nav className="px-4 py-3 overflow-x-auto">
      <div className="flex items-center gap-2">
        {phases.map((phase, phaseIdx) => (
          <div key={phase.name} className="flex items-center">
            {phaseIdx > 0 && (
              <div className="w-4 h-px bg-border mx-1" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                {phase.name}
              </span>
              <div className="flex items-center gap-1">
                {phase.steps.map(stepIdx => {
                  const step = STEPS[stepIdx];
                  const done = stepperStepDone(stepIdx, caseData, interventionCount, progress);
                  const isActive = stepIdx === currentStep;
                  const implementationDone =
                    stepperStepDone(1, caseData, interventionCount, progress) &&
                    stepperStepDone(2, caseData, interventionCount, progress);
                  const isClickable = done || (stepIdx === 2 && stepperStepDone(0, caseData, interventionCount, progress)) || (stepIdx <= highestReachable + 1 && (stepIdx < 3 || implementationDone));
                  return (
                    <button
                      key={stepIdx}
                      type="button"
                      onClick={() => handleClick(stepIdx)}
                      aria-current={isActive ? 'step' : undefined}
                      aria-disabled={!isClickable}
                      aria-label={`${stepIdx + 1}. ${step.label}`}
                      title={isClickable ? step.description : t('caseView.stepper.accomplishStepFirst', 'Accomplish current step first.')}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : done
                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                          : isClickable
                          ? 'text-muted-foreground hover:bg-muted'
                          : 'cursor-not-allowed text-muted-foreground/60'
                      }`}
                    >
                      <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-primary-foreground text-primary'
                          : done
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? <Check size={12} aria-hidden="true" /> : stepIdx + 1}
                      </span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
