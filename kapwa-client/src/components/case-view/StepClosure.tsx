import { useState } from 'react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Clock, Download, Lock } from 'lucide-react';
import { downloadCsrPdf } from '@/lib/api';
import { StepLockBar, type StepLock } from './StepLockBar';
import { useTranslation } from 'react-i18next';

interface StepClosureProps {
  caseId: string;
  caseData: any;
  readOnly?: boolean;
  /**
   * Whether the seal control is withheld. Separate from `readOnly` because this
   * step's two answers disagree: `readOnly` flips true exactly when the closure
   * is complete (`stepDone[4]`), which is exactly when the step becomes sealable
   * — so routing the body signal to the bar hid the Lock button on the one step
   * it was written for, and the bar rendered `null`. Defaults to `false`, so
   * omitting it can never hide a sealed step's Unlock; a caller that wants the
   * seal control withheld passes `true`.
   */
  lockReadOnly?: boolean;
  /** This step's own seal row, or null — the case view resolves it. */
  stepLock?: StepLock | null;
}

export function StepClosure({ caseId, caseData, readOnly, lockReadOnly = false, stepLock }: StepClosureProps) {
  const { t } = useTranslation();
  const CLOSURE_OUTCOMES = [
    { value: 'graduated', label: t('caseView.closure.outcomeGraduated', 'Graduated'), description: t('caseView.closure.outcomeGraduatedDesc', 'Achieved Level 3 self-sufficiency') },
    { value: 'self_sufficient', label: t('caseView.closure.outcomeSelfSufficient', 'Self-Sufficient'), description: t('caseView.closure.outcomeSelfSufficientDesc', 'No longer needs assistance') },
    { value: 'referred', label: t('caseView.closure.outcomeReferred', 'Referred'), description: t('caseView.closure.outcomeReferredDesc', 'Transferred to another program') },
    { value: 'incomplete', label: t('caseView.closure.outcomeIncomplete', 'Incomplete'), description: t('caseView.closure.outcomeIncompleteDesc', 'Client stopped engaging') },
    { value: 'deceased', label: t('caseView.closure.outcomeDeceased', 'Deceased'), description: t('caseView.closure.outcomeDeceasedDesc', 'Client has passed away') },
  ];
  const { mutate } = useSWRConfig();
  const [saving, setSaving] = useState(false);

  const [closure, setClosure] = useState({
    closureOutcome: caseData?.closureOutcome || '',
    exitNotes: caseData?.exitNotes || '',
  });

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/cases/${caseId}/closure`, {
        closureOutcome: closure.closureOutcome || null,
        exitNotes: closure.exitNotes || null,
      });
      await mutate(queryKeys.cases.detail(caseId));
    } catch (e) {
      console.error('Failed to save closure:', e);
    } finally {
      setSaving(false);
    }
  }

  const isClosed = caseData?.status === 'closed';

  return (
    <div className="space-y-4">
      {/* Closure Status */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('caseView.closure.caseClosure', 'Case Closure')}</h3>
            {readOnly && <Lock size={14} className="text-muted-foreground" />}
          </div>
          <Badge variant={isClosed ? 'default' : 'outline'} className="text-sm">
            {isClosed ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
            {isClosed ? t('caseView.closure.closed', 'Closed') : t('caseView.closure.open', 'Open')}
          </Badge>
        </div>
      </div>

      {/* Closure Outcome */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('caseView.closure.closureOutcome', 'Closure Outcome *')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-2">
          {CLOSURE_OUTCOMES.map(outcome => (
            <label
              key={outcome.value}
              className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                closure.closureOutcome === outcome.value
                  ? 'bg-primary/10 border border-primary'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              <input
                type="radio"
                name="closureOutcome"
                value={outcome.value}
                checked={closure.closureOutcome === outcome.value}
                onChange={e => setClosure(c => ({ ...c, closureOutcome: e.target.value }))}
                className="mt-0.5"
                disabled={isClosed || readOnly}
              />
              <div>
                <p className="text-sm font-medium">{outcome.label}</p>
                <p className="text-xs text-muted-foreground">{outcome.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Exit Notes */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t('caseView.closure.exitNotes', 'Exit Notes')}</h3>
        </div>
        <Separator />
        <div className="px-4 py-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            value={closure.exitNotes}
            onChange={e => setClosure(c => ({ ...c, exitNotes: e.target.value }))}
            placeholder={t('caseView.closure.exitNotesPlaceholder', 'Final notes before case closure...')}
            disabled={isClosed || readOnly}
          />
        </div>
      </div>

      {/* Action Buttons. Only the exit record is saved here; closing the case is
          a forward hop that ends this step's work, so it runs the step-5 seal
          gate and lives on `CaseActionBar`'s "Close case" control. This card used
          to offer a second "Close Case" that closed directly, around that gate. */}
      {!isClosed && !readOnly && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} variant="outline">
            {saving ? t('caseView.saving', 'Saving...') : t('caseView.closure.saveProgress', 'Save Progress')}
          </Button>
        </div>
      )}

      {/* Download CSR PDF */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => downloadCsrPdf(caseId)}
        >
          <Download size={14} /> {t('caseView.closure.downloadCsr', 'Download Case Study Report (CSR)')}
        </Button>
      </div>

      {/* Step 5's seal. `lockReadOnly`, not `readOnly`: the closure form locks
          down once its data is complete, which is the moment this step becomes
          sealable, so the body's signal would withhold the control on precisely
          the case it exists for. */}
      <StepLockBar
        caseId={caseId}
        stepIndex={4}
        caseData={caseData}
        interventionCount={0}
        locked={stepLock}
        readOnly={lockReadOnly}
        onChanged={() => mutate(queryKeys.cases.detail(caseId))}
      />
    </div>
  );
}
