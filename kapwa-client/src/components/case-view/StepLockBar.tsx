import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { stepperStepDone, statusAtLeast, statusForFloor, STEP_FLOORS, type StepperProgressOpts } from './CaseStepper';
import { statusLabel } from '@/i18n/display';

/** The `case.stepLocks` row as `findById` serializes it. */
export interface StepLock {
  stepKey: string;
  lockedByName?: string;
  lockedAt: string;
}

export interface StepLockBarProps {
  caseId: string;
  /** The stable step key (`assessment`, `discernment`, `closure`, …). */
  stepKey: string;
  caseData: any;
  interventionCount: number;
  /** Defaults to 0 for steps that do not weigh enrollments. */
  enrollmentCount?: number;
  opts?: StepperProgressOpts;
  locked?: StepLock | null;
  onChanged: () => void | Promise<void>;
  readOnly?: boolean;
}

/**
 * The React key for one step's mount: the case **and** the step key.
 *
 * This bar records the outcome of its own write in local state that carries
 * neither a step key nor a case id, so a reused instance would render
 * whichever step or case it last sealed. One definition, because the case view
 * and the specs have to build the same key and a copy on either side is how they
 * would disagree about which mounts may share an instance.
 *
 * The two halves are not equally load-bearing today, and the difference is worth
 * knowing before anyone "simplifies" this:
 *
 *  - **The case half is tested.** The case view's mounts outlive a
 *    case-to-case navigation — the route swaps, the array does not — so a bar can
 *    genuinely be reused across two cases and show a seal the new case never
 *    had. `StepLocksAcrossSteps.test.tsx` fails if the case drops out.
 *  - **The step half is future-proofing.** The view renders one step at a time
 *    out of `stepComponents`, and each entry is a different component type, so
 *    switching steps unmounts whatever stood there whether or not the key varies.
 *    No test distinguishes the key from a bare step key today; it is kept so
 *    that mounting more than one step at a time — the shape `StepLockBar` was
 *    reviewed for — stays correct without revisiting this file.
 */
export function stepLockKey(caseId: string, stepKey: string): string {
  return `${caseId}:${stepKey}`;
}

/**
 * Whether two `stepLocks` rows are the same seal.
 *
 * `lockedAt` is the identity of a seal — one timestamp per seal, stable across
 * reloads. Two rows sharing it are the same seal; two with different ones are
 * different seals even when both are sealed, which is the case a presence-only
 * comparison cannot see. A row with no timestamp cannot identify itself, so the
 * whole row is compared instead of letting two unknowns look identical.
 */
function sameRow(a: StepLock | null, b: StepLock | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.lockedAt && b.lockedAt) return a.lockedAt === b.lockedAt;
  return a.lockedByName === b.lockedByName && a.lockedAt === b.lockedAt;
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
  stepKey,
  caseData,
  interventionCount,
  enrollmentCount = 0,
  opts,
  locked,
  onChanged,
  readOnly,
}: StepLockBarProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  // What this bar last wrote, for the window in which the parent has not
  // re-read it yet. `parentRow` is the parent's row at the time of the write;
  // while the parent still reports that same row this bar knows better, and the
  // moment the parent's row changes — a refresh that lands later, or another
  // worker — the parent wins. Comparing by `lockedAt` (the seal's identity)
  // rather than by presence keeps an unrelated parent re-render (a new object
  // literal for the same row) from wiping the override, while still letting a
  // second writer that swaps one sealed row for a different one take over.
  const [mine, setMine] = useState<{ row: StepLock | null; parentRow: StepLock | null } | null>(null);

  const done = stepperStepDone(stepKey, caseData, interventionCount, enrollmentCount, opts ?? {});
  const path = `/cases/${caseId}/steps/${stepKey}/lock`;
  // Two different reasons disable the button, and they ask for opposite things.
  // Below the step's lifecycle floor the work is not owed yet — a case at
  // `in_review` with a recorded hearing was the complaint this answers. Only
  // once the case is far enough along does "finish this step" tell the truth.
  const floor = STEP_FLOORS[stepKey] ?? 0;
  const requiredStatus = statusForFloor(floor);
  const notDoneHint = !statusAtLeast(caseData, floor) && requiredStatus
    ? t(
        'caseView.lock.notDueHint',
        'This step opens once the case reaches {{status}}.',
        { status: statusLabel(t, requiredStatus) },
      )
    : t('caseView.lock.notDoneHint', 'Complete this step before sealing it.');
  const lock = mine && sameRow(mine.parentRow, locked ?? null) ? mine.row : locked;

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
      parentRow: locked ?? null,
      row: { stepKey, lockedByName: row.lockedByName, lockedAt: row.lockedAt ?? '' },
    });
  };

  const releaseWritten = () => {
    setMine({ parentRow: locked ?? null, row: null });
  };

  if (lock) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          <span className="flex flex-col gap-0.5">
            <span>
              {t('caseView.lock.lockedBy', 'Locked by {{name}} · {{when}}', {
                name: lock.lockedByName || t('caseView.lock.lockedByUnknown', 'Unknown'),
                when: formatDate(lock.lockedAt),
              })}
            </span>
            {/* Why the step's fields are now read-only. The server refuses a
                write to a sealed step (a 409 naming the seal), so a worker who
                finds a disabled field would otherwise have no account of why —
                and the deliberate-action model is "seal is a claim, release is a
                decision", which is only true if releasing is visibly the way out.
                Said in both languages, and on the strip itself rather than only in
                a toast, because the fields are disabled before anyone presses
                anything. */}
            <span className="text-xs text-muted-foreground/80">
              {t('caseView.lock.sealedNotice', 'This step is sealed. Unlock it to make changes, then seal it again.')}
            </span>
          </span>
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