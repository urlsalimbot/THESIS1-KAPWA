import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2, CASE_CATEGORY_GROUPS } from '@/lib/constants';
import { Lock, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StepLockBar, type StepLock } from './StepLockBar';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StepAssessmentProps {
  caseId: string;
  caseData: any;
  assessment: any;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  /** The step's save, run by the seal bar before it seals the step. */
  onSave: () => void;
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
  caseId, caseData, assessment, onAssessmentChange, onSave, readOnly, lockReadOnly = false, stepLock,
}: StepAssessmentProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  // The category is editable only while the case is `enrolled`: it defines the
  // step template, and the server refuses a change after that (audit 1.4).
  const categoryLocked = !!caseData?.status && caseData.status !== 'enrolled';
  return (
    <div className="space-y-4">
      {/* One card: the category takes its own column beside the two narratives,
          so a worker picks the client's category with the problems and the
          assessment it rests on still in view, instead of reading them off a
          list that runs past them. */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center gap-2">
          <Stethoscope size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{t('caseView.assessment.assessmentDiagnosis', 'Assessment & Diagnosis')}</h3>
          {caseData?.isIndigenous && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t('caseView.assessment.ipFlag', 'Indigenous Person (IP)')}
            </span>
          )}
          {readOnly && <Lock size={14} className="text-muted-foreground" />}
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {/* Stacks on a phone, side by side from `md` up. Category first, as
              the form reads: it is the choice the narrative below is filed
              under. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t('caseView.assessment.clientCategory', 'Client Category *')}</label>
              <RadioGroup
                  value={assessment.clientCategory}
                  onValueChange={(v) => onAssessmentChange(a => ({ ...a, clientCategory: v }))}
                  className="mt-1 space-y-1"
                  disabled={readOnly}
                >
                  {CLIENT_CATEGORIES_V2.map(cat => (
                    <label key={cat} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                      <RadioGroupItem value={cat} aria-label={cat} />
                      {cat}
                    </label>
                  ))}
                </RadioGroup>
              <div className="mt-4 space-y-1.5">
                <label htmlFor="case-category" className="text-sm font-medium">
                  {t('caseView.assessment.caseCategory', 'Case Category *')}
                </label>
                {/* The MSWDO case category: required with the rest of step 1, so
                    the Case Category column in the cases, dashboard and tracker
                    tables has something to show from day one. The server locks
                    it once the case leaves `enrolled` (the category defines the
                    step template), so the field locks with the same rule instead
                    of letting a save discover it (audit 1.4). */}
                <Select
                  value={assessment.caseCategory || ''}
                  onValueChange={v => onAssessmentChange(a => ({ ...a, caseCategory: v }))}
                  disabled={readOnly || categoryLocked}
                >
                  <SelectTrigger id="case-category" aria-required="true">
                    <SelectValue placeholder={t('caseView.assessment.selectCaseCategory', 'Select a category…')} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix has no optgroup: quiet header items carry the
                        group labels, then the selectable entries. */}
                    {CASE_CATEGORY_GROUPS.map(group => (
                      <div key={group.key} role="none">
                        <SelectItem value={`__group:${group.key}`} disabled className="pointer-events-none text-xs font-semibold text-muted-foreground">
                          {t(group.key, group.fallback)}
                        </SelectItem>
                        {group.items.map(item => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {categoryLocked && !readOnly && (
                  <p className="text-xs text-muted-foreground">
                    {t('caseView.assessment.categoryLocked', 'The case category cannot change once the case leaves Enrolled — it defines this case’s step template.')}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="problems-presented" className="text-sm font-medium">{t('caseView.assessment.problemsPresented', 'Problem/s Presented *')}</label>
                <Textarea
                  id="problems-presented"
                  className="min-h-[80px]"
                  value={assessment.problemsPresented}
                  onChange={e => onAssessmentChange(a => ({ ...a, problemsPresented: e.target.value }))}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="social-worker-assessment" className="text-sm font-medium">{t('caseView.assessment.socialWorkerAssessment', "Social Worker's Assessment *")}</label>
                <Textarea
                  id="social-worker-assessment"
                  className="min-h-[80px]"
                  value={assessment.socialWorkerAssessment}
                  onChange={e => onAssessmentChange(a => ({ ...a, socialWorkerAssessment: e.target.value }))}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label htmlFor="family-dialogue-notes" className="text-sm font-medium">{t('caseView.assessment.familyDialogueNotes', 'Family Dialogue Notes')}</label>
            <Textarea
              id="family-dialogue-notes"
              className="min-h-[80px]"
              value={assessment.familyDialogueNotes || ''}
              onChange={e => onAssessmentChange(a => ({ ...a, familyDialogueNotes: e.target.value }))}
              placeholder={t('caseView.assessment.familyDialoguePlaceholder', 'Notes from family dialogue session...')} disabled={readOnly} />
          </div>

          {/* No Save or Complete button here: the seal bar below is this
              step's submit. Sealing the Assessment step saves the fields, locks
              the step and advances the case to Assessed. */}
          {caseData?.status === 'assessed' && (
            <span className="text-xs text-success font-medium">{t('caseView.assessment.assessmentCompleted', '✓ Assessment completed')}</span>
          )}
        </div>
      </div>

      {/* Step 1's seal. Mounted here, not in the page, so the control that
          offers it lives with the step it seals — and it is this step's submit:
          it saves the assessment on its way to sealing it. `lockReadOnly` is the
          sealing signal, kept apart from the fields' `readOnly` so a sealed step
          still offers its Unlock — the strip above the disabled fields is what
          tells the worker that releasing the seal is how to change them. */}
      <StepLockBar
        caseId={caseId}
        stepKey="assessment"
        caseData={{ ...caseData, ...assessment }}
        interventionCount={0}
        locked={stepLock}
        readOnly={lockReadOnly}
        onBeforeLock={onSave}
        onChanged={() => mutate(queryKeys.cases.detail(caseId))}
      />
    </div>
  );
}
