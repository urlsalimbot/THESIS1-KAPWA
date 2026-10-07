import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Extra data the case view has (programs docs, referral decision) but the
// approval-pipeline cards do not — steps fall back to their simple checks
// when these are absent so the pipeline cards keep working.
export interface StepperProgressOpts {
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
  interventionNotNeeded?: boolean;
  /** The case row's "no program needed" decision (enrollments step). */
  enrollmentsNotNeeded?: boolean;
  /** How many non-cancelled hearings the court_hearings step counts. */
  courtHearingCount?: number;
  /**
   * How many `inter_agency_referrals` rows the case has, as the case detail
   * endpoint stamps it — the same unscoped count the server's seal weighs.
   *
   * Not the length of the caller-scoped `GET /inter-agency-referrals/case/:caseId`
   * list: that list is scoped by agency for display, and a worker whose agency is
   * not on a referral would see 0 and could never seal the referrals step while
   * the server would have accepted the seal. Not `case.referrals` either — that
   * is the transition plan's agency list over `case_referrals`, which the
   * referral letter never writes. Absent means zero, the honest answer for a
   * surface with no count to offer.
   */
  interAgencyReferralCount?: number;
}

// Lifecycle position of each status, ascending — the order the FSM moves in.
// `aftercare` is the terminal post-closure phase (DSWD AO 10 s. 2007 §VIII.G).
export const STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5, aftercare: 6,
};

/** The steps every case template carries, in display order. */
export const COMMON_STEP_KEYS = [
  'assessment', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure',
] as const;

/**
 * The category steps injected into a category's template, keyed by the stored
 * `cases.case_category` value — the same registry the server reads in
 * `case-step-labels.ts`. A case without a category (legacy) or with a
 * non-statutory subtype gets the common template.
 *
 * `court_hearings` sits **after `referrals`** in every template that carries it:
 * the case is referred out first, and the hearings the office attends are
 * recorded against a case that already has that hand-off on file. This index is
 * what the reachability rule below reads, so the position — not just the
 * membership — is the behaviour.
 */
