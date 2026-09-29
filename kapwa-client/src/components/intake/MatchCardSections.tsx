import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, CheckCircle, Info, Phone, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { computeAge } from '@/lib/age';
import { statusLabel } from '@/i18n/display';
import { cn } from '@/lib/utils';

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
    philhealthNumber?: string;
    category?: string;
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

/**
 * The beneficiary details the worker typed, used for the "You entered" column.
 * Optional: without it the comparison block is simply omitted (e.g. a card
 * rendered outside an intake flow).
 */
export interface MatchIntakeFields {
  surname?: string;
  firstName?: string;
  dob?: string;
  age?: number | string;
  cellularNumber?: string;
  email?: string;
  philhealthNumber?: string;
  currentAddress?: { barangay?: string } | null;
}

// Server-issued reason tokens (match-scoring MATCH_REASON_TOKENS), localized.
// Keys are localized; fallbacks keep unknown token changes from leaking.
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

const COMPARE_COLUMNS = 'grid grid-cols-[minmax(4.5rem,7rem)_1fr_1fr_1.25rem] gap-x-3 gap-y-0 items-center';

// A visual label, not a document heading: the card repeats several of these, so
// heading levels would skip the page's own structure (and fail heading-order).
function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon size={12} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function confidenceBand(score: number, t: TFunction): { label: string; className: string } {
  if (score >= 0.6) return { label: t('intake.confidenceVeryLikely', 'Very likely the same person'), className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score >= 0.35) return { label: t('intake.confidenceSome', 'Some similarities'), className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  return { label: t('intake.confidenceSameSurname', 'Possible match'), className: 'bg-gray-100 text-gray-600 border-gray-300' };
}

function eligibilityNote(candidate: MatchCandidate, t: TFunction): { text: string; icon: 'check' | 'info' } {
  if (candidate.matchedPerson?.role === 'member') {
    // A member match is not an exact beneficiary match: confirming always opens
    // a new case for this client, even when the household has a recent case.
    return {
      text: t('intake.eligMemberNewCase', 'Matched as a household member — a new case will be opened for this client in this household.'),
      icon: 'check',
    };
  }
  if (candidate.caseExistsWithin30Days) {
    // Conditional wording: the outcome depends on which action the worker picks,
    // so state what each choice does rather than asserting one outcome.
    return {
      text: t(
        'intake.eligActiveCase',
        'Has an active case — choosing "Yes, update info" will update it instead of creating a new case.',
      ),
      icon: 'info',
    };
  }
  if (candidate.lastApprovedCaseDate) {
    const d = new Date(candidate.lastApprovedCaseDate);
    return { text: t('intake.eligLastCase', 'Last case: {{date}} — eligible for a new case.', { date: formatDate(d) }), icon: 'check' };
  }
  return { text: t('intake.eligNoPrior', 'No prior case on record — a new case will be created.'), icon: 'check' };
}

function formatIntakeField(intake: MatchIntakeFields, field: string): string {
  if (field === 'age') {
    // The intake form has no age field (it derives one from the DOB), so
    // compute it here — otherwise the row reads "— vs 11" and flags a
    // difference that does not exist.
    if (intake.age != null && intake.age !== '') return String(intake.age);
    return intake.dob ? String(computeAge(intake.dob)) : '';
  }
  if (field === 'barangay') return intake.currentAddress?.barangay || '';
  return String(intake[field as keyof MatchIntakeFields] || '');
}

function MatchRow({ label, newVal, existingVal, t }: { label: string; newVal: string; existingVal: string; t: TFunction }) {
  const match = newVal.toLowerCase() === existingVal.toLowerCase();
  const status = match ? t('intake.matches', 'Match') : t('intake.differs', 'Differs');
  return (
    <div
      className={cn(
        COMPARE_COLUMNS,
        'border-b border-border/60 py-2 text-sm last:border-0',
        !match && 'bg-amber-50/50',
      )}
    >
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="truncate text-right text-muted-foreground" title={newVal || '—'}>{newVal || '—'}</span>
      <span className="truncate border-l border-border/60 pl-3 font-medium" title={existingVal || '—'}>{existingVal || '—'}</span>
      <span role="img" aria-label={status} title={status} className="flex justify-end">
        {match
          ? <Check size={14} className="text-emerald-600" aria-hidden />
          : <X size={14} className="text-amber-500" aria-hidden />}
      </span>
    </div>
  );
}

function MatchCompare({ candidate, intake, t }: { candidate: MatchCandidate; intake: MatchIntakeFields; t: TFunction }) {
  // Roster matching can surface a household member rather than the beneficiary;
  // compare the intake against whoever actually matched.
  const matched = candidate.matchedPerson ?? candidate.primaryBeneficiary;
  return (
    <section className="rounded-lg border bg-muted/30 p-3">
      <div className={cn(COMPARE_COLUMNS, 'border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground')}>
        <span />
        <span className="text-right">{t('intake.youEntered', 'You entered')}</span>
        <span className="border-l border-border/60 pl-3">{t('intake.existingRecord', 'Existing record')}</span>
        <span />
      </div>
      <MatchRow label={t('intake.name', 'Name')} newVal={`${intake.surname || ''}, ${intake.firstName || ''}`} existingVal={`${matched.surname}, ${matched.firstName}`} t={t} />
      <MatchRow label={t('intake.reviewDob', 'Date of birth')} newVal={formatIntakeField(intake, 'dob')} existingVal={matched.dob || ''} t={t} />
      <MatchRow label={t('intake.age', 'Age')} newVal={formatIntakeField(intake, 'age')} existingVal={String(matched.age)} t={t} />
      <MatchRow label={t('intake.reviewPhone', 'Phone')} newVal={formatIntakeField(intake, 'cellularNumber')} existingVal={matched.phone || ''} t={t} />
      <MatchRow label={t('intake.reviewEmail', 'Email')} newVal={formatIntakeField(intake, 'email')} existingVal={matched.email || ''} t={t} />
      <MatchRow label={t('intake.barangay', 'Barangay')} newVal={formatIntakeField(intake, 'barangay')} existingVal={matched.currentAddress?.barangay || ''} t={t} />
      {matched.philhealthNumber && (
        <MatchRow label={t('intake.philhealth', 'PhilHealth')} newVal={formatIntakeField(intake, 'philhealthNumber')} existingVal={matched.philhealthNumber} t={t} />
      )}
    </section>
  );
}

function HouseholdLine({ candidate, t }: { candidate: MatchCandidate; t: TFunction }) {
  const head = `${candidate.primaryBeneficiary.firstName} ${candidate.primaryBeneficiary.surname}`;
  const barangay = candidate.primaryBeneficiary.currentAddress?.barangay || '—';
  // One text run on purpose: the line reads as a single fact, and assistive
  // tech announces it as one string rather than as two fragments.
  return (
    <p className="text-xs text-muted-foreground">
      {`${t('intake.matchProbeHead', 'Household of')}: ${head}  ·  ${t('intake.barangay', 'Barangay')}: ${barangay}`}
    </p>
  );
}

function EligibilityBanner({ candidate, t }: { candidate: MatchCandidate; t: TFunction }) {
  const elig = eligibilityNote(candidate, t);
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg p-3 text-sm',
        elig.icon === 'info' ? 'bg-primary/5 text-primary' : 'bg-emerald-50 text-emerald-800',
      )}
    >
      {elig.icon === 'info'
        ? <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        : <CheckCircle size={16} className="mt-0.5 shrink-0" aria-hidden />}
      <span>{elig.text}</span>
    </p>
  );
}

