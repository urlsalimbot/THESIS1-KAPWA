import { cn } from '@/lib/utils';
import { FileText, ClipboardCheck, Search, Award } from 'lucide-react';

const steps = [
  { step: 1, title: 'Submit Application', description: 'Visit our office or apply online through the KAPWA portal. Provide your personal information and the type of assistance you need.', icon: FileText },
  { step: 2, title: 'Initial Assessment', description: 'Your application is reviewed by our social workers to determine eligibility and the appropriate program for your situation.', icon: ClipboardCheck },
  { step: 3, title: 'Document Verification', description: 'Submit the required documents for validation. Our team will guide you through the requirements specific to your application.', icon: Search },
  { step: 4, title: 'Approval & Payout', description: 'Once approved, you will receive the assistance through your chosen mode of disbursement. We will notify you of the schedule.', icon: Award },
];

interface ApplicationStepsProps {
  className?: string;
}

export function ApplicationSteps({ className }: ApplicationStepsProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <span className="text-xs font-medium text-accent tracking-wide">Getting Started</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight text-balance">
            How to Avail Services
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto text-pretty">
            A simple four-step process to access the social welfare services you need.
          </p>
        </div>
        <div className="max-w-3xl mx-auto">
          {steps.map((item, i) => {
            const Icon = item.icon;
            const isLast = i === steps.length - 1;
            return (
              <div key={item.step} className="flex gap-5 pb-8 last:pb-0 group">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-accent-foreground shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:shadow-md">
                    <Icon size={20} />
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-gradient-to-b from-accent/40 to-accent/5 mt-2" />}
                </div>
                <div className={cn('pt-2', !isLast && 'pb-2')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-accent">Step {item.step}</span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold mb-2 tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-pretty">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
