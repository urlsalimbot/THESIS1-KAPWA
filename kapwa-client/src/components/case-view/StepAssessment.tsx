import { useState } from 'react';
import { api } from '@/lib/api';
import { isOnline } from '@/lib/sync';
import { queueFsmTransition } from '@/lib/offline-queue';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2 } from '@/lib/constants';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StepLockBar, type StepLock } from './StepLockBar';

interface StepAssessmentProps {
  caseId: string;
  caseData: any;
  assessment: any;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  onSave: () => void;
  saving: boolean;
  userRole?: string;
  readOnly?: boolean;
  /** This step's own seal row, or null — the case view resolves it. */
  stepLock?: StepLock | null;
  /**
   * Whether this step may still be sealed/released. Split from `readOnly`
   * because the seal strip's Unlock has to survive a sealed step: a step whose
   * fields are read-only *because* it is sealed must keep its one way out, or
   * the worker who sealed it is stuck. Defaults to `false`, not `readOnly`, so
   * that omitting it can never accidentally reproduce that lockout — a caller
   * that wants the seal control withheld passes `true`.
   */
  lockReadOnly?: boolean;
}

export function StepAssessment({
  caseId, caseData, assessment, onAssessmentChange, onSave, saving, userRole, readOnly, lockReadOnly = false, stepLock,
}: StepAssessmentProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [transitioning, setTransitioning] = useState(false);
  // "Done" here is what the stepper and the review gate also require: the
  // narrative fields AND a DSWD tool score. Without the score the FSM blocks
  // assessed -> in_review, so offering "Complete Assessment" without it would
  // let a worker advance the case into a state the next step cannot finish.
  const assessmentDone = !!caseData?.problemsPresented && !!caseData?.socialWorkerAssessment && !!caseData?.clientCategory;
  const hasScore = !!(caseData?.frvaScore || caseData?.swdiScore);
  const canTransition = assessmentDone && hasScore && caseData?.status === 'enrolled' && (userRole === 'social_worker' || userRole === 'admin');

  async function markAssessmentComplete() {
    setTransitioning(true);
    try {
      if (!isOnline()) {
        // Offline: queue the FSM transition — it syncs when connectivity returns.
        await queueFsmTransition(caseId, 'assessed');
        toast.success(t('caseView.assessment.queuedOffline', 'Assessment queued — will sync when online.'));
        return;
      }
      await api.patch(`/cases/${caseId}/status`, { status: 'assessed' });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to complete assessment:', e);
    } finally {
      setTransitioning(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t('caseView.assessment.assessmentDiagnosis', 'Assessment & Diagnosis')}</h3>
          {readOnly && <Lock size={14} className="text-muted-foreground" />}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.assessment.problemsPresented', 'Problem/s Presented *')}</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.problemsPresented}
              onChange={e => onAssessmentChange(a => ({ ...a, problemsPresented: e.target.value }))}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.assessment.socialWorkerAssessment', "Social Worker's Assessment *")}</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.socialWorkerAssessment}
              onChange={e => onAssessmentChange(a => ({ ...a, socialWorkerAssessment: e.target.value }))}
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('caseView.assessment.clientCategory', 'Client Category *')}</label>
            <div className="mt-1 space-y-1">
              {CLIENT_CATEGORIES_V2.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="clientCategory" value={cat}
                    checked={assessment.clientCategory === cat}
                    onChange={e => onAssessmentChange(a => ({ ...a, clientCategory: e.target.value }))}
                    className="text-primary" disabled={readOnly} />
                  {cat}
                </label>
              ))}
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={saving}>
                {saving ? t('caseView.saving', 'Saving...') : t('caseView.assessment.saveAssessment', 'Save Assessment')}
              </Button>
              {assessmentDone && !hasScore && caseData?.status === 'enrolled' && (
                <span className="text-xs text-muted-foreground">
                  {t('caseView.assessment.scoreRequiredHint', 'Add an FRVA or SWDI score above to complete the assessment.')}
                </span>
              )}
              {canTransition && (
                <Button onClick={markAssessmentComplete} disabled={transitioning} variant="default">
                  {transitioning ? t('caseView.completing', 'Completing...') : t('caseView.assessment.completeAssessment', '✓ Complete Assessment → Proceed to Intervention')}
                </Button>
              )}
              {caseData?.status === 'assessed' && (
                <span className="text-xs text-emerald-600 font-medium">{t('caseView.assessment.assessmentCompleted', '✓ Assessment completed')}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t('caseView.assessment.dswdTools', 'DSWD Assessment Tools')}</h3>
          {readOnly && <Lock size={14} className="text-muted-foreground" />}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.assessment.frvaScore', 'FRVA Score (0-100)')}</label>
              <input type="number" min="0" max="100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assessment.frvaScore || ''}
                onChange={e => onAssessmentChange(a => ({ ...a, frvaScore: e.target.value ? Number(e.target.value) : null }))}
                placeholder={t('caseView.assessment.frvaPlaceholder', 'Family Risk & Vulnerability Assessment')} disabled={readOnly} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('caseView.assessment.swdiScore', 'SWDI Score (0-100)')}</label>
              <input type="number" min="0" max="100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assessment.swdiScore || ''}
                onChange={e => onAssessmentChange(a => ({ ...a, swdiScore: e.target.value ? Number(e.target.value) : null }))}
                placeholder={t('caseView.assessment.swdiPlaceholder', 'Social Welfare Development Index')} disabled={readOnly} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('caseView.assessment.familyDialogueNotes', 'Family Dialogue Notes')}</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.familyDialogueNotes || ''}
              onChange={e => onAssessmentChange(a => ({ ...a, familyDialogueNotes: e.target.value }))}
              placeholder={t('caseView.assessment.familyDialoguePlaceholder', 'Notes from family dialogue session...')} disabled={readOnly} />
          </div>
          {/* One Save per step — the button above persists this card's fields
              too (the whole assessment object is saved together). */}
        </div>
      </div>

      {/* Step 1's seal. Mounted here, not in the page, so the control that
          offers it lives with the step it seals. `lockReadOnly` is the sealing
          signal, kept apart from the fields' `readOnly` so a sealed step still
          offers its Unlock — the strip above the disabled fields is what tells
          the worker that releasing the seal is how to change them. */}
      <StepLockBar
        caseId={caseId}
        stepIndex={0}
        caseData={caseData}
        interventionCount={0}
        locked={stepLock}
        readOnly={lockReadOnly}
        onChanged={() => mutate(queryKeys.cases.detail(caseId))}
      />
    </div>
  );
}
