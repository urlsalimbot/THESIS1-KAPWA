import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Check, CheckCircle, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadIntakeIdPhotos } from '@/lib/intake-id-photo';
import { useAuth } from '@/lib/auth-context';
import { clearDraft } from '@/hooks/useIntakeAutosave';

interface MatchCandidate {
  householdId: string;
  score: number;
  matchedOn: string[];
  caseExistsWithin30Days: boolean;
  primaryBeneficiary: {
    id: string; surname: string; firstName: string; middleName?: string;
    gender: string; age: number; dob?: string; phone: string; email?: string;
    occupation: string; estimatedMonthlyIncome: number; civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string; category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
  lastApprovedCaseDate: string | null;
}

interface LocationState {
  candidates: MatchCandidate[];
  intakeData: any;
}

// Server-issued reason tokens (match-scoring MATCH_REASON_TOKENS) shown on the
// card. Keys are localized; fallbacks keep unknown token changes from leaking.
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

function confidenceLabel(score: number, t: TFunction): { label: string; className: string } {
  if (score >= 0.6) return { label: t('intake.confidenceVeryLikely', 'Very likely the same person'), className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score >= 0.35) return { label: t('intake.confidenceSome', 'Some similarities'), className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  return { label: t('intake.confidenceSameSurname', 'Possible match'), className: 'bg-gray-100 text-gray-600 border-gray-300' };
}

function eligibilityNote(candidate: MatchCandidate, t: TFunction): { text: string; icon: 'check' | 'info' } {
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

function MatchRow({ label, newVal, existingVal, t }: { label: string; newVal: string; existingVal: string; t: TFunction }) {
  const match = newVal.toLowerCase() === existingVal.toLowerCase();
  const status = match ? t('intake.matches', 'Match') : t('intake.differs', 'Differs');
  return (
    <div className="grid grid-cols-[7rem_1fr_1fr_28px] gap-2 items-center py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-muted-foreground truncate" title={newVal || '—'}>{newVal || '—'}</span>
      <span className="truncate font-medium" title={existingVal || '—'}>{existingVal || '—'}</span>
      <span role="img" aria-label={status} title={status}>
        {match ? <Check size={14} className="text-emerald-600" aria-hidden /> : <X size={14} className="text-gray-300" aria-hidden />}
      </span>
    </div>
  );
}

function formatIntakeField(beneficiary: Record<string, any>, field: string): string {
  if (field === 'age') return String(beneficiary.age || '');
  if (field === 'barangay') return beneficiary.currentAddress?.barangay || '';
  if (field === 'estimatedMonthlyIncome') return `₱${(beneficiary.estimatedMonthlyIncome || 0).toLocaleString()}`;
  return String(beneficiary[field] || '');
}

export function IntakeReviewPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state as LocationState | null;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const continueRef = useRef<HTMLButtonElement>(null);

  // The intake form deliberately keeps its draft until a case actually exists —
  // a reload at this step would otherwise lose the whole payload with nothing to
  // recover from — so this is where the draft is finally retired.
  function clearIntakeDraft() {
    if (user?.id) clearDraft(user.id);
  }

  if (!state || !state.candidates) {
    return (
      <PageShell title={t('intake.matchReview', 'Match Review')} description={t('intake.noIntakeData', 'No intake data found')}>
        <div className="text-center py-12 text-muted-foreground">
          {t('intake.nothingToReview', 'No intake data to review.')} <Button variant="link" onClick={() => navigate('/intake')}>{t('intake.backToForm', 'Go back to intake form')}</Button>
        </div>
      </PageShell>
    );
  }

  const { candidates, intakeData } = state;
  const intake = (intakeData as any)?.beneficiary || {};
  const family = (intakeData as any)?.familyMembers || [];

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const filtered = sorted.filter(c => !dismissed.has(c.householdId));
  const allDismissed = candidates.length > 0 && filtered.length === 0;

  function handleDismiss(c: MatchCandidate) {
    const next = new Set(dismissed);
    next.add(c.householdId);
    const remaining = candidates.filter(x => x.householdId !== c.householdId && !next.has(x.householdId));
    setDismissed(next);
    if (remaining.length === 0) {
      // Move focus to the "continue as new client" action so keyboard users know
      // where to go now that the last card is gone.
      requestAnimationFrame(() => continueRef.current?.focus());
    }
    toast(t('intake.markedDifferent', 'Removed from the list of possible matches.'), {
      action: {
        label: t('intake.undo', 'Undo'),
        onClick: () => {
          const restored = new Set(dismissed);
          restored.delete(c.householdId);
          setDismissed(restored);
        },
      },
    });
  }

  async function handleConfirm(householdId: string) {
    setLoadingId(householdId);
    try {
      const result = await api.post<{ caseCreated: boolean; caseId?: string; message: string }>(
        `/intake/confirm/${householdId}`,
        intakeData,
      );
      // The intake has been consumed either way (case created, or existing case
      // updated), so the draft is spent.
      clearIntakeDraft();
      if (result.caseCreated) {
        toast.success(t('intake.clientRegistered', 'Client registered'), { description: result.message });
        if (result.caseId) {
          void uploadIntakeIdPhotos(result.caseId).then((ok) => {
            if (!ok) toast.error(t('intake.idPhoto.uploadFailed', 'ID photo upload failed'));
          });
        }
        navigate(`/cases/${result.caseId}`);
      } else {
        toast.info(t('intake.infoUpdated', 'Info updated'), { description: result.message });
        navigate(`/cases`);
      }
    } catch {
      toast.error(t('intake.updateFailed', 'Failed to update'), { description: t('intake.tryAgain', 'Please try again.') });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCreateNew() {
    setCreatingNew(true);
    try {
      const result = await api.post<{ caseId: string; controlNo: string }>('/intake', intakeData);
      clearIntakeDraft();
      void uploadIntakeIdPhotos(result.caseId).then((ok) => {
        if (!ok) toast.error(t('intake.idPhoto.uploadFailed', 'ID photo upload failed'));
      });
      navigate(`/cases/${result.caseId}`);
    } catch {
      toast.error(t('intake.createFailed', 'Failed to create client'), { description: t('intake.checkInput', 'Please check your input and try again.') });
    } finally {
      setCreatingNew(false);
    }
  }

  return (
    <PageShell
      title={t('intake.checkPriorRecords', 'Check for Prior Records')}
      description={t('intake.foundRecords', 'We found records that may belong to this client.')}
    >
      <p className="text-sm text-muted-foreground mb-4">{t('intake.reviewHelper', 'Compare the details, then choose which record to continue with.')}</p>

      {filtered.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
          <p>{allDismissed ? t('intake.allDismissed', 'No possible matches left to review.') : t('intake.noPriorRecords', 'No prior records found for this name.')}</p>
          <Button variant="default" className="mt-4" onClick={handleCreateNew} disabled={creatingNew} ref={continueRef}>
            {creatingNew ? t('intake.creating', 'Creating...') : t('intake.continueNewClient', 'Continue as new client')}
          </Button>
        </Card>
      )}

      <div className="space-y-6">
        {filtered.map((c) => {
          const cLabel = confidenceLabel(c.score, t);
          const elig = eligibilityNote(c, t);
          const fullName = `${c.primaryBeneficiary.firstName} ${c.primaryBeneficiary.surname}`;
          return (
            <Card
              key={c.householdId}
              className="overflow-hidden"
              data-testid="match-card"
              role="region"
              aria-label={t('intake.cardRegion', '{{name}} — possible match', { name: fullName })}
            >
              <div className={`px-4 py-2 border-b text-sm font-medium ${cLabel.className}`}>
                {cLabel.label}
              </div>

              <div className="p-4 space-y-3">
                <p className="text-base font-semibold">
                  {t('intake.isThis', 'Is this')} <span className="text-primary">{fullName}</span>{t('intake.isThisQ', '?')}
                </p>

                <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                  <div className="grid grid-cols-[7rem_1fr_1fr_28px] gap-2 text-xs text-muted-foreground pb-1 border-b border-gray-200 mb-1">
                    <span />
                    <span className="text-right">{t('intake.youEntered', 'You entered')}</span>
                    <span>{t('intake.existingRecord', 'Existing record')}</span>
                    <span />
                  </div>

                  <MatchRow label={t('intake.name', 'Name')} newVal={`${intake.surname}, ${intake.firstName}`} existingVal={`${c.primaryBeneficiary.surname}, ${c.primaryBeneficiary.firstName}`} t={t} />
                  <MatchRow label={t('intake.reviewDob', 'Date of birth')} newVal={formatIntakeField(intake, 'dob')} existingVal={c.primaryBeneficiary.dob || ''} t={t} />
                  <MatchRow label={t('intake.age', 'Age')} newVal={formatIntakeField(intake, 'age')} existingVal={String(c.primaryBeneficiary.age)} t={t} />
                  <MatchRow label={t('intake.reviewPhone', 'Phone')} newVal={formatIntakeField(intake, 'cellularNumber')} existingVal={c.primaryBeneficiary.phone || ''} t={t} />
                  <MatchRow label={t('intake.reviewEmail', 'Email')} newVal={formatIntakeField(intake, 'email')} existingVal={c.primaryBeneficiary.email || ''} t={t} />
                  <MatchRow label={t('intake.barangay', 'Barangay')} newVal={formatIntakeField(intake, 'barangay')} existingVal={c.primaryBeneficiary.currentAddress?.barangay || ''} t={t} />
                  {c.primaryBeneficiary.philhealthNumber && (
                    <MatchRow label={t('intake.philhealth', 'PhilHealth')} newVal={formatIntakeField(intake, 'philhealthNumber')} existingVal={c.primaryBeneficiary.philhealthNumber} t={t} />
                  )}
                </div>

                <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${elig.icon === 'info' ? 'bg-primary/5 text-primary' : 'bg-emerald-50 text-emerald-800'}`}>
                  {elig.icon === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{elig.text}</span>
                </div>

                {c.matchedOn && c.matchedOn.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('intake.whyFlagged', 'Why this was flagged')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.matchedOn.map(token => (
                        <span key={token} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {t(MATCHED_ON_KEY[token] || token, MATCHED_ON_FALLBACK[token] || token)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConfirm(c.householdId)}
                    disabled={loadingId === c.householdId}
                  >
                    {loadingId === c.householdId
                      ? t('intake.updating', 'Updating...')
                      : c.caseExistsWithin30Days
                        ? t('intake.updateInfo', 'Yes, update info')
                        : t('intake.updateAndCreate', 'Yes, update info & create case')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDismiss(c)}
                  >
                    {t('intake.differentPerson', 'Not this person')}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length > 0 && (
          <>
            <Separator className="my-2" />

            <div className="text-center space-y-2 py-4">
              <p className="text-sm text-muted-foreground">
                {t('intake.noneMatch', 'None of these match your client?')}
              </p>
              <Button
                variant="outline"
                onClick={handleCreateNew}
                disabled={creatingNew}
              >
                {creatingNew ? t('intake.registering', 'Registering...') : t('intake.registerNewClient', 'Register as new client')}
              </Button>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
