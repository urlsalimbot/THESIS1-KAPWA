import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { stepperStepDone, type StepperProgressOpts } from './CaseStepper';

/** The `case.stepLocks` row as `findById` serializes it. */
export interface StepLock {
  stepIndex: number;
  lockedByName?: string;
  lockedAt: string;
}

export interface StepLockBarProps {
  caseId: string;
  stepIndex: number;
  caseData: any;
  interventionCount: number;
  opts?: StepperProgressOpts;
  locked?: StepLock | null;
  onChanged: () => void | Promise<void>;
  readOnly?: boolean;
}

/**
 * The control that seals one case step, mounted once per step.
 *
 * "Done" is *asked for*, never decided here: `stepperStepDone` already exists
 * twice (this directory's `CaseStepper` and the server's `CaseStepLocksService`),
 * and `docs/superpowers/specs/case-step-done-fixture.json` is what keeps those
 * two from drifting. A third copy in this file would be the one nothing tests,
 * and the server rejects a seal on an unfinished step with a 400 — so a stale
 * local predicate would surface as a raw API error on a button the UI had
 * wrongly enabled.
 *
 * Sealing is reversible by the same two roles (option (a) in the design), so a
 * mistaken seal costs an Unlock, not an admin.
 */
export function StepLockBar({
  caseId,
  stepIndex,
  caseData,
  interventionCount,
  opts,
  locked,
  onChanged,
  readOnly,
}: StepLockBarProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const done = stepperStepDone(stepIndex, caseData, interventionCount, opts ?? {});
  const path = `/cases/${caseId}/steps/${stepIndex}/lock`;
  const notDoneHint = t('caseView.lock.notDoneHint', 'Complete this step before sealing it.');

  async function run(
    request: () => Promise<unknown>,
    failureKey: string,
    failureCopy: string,
  ): Promise<void> {
    // `busy` disables the one control that reaches `run`, so a second click
    // cannot get here; that guard is what keeps one click to one audit row.
    setBusy(true);
    try {
      await request();
      await onChanged();
    } catch (err) {
      toast.error(t(failureKey, failureCopy), { description: humanizeError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          {t('caseView.lock.lockedBy', 'Locked by {{name}} · {{when}}', {
            name: locked.lockedByName || t('caseView.lock.lockedByUnknown', 'Unknown'),
            when: formatDate(locked.lockedAt),
          })}
        </span>
        {/* The record stays readable in readOnly: only the release is withheld. */}
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => api.del(path), 'caseView.lock.unlockFailed', 'Could not release the lock')}
          >
            <LockOpen aria-hidden="true" />
            {t('caseView.lock.unlock', 'Unlock')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!done || busy}
        // `title` is the accessible *description* of a disabled button, which
        // is the half of the reason the plain text below cannot deliver; the
        // text is the half the tooltip cannot, since this button is
        // `pointer-events-none` while disabled and so can never be hovered.
        title={done ? undefined : notDoneHint}
        onClick={() => run(() => api.post(path), 'caseView.lock.lockFailed', 'Could not seal this step')}
      >
        <Lock aria-hidden="true" />
        {t('caseView.lock.lock', 'Lock')}
      </Button>
      {!done && (
        <span className="text-xs text-muted-foreground">
          {notDoneHint}
        </span>
      )}
    </div>
  );
}