import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MatchCandidateCard, type MatchCandidate, type MatchIntakeFields } from './MatchCardSections';

export function MatchProbeDialog({
  candidates,
  intake,
  onConfirm,
  onUpdateOnly,
  onDismiss,
}: {
  candidates: MatchCandidate[];
  /** The details the worker just entered, for the "You entered" column. */
  intake?: MatchIntakeFields;
  onConfirm: (candidate: MatchCandidate) => void;
  /** Same household, but update the records without opening a new case. */
  onUpdateOnly: (candidate: MatchCandidate) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('intake.matchProbeTitle', 'Possible existing household')}</DialogTitle>
          <DialogDescription>
            {t('intake.matchProbeDesc', 'The client may already be on record. Review each household and confirm with the client.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sorted.map((c) => (
            <MatchCandidateCard key={c.householdId} candidate={c} intake={intake}>
              <Button size="sm" onClick={() => onConfirm(c)}>
                {t('intake.matchProbeConfirm', 'This is the client’s household')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onUpdateOnly(c)}>
                {t('intake.updateRecordOnly', 'Update household record only — no new case')}
              </Button>
            </MatchCandidateCard>
          ))}
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