function ReasonChips({ candidate, t }: { candidate: MatchCandidate; t: TFunction }) {
  if (!candidate.matchedOn || candidate.matchedOn.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <SectionLabel icon={CheckCircle}>{t('intake.whyFlagged', 'Why this was flagged')}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {candidate.matchedOn.map(token => (
          <span key={token} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {t(MATCHED_ON_KEY[token] || token, MATCHED_ON_FALLBACK[token] || token)}
          </span>
        ))}
      </div>
    </section>
  );
}

function HouseholdMembers({ candidate, t }: { candidate: MatchCandidate; t: TFunction }) {
  if (!candidate.familyMembers || candidate.familyMembers.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <SectionLabel icon={Users}>
        {t('intake.matchProbeMembers', 'Household members ({{count}})', { count: candidate.familyMembers.length })}
      </SectionLabel>
      <ul
        className="divide-y divide-border/60 rounded-lg border"
        aria-label={t('intake.matchProbeMembers', 'Household members ({{count}})', { count: candidate.familyMembers.length })}
      >
        {candidate.familyMembers.map(m => {
          // Highlight the person who actually matched — for a member match that
          // is one of the rows below, and losing them in a long roster is easy.
          const isMatched = m.id === candidate.matchedPerson?.id;
          return (
            <li
              key={m.id}
              className={cn(
                'flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm',
                isMatched && 'bg-primary/5 font-semibold text-primary',
              )}
            >
              <span className="truncate">
                {m.firstName} {m.middleName ? `${m.middleName} ` : ''}{m.surname}
                {m.relationship && (
                  <span className={cn('ml-2 text-xs font-normal', isMatched ? 'text-primary/80' : 'text-muted-foreground')}>
                    · {m.relationship}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {m.age ? `${m.age} ${t('intake.matchProbeYears', 'y/o')}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const CASE_STATUS_TONE: Array<[RegExp, string]> = [
  [/approved|completed|closed/i, 'border-emerald-300 bg-emerald-50 text-emerald-800'],
  [/active/i, 'border-sky-300 bg-sky-50 text-sky-800'],
  [/pending/i, 'border-amber-300 bg-amber-50 text-amber-800'],
];

function caseStatusTone(status: string): string {
  for (const [re, tone] of CASE_STATUS_TONE) if (re.test(status)) return tone;
  return 'border-border bg-muted/40 text-muted-foreground';
}

function PastCases({ candidate, t }: { candidate: MatchCandidate; t: TFunction }) {
  // The same case can arrive twice (once as the household's case, once as the
  // matched person's own), so collapse by control number before rendering.
  const seen = new Set<string>();
  const cases = (candidate.pastCases || []).filter(pc => {
    const key = (pc.controlNo || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (cases.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <SectionLabel icon={Phone}>{t('intake.matchProbeCases', 'Past cases')}</SectionLabel>
      <ul className="divide-y divide-border/60 rounded-lg border" aria-label={t('intake.matchProbeCases', 'Past cases')}>
        {cases.map((pc, i) => (
          <li key={`${pc.controlNo}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="font-mono text-xs tracking-wide text-muted-foreground">{pc.controlNo}</span>
            <span className="min-w-0 truncate">{pc.beneficiaryName}</span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', caseStatusTone(pc.status))}>
              {statusLabel(t, pc.status)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{pc.createdAt ? formatDate(pc.createdAt) : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The single match card used by BOTH the match pop-up and the review page, so
 * the two surfaces cannot drift apart: same sections, same order, same type
 * scale. Callers only supply the actions.
 */
export function MatchCandidateCard({
  candidate,
  intake,
  children,
  regionLabel,
  testId,
  className,
}: {
  candidate: MatchCandidate;
  intake?: MatchIntakeFields;
  /** Action buttons rendered at the card's foot (surface-specific). */
  children?: ReactNode;
  regionLabel?: string;
  testId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const band = confidenceBand(candidate.score, t);
  const matched = candidate.matchedPerson ?? candidate.primaryBeneficiary;
  const fullName = `${matched.firstName} ${matched.surname}`;

  return (
    <article
      className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)}
      data-testid={testId}
      role={regionLabel ? 'region' : undefined}
      aria-label={regionLabel}
    >
      <header className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs font-semibold', band.className)}>
        {band.label}
      </header>

      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <p className="text-lg font-semibold leading-tight">
            {t('intake.isThis', 'Is this')} <span className="text-primary">{fullName}</span>{t('intake.isThisQ', '?')}
          </p>
          {candidate.matchedPerson?.role === 'member' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {t('intake.roleMember', 'Household member')}{matched.relationship ? ` · ${matched.relationship}` : ''}
            </span>
          )}
          <HouseholdLine candidate={candidate} t={t} />
        </div>

        {intake && <MatchCompare candidate={candidate} intake={intake} t={t} />}
        <EligibilityBanner candidate={candidate} t={t} />
        <ReasonChips candidate={candidate} t={t} />
        <HouseholdMembers candidate={candidate} t={t} />
        <PastCases candidate={candidate} t={t} />

        {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
      </div>
    </article>
  );
}
