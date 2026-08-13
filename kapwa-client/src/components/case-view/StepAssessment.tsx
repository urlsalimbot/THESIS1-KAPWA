import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2 } from '@/lib/constants';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StepAssessmentProps {
  caseId: string;
  caseData: any;
  assessment: any;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  onSave: () => void;
  saving: boolean;
  userRole?: string;
  readOnly?: boolean;
}

export function StepAssessment({
  caseId, caseData, assessment, onAssessmentChange, onSave, saving, userRole, readOnly,
}: StepAssessmentProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [transitioning, setTransitioning] = useState(false);
  const assessmentDone = !!caseData?.problemsPresented && !!caseData?.socialWorkerAssessment && !!caseData?.clientCategory;
  const canTransition = assessmentDone && caseData?.status === 'enrolled' && (userRole === 'social_worker' || userRole === 'admin');

  async function markAssessmentComplete() {
    setTransitioning(true);
    try {
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
              {canTransition && (
                <Button onClick={markAssessmentComplete} disabled={transitioning} variant="default">
                  {transitioning ? t('caseView.completing', 'Completing...') : t('caseView.assessment.completeAssessment', '✓ Complete Assessment → Proceed to Intervention')}
                </Button>
              )}
              {caseData?.status === 'assessed' && (
                <span className="text-xs text-green-600 font-medium">{t('caseView.assessment.assessmentCompleted', '✓ Assessment completed')}</span>
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
          {!readOnly && (
            <Button onClick={onSave} disabled={saving}>
              {saving ? t('caseView.saving', 'Saving...') : t('caseView.assessment.saveTools', 'Save Assessment Tools')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
