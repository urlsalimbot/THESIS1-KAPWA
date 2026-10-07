import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { buildPrefilledFamily } from '@/components/intake/prefillFamily';
import { MatchCandidateCard, type MatchCandidate } from '@/components/intake/MatchCardSections';
import { personFullName } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { uploadIntakeIdPhotos } from '@/lib/intake-id-photo';
import { useAuth } from '@/lib/auth-context';
import { clearDraft } from '@/hooks/useIntakeAutosave';

interface LocationState {
  candidates: MatchCandidate[];
  intakeData: any;
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

  async function handleConfirm(householdId: string, createCase: boolean = true) {
    setLoadingId(householdId);
    try {
      const candidate = sorted.find(c => c.householdId === householdId);
      let body = intakeData;
      if (candidate?.matchedPerson?.role === 'member' && intakeData?.beneficiary) {
        // Member matches follow the same inversion as the pop-up prefill: the
        // matched person becomes the beneficiary, so the roster's relationships
        // (stored relative to the old head) are re-expressed relative to them —
        // old head Parent -> new beneficiary Child, and so on — and the
        // matched person is removed from the family list.
        body = {
          ...intakeData,
          familyMembers: buildPrefilledFamily(candidate).map(m => ({
            surname: m.surname,
            firstName: m.firstName,
            middleName: m.middleName || '',
            gender: m.gender,
            dob: m.dob,
            age: m.age,
            relationship: m.relationship,
            occupation: m.occupation,
            income: m.income != null ? Number(m.income) : undefined,
            status: m.status || '',
          })),
        };
      }
      const result = await api.post<{ caseCreated: boolean; caseId?: string; message: string }>(
        `/intake/confirm/${householdId}`,
        { ...body, createCase },
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
          const matched = c.matchedPerson ?? c.primaryBeneficiary;
          const fullName = personFullName(matched.firstName, matched.middleName, matched.surname);
          return (
            <MatchCandidateCard
              key={c.householdId}
              candidate={c}
              intake={intake}
              testId="match-card"
              regionLabel={t('intake.cardRegion', '{{name}} — possible match', { name: fullName })}
            >
              <Button
                variant="default"
                size="sm"
                onClick={() => handleConfirm(c.householdId)}
                disabled={loadingId === c.householdId}
              >
                {loadingId === c.householdId
                  ? t('intake.updating', 'Updating...')
                  : c.matchedPerson?.role === 'member' || !c.caseExistsWithin30Days
                    ? t('intake.updateAndCreate', 'Yes, update info & create case')
                    : t('intake.updateInfo', 'Yes, update info')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirm(c.householdId, false)}
                disabled={loadingId === c.householdId}
              >
                {loadingId === c.householdId
                  ? t('intake.updating', 'Updating...')
                  : t('intake.updateRecordOnly', 'Update household record only — no new case')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismiss(c)}
              >
                {t('intake.differentPerson', 'Not this person')}
              </Button>
            </MatchCandidateCard>
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
