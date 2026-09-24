import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Extra data the case view has (programs docs, referral decision) but the
// approval-pipeline cards do not — steps 1/2 fall back to their simple checks
// when these are absent so the pipeline cards keep working.
export interface StepperProgressOpts {
  requirementsMet?: boolean;
  referralNotNeeded?: boolean;
}

// Minimum lifecycle position at which a step may be considered "done". Steps 3
// (Evaluate Help Given) and 4 (Case Study & Closure) are Phase-Out work: prefilled
// data on an earlier-status case must not make them look complete.
const STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5,
};
const STEP_MIN_STATUS = [0, 0, 0, 3, 4];

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

// Shared done-status per stepper step — reused by the case view stepper and
// the approval pipeline cards so both surfaces show identical progress.
export function stepperStepDone(i: number, caseData: any, interventionCount: number, opts: StepperProgressOpts = {}): boolean {
  if (!STEP_STATUS_INDEPENDENT.has(i) && !statusAtLeast(caseData, STEP_MIN_STATUS[i] ?? 0)) return false;
  switch (i) {
    case 0: return !!caseData?.problemsPresented && !!caseData?.clientCategory;
    // Implement HIP: an intervention alone is not enough — every required
    // document of the linked program must be uploaded to the case filing.
    case 1: return interventionCount > 0 && (opts.requirementsMet ?? true);
    // Service Delivery: a referral is issued, or the social worker recorded
    // that no referral is needed.
    case 2: return (caseData?.referrals?.length || 0) > 0 || Boolean(opts.referralNotNeeded);
    case 3: return !!caseData?.selfRelianceLevel && !!caseData?.sustainabilityPlan;
    case 4: return !!caseData?.clientSignature && !!caseData?.closureOutcome;
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
}

export function CaseStepper({ currentStep, onStepClick, caseData, interventionCount, requirementsMet, referralNotNeeded: referralNotNeededProp }: CaseStepperProps) {
  const { t } = useTranslation();
  // Fall back to the case row so surfaces that only pass caseData (e.g. the
  // approval pipeline cards) still reflect a recorded not-needed decision.
  const referralNotNeeded = referralNotNeededProp ?? Boolean(caseData?.referralNotNeeded);
  const progress: StepperProgressOpts = { requirementsMet, referralNotNeeded };
  const STEPS = [
    { label: t('caseView.stepper.assessment', 'Assess & Interview'), description: t('caseView.stepper.assessmentDesc', 'Interview and FRVA/SWDI analysis'), phase: t('caseView.stepper.phaseIn', 'Phase-In') },
    { label: t('caseView.stepper.implementHip', 'Intervention & Requirements'), description: t('caseView.stepper.implementHipDesc', 'Select intervention; client documents; COE/PCV release'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.serviceDelivery', 'Inter-agency Referrals'), description: t('caseView.stepper.serviceDeliveryDesc', 'Referral needed: yes or no'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.transition', 'Evaluate Help Given'), description: t('caseView.stepper.transitionDesc', 'Self-reliance assessment'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
    { label: t('caseView.stepper.closure', 'Case Study & Closure'), description: t('caseView.stepper.closureDesc', 'Evaluate case study; formal exit'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
  ];
  const highestReachable = (() => {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (stepperStepDone(i, caseData, interventionCount, progress)) return i;
    }
    return -1;
  })();

  function handleClick(i: number) {
    const done = stepperStepDone(i, caseData, interventionCount, progress);
    if (done || i <= highestReachable + 1) {
      onStepClick(i);
    } else {
      toast.error(t('caseView.stepper.stepNotAvailable', 'Step not available'), { description: t('caseView.stepper.accomplishStepFirst', 'Accomplish current step first.') });
    }
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
                  const isClickable = done || stepIdx <= highestReachable + 1;
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
