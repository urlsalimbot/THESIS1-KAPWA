import type { ReactElement } from 'react';

export interface Agency {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export type ReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string;
  fromAgencyId: string;
  toAgencyId: string;
  status: ReferralStatus;
  reason: string;
  notes?: string;
  legalBasisCode: string;
  outcome?: string;
  declinedReason?: string;
  fromAgency?: Agency;
  toAgency?: Agency;
  person?: { id: string; surname: string; firstName: string };
  createdAt: string;
}

export const LEGAL_BASIS_OPTIONS = ['public_authority_sec13', 'consent_verified', 'emergency_situation'];

export function StatusTimeline({ status }: { status: ReferralStatus }): ReactElement {
  const steps: ReferralStatus[] = ['referred', 'received', 'actioned', 'closed'];
  const activeIndex = status === 'declined' ? -1 : steps.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label="status-timeline">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${i <= activeIndex ? 'bg-primary' : 'bg-muted'}`}
          />
          {i < steps.length - 1 && (
            <span className={`h-px w-4 ${i < activeIndex ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
