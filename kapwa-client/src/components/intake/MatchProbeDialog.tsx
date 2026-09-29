import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { statusLabel } from '@/i18n/display';

export interface MatchCandidate {
  householdId: string;
  score: number;
  matchedOn: string[];
  caseExistsWithin30Days: boolean;
  primaryBeneficiary: {
    id: string; surname: string; firstName: string; middleName?: string;
    gender: string; age: number; dob?: string; phone: string; email?: string;
    occupation: string; estimatedMonthlyIncome: number; civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string;
  };
  matchedPerson: {
    id: string;
    role: 'beneficiary' | 'member';
    relationship?: string;
    surname: string; firstName: string; middleName?: string;
    gender: string; age: number; dob?: string; phone: string; email?: string;
    occupation: string; estimatedMonthlyIncome: number; civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string; category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{
    id: string; fullName: string; surname: string; firstName: string;
    middleName?: string; gender: string; dob?: string; relationship: string;
    age: number; occupation: string; income: number; status: string;
  }>;
  pastCases: Array<{ controlNo: string; beneficiaryName: string; status: string; createdAt: string }>;
  lastApprovedCaseDate: string | null;
}

// Server-issued reason tokens (match-scoring MATCH_REASON_TOKENS), localized.
const MATCHED_ON_KEY: Record<string, string> = {
  phone: 'intake.matchedOnPhone',
  email: 'intake.matchedOnEmail',
  philhealth: 'intake.matchedOnPhilHealth',
  both_names: 'intake.matchedOnBothNames',
  dob_name: 'intake.matchedOnDobName',
  phonetic_surname: 'intake.matchedOnPhoneticSurname',
  family_member: 'intake.matchedOnFamilyMember',
};
const MATCHED_ON_FALLBACK: Record<string, string> = {
  phone: 'Phone match',
  email: 'Email match',
  philhealth: 'PhilHealth match',
  both_names: 'Both names',
  dob_name: 'DOB + name',
  phonetic_surname: 'Sound-alike surname',
  family_member: 'Family member',
};

export function MatchProbeDialog({
  candidates,
  onConfirm,
  onDismiss,
}: {
  candidates: MatchCandidate[];
  onConfirm: (candidate: MatchCandidate) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('intake.matchProbeTitle', 'Possible existing household')}</DialogTitle>
          <DialogDescription>
            {t('intake.matchProbeDesc', 'The client may already be on record. Review each household and confirm with the client.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sorted.map((c) => {
            const mp = c.matchedPerson;
            const full = `${mp.firstName} ${mp.surname}`;
            const head = `${c.primaryBeneficiary.firstName} ${c.primaryBeneficiary.surname}`;
            return (
              <div key={c.householdId} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold">
                    {t('intake.isThis', 'Is this')} <span className="text-primary">{full}</span>{t('intake.isThisQ', '?')}
                  </p>
                  {mp.role === 'member' && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {t('intake.roleMember', 'Household member')}{mp.relationship ? ` · ${mp.relationship}` : ''}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{t('intake.barangay', 'Barangay')}: {c.primaryBeneficiary.currentAddress?.barangay || '—'}</span>
                  <span>{t('intake.matchProbeHead', 'Household of')}: {head}</span>
                </div>

                {c.matchedOn.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.matchedOn.map(token => (
                      <span key={token} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {t(MATCHED_ON_KEY[token] || token, MATCHED_ON_FALLBACK[token] || token)}
                      </span>
                    ))}
                  </div>
                )}

                {c.familyMembers.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {t('intake.matchProbeMembers', 'Household members ({{count}})', { count: c.familyMembers.length })}
                    </p>
                    <ul className="space-y-0.5 text-xs">
                      {c.familyMembers.map(m => (
                        <li key={m.id} className="flex justify-between gap-2">
                          <span>{m.firstName} {m.surname}{m.relationship ? ` — ${m.relationship}` : ''}</span>
                          <span className="shrink-0 text-muted-foreground">{m.age ? `${m.age} ${t('intake.matchProbeYears', 'y/o')}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.pastCases.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t('intake.matchProbeCases', 'Past cases')}</p>
                    <ul className="space-y-0.5 text-xs">
                      {c.pastCases.map((pc, i) => (
                        <li key={`${pc.controlNo}-${i}`} className="flex justify-between gap-2">
                          <span>{pc.controlNo} · {pc.beneficiaryName} · {statusLabel(t, pc.status)}</span>
                          <span className="shrink-0 text-muted-foreground">{pc.createdAt ? formatDate(pc.createdAt) : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-1">
                  <Button size="sm" onClick={() => onConfirm(c)}>
                    {t('intake.matchProbeConfirm', 'This is the client\u2019s household')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            {t('intake.matchProbeDismiss', 'None of these — continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}