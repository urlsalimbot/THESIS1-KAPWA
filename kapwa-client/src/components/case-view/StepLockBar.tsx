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
 * The React key for one step's mount: the case **and** the step index.
 *
 * This bar records the outcome of its own write in local state that carries
 * neither a step index nor a case id, so a reused instance would render
 * whichever step or case it last sealed. One definition, because the case view
 * and the specs have to build the same key and a copy on either side is how they
 * would disagree about which mounts may share an instance.
 *
 * The two halves are not equally load-bearing today, and the difference is worth
 * knowing before anyone "simplifies" this:
 *
 *  - **The case half is tested.** The case view's five mounts outlive a
 *    case-to-case navigation — the route swaps, the array does not — so a bar can
 *    genuinely be reused across two cases and show a seal the new case never
 *    had. `StepLocksAcrossSteps.test.tsx` fails if the case drops out.
 *  - **The step half is future-proofing.** The view renders one step at a time
 *    out of `stepComponents`, and each entry is a different component type, so
 *    switching steps unmounts whatever stood there whether or not the key varies.
 *    No test distinguishes the key from a bare step index today; it is kept so
 *    that mounting more than one step at a time — the shape `StepLockBar` was
 *    reviewed for — stays correct without revisiting this file.
 */
export function stepLockKey(caseId: string, stepIndex: number): string {
  return `${caseId}:${stepIndex}`;
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
  // What this bar last wrote, for the window in which the parent has not
  // re-read it yet. `present` is the parent's answer at the time of the write;
  // while the parent still reports that same answer this bar knows better, and
  // the moment the parent's answer moves — a refresh that lands later, or
  // another worker — the parent wins. Comparing presence rather than identity
  // keeps an unrelated parent re-render (a new object literal for the same row)
  // from wiping the override.
  const [mine, setMine] = useState<{ present: boolean; row: StepLock | null } | null>(null);

  const done = stepperStepDone(stepIndex, caseData, interventionCount, opts ?? {});
  const path = `/cases/${caseId}/steps/${stepIndex}/lock`;
  const notDoneHint = t('caseView.lock.notDoneHint', 'Complete this step before sealing it.');
  const parentSealed = Boolean(locked);
  const lock = mine && mine.present === parentSealed ? mine.row : locked;

  /**
   * Run one write, then report the refresh separately.
   *
   * The two failures are different problems and used to share one `try`, which
   * told the user their seal had failed when in fact it had committed — and a
   * user told that, still looking at an enabled Lock, presses it again, and the
   * second seal writes a second audit row for a step already sealed. `busy`
   * stops a double-click; nothing else stops that retry, so the write's outcome
   * is recorded here as soon as it is known.
   */
  async function run(
    request: () => Promise<unknown>,
    failureKey: string,
    failureCopy: string,
    written: (result: unknown) => void,
  ): Promise<void> {
    // `busy` disables the one control that reaches `run`, so a second click
    // cannot get here; it is also what keeps a failed control from staying
    // dead, since the `finally` below releases it on both paths.
    setBusy(true);
    try {
      let result: unknown;
      try {
        result = await request();
      } catch (err) {
        // Nothing was committed, so the user's next press is a first attempt,
        // not a duplicate. Say what the server said about this attempt.
        toast.error(t(failureKey, failureCopy), { description: humanizeError(err) });
        return;
      }
      written(result);
      try {
        await onChanged();
      } catch (err) {
        // The write is committed and the record on screen is behind it. Not the
        // write's failure, so not the write's copy.
        toast.error(t('caseView.lock.refreshFailed', 'Saved, but the case did not refresh'), {
          description: humanizeError(err),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const sealWritten = (result: unknown) => {
    // The POST answers with the row it wrote, so who sealed it and when are
    // known even if the reload behind it never lands. A response missing them
    // renders the format helper's own "—" rather than an invented value.
    const row = (result ?? {}) as Partial<StepLock>;
    setMine({
      present: parentSealed,
      row: { stepIndex, lockedByName: row.lockedByName, lockedAt: row.lockedAt ?? '' },
    });
  };

  const releaseWritten = () => {
    setMine({ present: parentSealed, row: null });
  };

  if (lock) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          {t('caseView.lock.lockedBy', 'Locked by {{name}} · {{when}}', {
            name: lock.lockedByName || t('caseView.lock.lockedByUnknown', 'Unknown'),
            when: formatDate(lock.lockedAt),
          })}
        </span>
        {/* The record stays readable in readOnly: only the release is withheld. */}
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => api.del(path), 'caseView.lock.unlockFailed', 'Could not release the lock', releaseWritten)}
          >
            <LockOpen aria-hidden="true" />
            {t('caseView.lock.unlock', 'Unlock')}
          </Button>
        )}
      </div>
    );
  }

  // A viewer with no write role gets neither control, so there is nothing left
  // to render: no button to seal with, and no "complete this step before
  // sealing it" either, which would ask them for an action they cannot take.
  if (readOnly) return null;

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
        onClick={() => run(() => api.post(path), 'caseView.lock.lockFailed', 'Could not seal this step', sealWritten)}
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