import { cn } from '@/lib/utils';

const steps = [
  { step: 1, title: 'Submit Application', description: 'Visit our office or apply online through the Kapwa portal. Provide your personal information and the type of assistance you need.' },
  { step: 2, title: 'Initial Assessment', description: 'Your application is reviewed by our social workers to determine eligibility and the appropriate program for your situation.' },
  { step: 3, title: 'Document Verification', description: 'Submit the required documents for validation. Our team will guide you through the requirements specific to your application.' },
  { step: 4, title: 'Approval & Payout', description: 'Once approved, you will receive the assistance through your chosen mode of disbursement. We will notify you of the schedule.' },
];

interface ApplicationStepsProps {
  className?: string;
}

export function ApplicationSteps({ className }: ApplicationStepsProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">
          How to Avail Services
        </h2>
        <div className="max-w-3xl mx-auto">
          {steps.map((item) => (
            <div key={item.step} className="flex gap-6 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-foreground font-semibold text-sm shrink-0">
                  {item.step}
                </div>
                {item.step < steps.length && (
                  <div className="w-px flex-1 bg-border mt-2" />
                )}
              </div>
              <div className="pt-1.5">
                <h3 className="font-medium text-lg mb-1">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
