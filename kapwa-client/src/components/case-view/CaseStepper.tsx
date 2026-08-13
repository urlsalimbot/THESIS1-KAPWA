import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

function isStepDone(i: number, caseData: any, interventionCount: number): boolean {
  switch (i) {
    case 0: return !!caseData?.problemsPresented && !!caseData?.clientCategory;
    case 1: return interventionCount > 0;
    case 2: return interventionCount > 0 || (caseData?.referrals?.length || 0) > 0; // Referrals optional per DSWD protocol
    case 3: return !!caseData?.selfRelianceLevel && !!caseData?.sustainabilityPlan;
    case 4: return !!caseData?.clientSignature && !!caseData?.closureOutcome;
    default: return false;
  }
}

interface CaseStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  caseData: any;
  interventionCount: number;
}

export function CaseStepper({ currentStep, onStepClick, caseData, interventionCount }: CaseStepperProps) {
  const { t } = useTranslation();
  const STEPS = [
    { label: t('caseView.stepper.assessment', 'Assessment'), description: t('caseView.stepper.assessmentDesc', 'FRVA & SWDI analysis'), phase: t('caseView.stepper.phaseIn', 'Phase-In') },
    { label: t('caseView.stepper.implementHip', 'Implement HIP'), description: t('caseView.stepper.implementHipDesc', 'Intervention delivery'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.serviceDelivery', 'Service Delivery'), description: t('caseView.stepper.serviceDeliveryDesc', 'Referrals & resources'), phase: t('caseView.stepper.phaseImplementation', 'Implementation') },
    { label: t('caseView.stepper.transition', 'Transition'), description: t('caseView.stepper.transitionDesc', 'Graduation readiness'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
    { label: t('caseView.stepper.closure', 'Closure'), description: t('caseView.stepper.closureDesc', 'Formal exit'), phase: t('caseView.stepper.phaseOut', 'Phase-Out') },
  ];
  const highestReachable = (() => {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (isStepDone(i, caseData, interventionCount)) return i;
    }
    return -1;
  })();

  function handleClick(i: number) {
    const done = isStepDone(i, caseData, interventionCount);
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
                  const done = isStepDone(stepIdx, caseData, interventionCount);
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
