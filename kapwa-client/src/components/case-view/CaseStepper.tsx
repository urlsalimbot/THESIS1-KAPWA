import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Client Profile', description: 'Basic info & household' },
  { label: 'Assessment', description: 'Evaluation & diagnosis' },
  { label: 'Interventions', description: 'Programs & services' },
  { label: 'Exit Plan', description: 'Transition & referrals' },
  { label: 'Signatures', description: 'Approval & closing' },
];

interface CaseStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function CaseStepper({ currentStep, onStepClick }: CaseStepperProps) {
  return (
    <nav className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <button
            key={i}
            onClick={() => onStepClick(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : isCompleted
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              isActive
                ? 'bg-primary-foreground text-primary'
                : isCompleted
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {isCompleted ? <Check size={14} /> : i + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
