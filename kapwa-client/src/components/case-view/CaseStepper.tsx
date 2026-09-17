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

// Shared done-status per stepper step — reused by the case view stepper and
// the approval pipeline cards so both surfaces show identical progress.
export function stepperStepDone(i: number, caseData: any, interventionCount: number, opts: StepperProgressOpts = {}): boolean {
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
    { label: t('caseView.stepper.assessment', 'Assessment'), description: t('caseView.stepper.assessmentDesc', 'FRVA & SWDI analysis'), phase: t('caseView.stepper.phaseIn', 'Phase-In') },
    { label: t('caseView.stepper.implementHip', 'Implement HIP'), description: t('caseView.stepper.implementHipDesc', 'Intervention delivery'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.serviceDelivery', 'Service Delivery'), description: t('caseView.stepper.serviceDeliveryDesc', 'Referrals & resources'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.transition', 'Transition'), description: t('caseView.stepper.transitionDesc', 'Graduation readiness'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
    { label: t('caseView.stepper.closure', 'Closure'), description: t('caseView.stepper.closureDesc', 'Formal exit'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
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
                      disabled={!isClickable}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : done
                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                          : 'text-muted-foreground hover:bg-muted'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-primary-foreground text-primary'
                          : done
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? <Check size={12} /> : stepIdx + 1}
                      </span>
                      <span className="hidden md:inline">{step.label}</span>
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