export const CATEGORY_STEP_TEMPLATES: Record<string, string[]> = {
  'Children in Conflict with the Law (CICL)': [
    'assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Violence Against Women and Their Children (VAWC)': [
    'assessment', 'protection_order', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  // CNSP and Court-Ordered SCS are legal categories: explicit templates with
  // the hearings step (the server's case-step-labels.ts is the same registry).
  'Children in Need of Special Protection (CNSP)': [
    'assessment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Indigency / Court-Ordered Social Case Study': [
    'assessment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Solo Parent': [
    'assessment', 'solo_parent', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure',
  ],
  'Adoption & Foster Care Case': [
    'assessment', 'adoption', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
};

/** The ordered template for a case category value (common when absent). */
export function stepsForCategory(category: string | null | undefined): string[] {
  return (category && CATEGORY_STEP_TEMPLATES[category]) || [...COMMON_STEP_KEYS];
}

/**
 * The step labels, as i18n keys with their English fallbacks, keyed by step.
 *
 * The stepper renders these through `t`, and `CaseActionBar` needs the same
 * names to tell a worker *which* steps are still open. A literal list in each
 * file would be two copies of one vocabulary — and the server's own rejection
 * message spells them a third way (`CASE_STEP_LABELS`). Keys are the shared
 * part: every caller goes through `t`, so both surfaces say the same word in
 * both languages.
 */
export const STEP_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  assessment: { key: 'caseView.stepper.assessment', fallback: 'Assess & Interview' },
  enrollments: { key: 'caseView.stepper.enrollments', fallback: 'Program Enrollments' },
  interventions: { key: 'caseView.stepper.implementHip', fallback: 'Intervention & Requirements' },
  referrals: { key: 'caseView.stepper.serviceDelivery', fallback: 'Inter-agency Referrals' },
  evaluate: { key: 'caseView.stepper.transition', fallback: 'Evaluate Help Given' },
  closure: { key: 'caseView.stepper.closure', fallback: 'Case Study & Closure' },
  discernment: { key: 'caseView.stepper.discernment', fallback: 'Discernment Assessment' },
  protection_order: { key: 'caseView.stepper.protectionOrder', fallback: 'Protection Order' },
  solo_parent: { key: 'caseView.stepper.soloParent', fallback: 'Solo Parent ID' },
  adoption: { key: 'caseView.stepper.adoption', fallback: 'Adoption & Foster Care' },
  court_hearings: { key: 'caseView.stepper.courtHearings', fallback: 'Court Hearings' },
};

const STEP_DESCRIPTIONS: Record<string, { key: string; fallback: string }> = {
  assessment: { key: 'caseView.stepper.assessmentDesc', fallback: 'Interview and FRVA/SWDI analysis' },
  enrollments: { key: 'caseView.stepper.enrollmentsDesc', fallback: 'Enroll the case in the MSWDO programs it needs; programs selected here anchor interventions' },
  interventions: { key: 'caseView.stepper.implementHipDesc', fallback: 'Select intervention; client documents; COE/PCV release' },
  referrals: { key: 'caseView.stepper.serviceDeliveryDesc', fallback: 'Referral needed: yes or no' },
  evaluate: { key: 'caseView.stepper.transitionDesc', fallback: 'Self-reliance assessment' },
  closure: { key: 'caseView.stepper.closureDesc', fallback: 'Evaluate case study; formal exit' },
  discernment: { key: 'caseView.stepper.discernmentDesc', fallback: 'Discernment assessment (R.A. 9344) decides diversion vs intervention' },
  protection_order: { key: 'caseView.stepper.protectionOrderDesc', fallback: 'Protection order type and issuance (R.A. 9262)' },
  solo_parent: { key: 'caseView.stepper.soloParentDesc', fallback: 'Solo Parent ID issuance (R.A. 8972)' },
  adoption: { key: 'caseView.stepper.adoptionDesc', fallback: 'DVC, case study, CDCLAA documents (R.A. 11642)' },
  court_hearings: { key: 'caseView.stepper.courtHearingsDesc', fallback: 'Record court hearings; dates sync to the team calendar' },
};

/** Which lifecycle phase a step belongs to, for the stepper's grouping. */
export const STEP_PHASE: Record<string, 'phaseIn' | 'implementation' | 'phaseOut'> = {
  assessment: 'phaseIn',
  enrollments: 'phaseIn',
  discernment: 'phaseIn',
  protection_order: 'phaseIn',
  solo_parent: 'phaseIn',
  adoption: 'phaseIn',
  // Court hearings follow the inter-agency referral, so they are implementation
  // work. Keeping them in `phaseIn` would render "6. Court Hearings" inside the
  // Phase-In group: the number comes from the template index while the group
  // comes from this map, and the two must walk in the same direction.
  court_hearings: 'implementation',
  interventions: 'implementation',
  referrals: 'implementation',
  evaluate: 'phaseOut',
  closure: 'phaseOut',
};

/**
 * Minimum lifecycle position at which a step may be considered "done". The
 * Phase-In and Implementation steps come due at `enrolled`; `evaluate`
 * (Evaluate Help Given) and `closure` (Case Study & Closure) are Phase-Out
 * work: prefilled data on an earlier-status case must not make them look
 * complete.
 *
 * Exported because `stepsDueAt` below is read by `CaseActionBar`, which has to
 * ask the same question the server's `assessed -> in_review` gate asks. The
 * server derives it from its own copy in `case-step-labels.ts`; this is the
 * client half of that pair, and both read a floor map rather than a hand-typed
 * list — `case-step-done-fixture.json` is what keeps the floor honest for the
 * done-predicate, and `CaseActionBar.test.tsx` for this.
 */
export const STEP_FLOORS: Record<string, number> = {
  assessment: 0,
  enrollments: 0,
  interventions: 0,
  referrals: 0,
  discernment: 0,
  protection_order: 0,
  solo_parent: 0,
  adoption: 0,
  // Court hearings: implementation work, floored at `active`(3) — the server's
  // `CASE_STEP_FLOORS` says the same and `case-fsm-parity.test.ts` fails if the
  // two drift. Below `active` the Lock button is disabled and, with the
  // reachability rule below, so is the stepper entry itself.
  court_hearings: 3,
  evaluate: 3,
  closure: 4,
};

/**
 * The steps that are *due* at a lifecycle position: the Phase-In and
 * Implementation work that exists once a case has reached that far, in
 * template order.
 *
 * The `assessed -> in_review` gate asks for these, not for every step.
 * Requiring every step meant the gate could never be satisfied by the role it
 * exists for: it fires at status index 1, while `evaluate` and `closure` are
 * floored at `active`(3) and `transitioning`(4) — so their Lock buttons are
 * disabled in the UI and the seal endpoint rejects them with a 400. A social
 * worker could never flag a case for admin review, which is the one thing the
 * button is for. (The server had exactly this bug and fixed it in `5964197`;
 * this is the client half.)
 *
 * Derived from `STEP_FLOORS` rather than listed separately, which is the
 * point: the set a gate demands is by construction the set the seal endpoint will
 * accept, so "you have not sealed enough" cannot name a step that cannot be
 * sealed. An unknown or missing status is treated as position 0 — before the
 * first step — so it asks for the Phase-In work rather than waving a case
 * through, matching the server's `stepsDueAt`.
 */
export function stepsDueAt(
  status: string | null | undefined,
  category: string | null | undefined = undefined,
): string[] {
  const index = (status == null ? undefined : STATUS_INDEX[status]) ?? 0;
  return stepsForCategory(category).filter((key) => (STEP_FLOORS[key] ?? 0) <= index);
}

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
// The "not needed" decisions are held on the case row as well as in `opts`,
// and the fallback lives *here* rather than at each call site: a surface that
// has only the case — the approval pipeline cards, the seal button — must not
// answer a different question than the stepper does. `opts.x ?? caseData.x`
// keeps an explicit `false` winning over the row, so a caller that knows better
// than the row still does.
//
// Mirrors the server's `CaseStepLocksService.stepDone` key for key; both are
// driven by `case-step-done-fixture.json`.
export function stepperStepDone(
  key: string,
  caseData: any,
  interventionCount: number,
  enrollmentCount = 0,
  opts: StepperProgressOpts = {},
): boolean {
  if (!statusAtLeast(caseData, STEP_FLOORS[key] ?? 0)) return false;
  switch (key) {
    case 'assessment':
      return !!caseData?.problemsPresented && !!caseData?.socialWorkerAssessment
        && !!caseData?.clientCategory && !!caseData?.caseCategory;
    // Program Enrollments: at least one enrollment, or the recorded
    // "no program needed" decision.
    case 'enrollments':
      return enrollmentCount > 0 || Boolean(opts.enrollmentsNotNeeded ?? caseData?.enrollmentsNotNeeded);
    // Implement HIP: an intervention (or the recorded "no intervention"
    // decision) is required; when interventions exist, every required document
    // of the linked program must be uploaded to the case filing.
    case 'interventions':
      return (interventionCount > 0 || Boolean(opts.interventionNotNeeded ?? caseData?.interventionNotNeeded))
        && (interventionCount === 0 || (opts.requirementsMet ?? true));
    // Service Delivery: a referral is issued, or the social worker recorded
    // that no referral is needed. The referral is an `inter_agency_referrals`
    // row — what the endorsement letter writes — never `case.referrals`, which
    // is the transition plan's agency list over `case_referrals` and has 0 rows
    // in every database this project has run. Reading that instead made the
    // step permanently unsealable, since the seal endpoint refused what no
    // inter-agency referral could satisfy and the step's own escape hatch was
    // hidden by the same condition.
    case 'referrals':
      return (opts.interAgencyReferralCount ?? 0) > 0
        || Boolean(opts.referralNotNeeded ?? caseData?.referralNotNeeded);
    case 'discernment':
      return !!caseData?.discernmentAssessedAt && !!caseData?.discernmentResult;
    case 'protection_order':
      return !!caseData?.protectionOrderType;
    case 'solo_parent':
      return !!caseData?.soloParentIdIssuedDate && !!caseData?.soloParentIdNumber;
    case 'adoption':
      return !!caseData?.adoptionDvcDate && !!caseData?.adoptionCaseStudyDate;
    // Court Hearings: at least one recorded hearing that was not cancelled
    // (attended or not — a not-attended hearing is still a recorded fact).
    case 'court_hearings':
      return (opts.courtHearingCount ?? 0) > 0;
    case 'evaluate':
      return !!caseData?.selfRelianceLevel && !!caseData?.sustainabilityPlan;
    case 'closure':
      return !!caseData?.closureOutcome;
    default:
      return false;
  }
}

/** Done-status per step, keyed, over the case's category template. */
export function stepperStatus(
  caseData: any,
  interventionCount: number,
  enrollmentCount: number,
  opts: StepperProgressOpts = {},
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of stepsForCategory(caseData?.caseCategory)) {
    out[key] = stepperStepDone(key, caseData, interventionCount, enrollmentCount, opts);
  }
  return out;
}

interface CaseStepperProps {
  currentStep: string;
  onStepClick: (step: string) => void;
  caseData: any;
  interventionCount: number;
  enrollmentCount: number;
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
  interventionNotNeeded?: boolean;
  /** `opts.interAgencyReferralCount` — see `StepperProgressOpts`. */
  interAgencyReferralCount?: number;
  /** `opts.courtHearingCount` — see `StepperProgressOpts`. */
  courtHearingCount?: number;
}

export function CaseStepper({ currentStep, onStepClick, caseData, interventionCount, enrollmentCount, requirementsMet, referralNotNeeded, interventionNotNeeded, interAgencyReferralCount, courtHearingCount }: CaseStepperProps) {
  const { t } = useTranslation();
  // Handed straight through: `stepperStepDone` applies the case-row fallback for
  // the decisions itself, so doing it here as well would be a second place
  // holding the same rule.
  const progress: StepperProgressOpts = { requirementsMet, referralNotNeeded, interventionNotNeeded, interAgencyReferralCount, courtHearingCount };
  const template = stepsForCategory(caseData?.caseCategory);
  // Labels and descriptions come from the keyed vocabulary so this stepper and
  // `CaseActionBar` cannot drift on a step's name.
  const STEPS = template.map((key) => {
    const labelKey = STEP_LABEL_KEYS[key] ?? { key: `caseView.stepper.${key}`, fallback: key };
    const descKey = STEP_DESCRIPTIONS[key];
    return {
      key,
      label: t(labelKey.key, labelKey.fallback),
      description: descKey ? t(descKey.key, descKey.fallback) : '',
      phase: STEP_PHASE[key] ?? 'phaseIn',
    };
  });
  const doneFor = (key: string) => stepperStepDone(key, caseData, interventionCount, enrollmentCount, progress);
  const idxOf = (key: string) => template.indexOf(key);
  const highestReachable = (() => {
    for (let i = template.length - 1; i >= 0; i--) {
      if (doneFor(template[i])) return i;
    }
    return -1;
  })();

  function handleClick(key: string) {
    const i = idxOf(key);
    const done = doneFor(key);
    // Interventions and referrals are issued in parallel: with the assessment
    // done, Service Delivery is reachable regardless of whether an intervention
    // exists, because a case may be referral-only.
    const implementationReachable = doneFor('assessment');
    // Phase-Out (Evaluate Help Given, Case Study & Closure) requires BOTH
    // implementation steps to be finished — never reachable around an
    // incomplete intervention or referral step.
    const implementationDone =
      doneFor('interventions') && doneFor('referrals');
    if ((key === 'evaluate' || key === 'closure') && !implementationDone) {
      toast.error(
        t('caseView.stepper.completeImplementationSteps', 'Finish implementation steps first'),
        {
          description: t(
            'caseView.stepper.completeImplementationStepsDesc',
            'Evaluate Help Given unlocks only after Intervention & Requirements and Inter-agency Referrals are both complete.',
          ),
        },
      );
      return;
    }
    if (done || i <= highestReachable + 1 || (key === 'referrals' && implementationReachable)) {
      onStepClick(key);
      return;
    }
    // Explain *why* the step is locked instead of a bare "not available":
    // the interventions step is the usual blocker, and it needs every program
    // document satisfied before review can proceed.
    if (i >= idxOf('interventions') && !progress.requirementsMet) {
      toast.error(
        t('caseView.stepper.documentsRequired', 'Upload the required documents first'),
        {
          description: t(
            'caseView.stepper.documentsRequiredDesc',
            'The interventions step still has unmet documentary needs. Upload or verify each required document, or mark it passed on-site, before continuing.',
          ),
        },
      );
      return;
    }
    toast.error(t('caseView.stepper.stepNotAvailable', 'Step not available'), { description: t('caseView.stepper.accomplishStepFirst', 'Accomplish current step first.') });
  }

  // Group steps by phase, preserving template order within each phase.
  const phases: Array<{ name: string; steps: typeof STEPS }> = [
    { name: t('caseView.stepper.phaseIn', 'Phase-In'), steps: STEPS.filter((s) => s.phase === 'phaseIn') },
    { name: t('caseView.stepper.phaseImplementation', 'Implementation'), steps: STEPS.filter((s) => s.phase === 'implementation') },
    { name: t('caseView.stepper.phaseOut', 'Phase-Out'), steps: STEPS.filter((s) => s.phase === 'phaseOut') },
  ].filter((p) => p.steps.length > 0);

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
                {phase.steps.map((step, phaseStepIdx) => {
                  const done = doneFor(step.key);
                  const isActive = step.key === currentStep;
                  const implementationDone =
                    doneFor('interventions') && doneFor('referrals');
                  // A step cannot be opened before the case reaches its own
                  // lifecycle floor. This is what keeps Court Hearings shut
                  // through Phase-In (`enrolled`/`assessed`/`in_review`) even
                  // once an earlier step would otherwise hand reachability
                  // forward, and what keeps Evaluate and Closure in their
                  // phases. `done` already implies the floor — `stepperStepDone`
                  // floors before it reads any data — so gating on it can never
                  // hide a step that is already accomplished.
                  const reachedFloor = statusAtLeast(caseData, STEP_FLOORS[step.key] ?? 0);
                  const isClickable = reachedFloor && (done || (step.key === 'referrals' && doneFor('assessment')) || (idxOf(step.key) <= highestReachable + 1 && (!['evaluate', 'closure'].includes(step.key) || implementationDone)));
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => handleClick(step.key)}
                      aria-current={isActive ? 'step' : undefined}
                      aria-disabled={!isClickable}
                      aria-label={`${idxOf(step.key) + 1}. ${step.label}`}
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
                        {done ? <Check size={12} aria-hidden="true" /> : idxOf(step.key) + 1}
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