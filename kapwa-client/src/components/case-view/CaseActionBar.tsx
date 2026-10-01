import { useState } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { statusLabel } from '@/i18n/display';
import { CASE_ADMIN_ROLE, canTransitionCase } from '@/lib/role-access';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { stepsDueAt, STEP_LABEL_KEYS } from './CaseStepper';
import type { StepLock } from './StepLockBar';

export interface CaseActionBarProps {
  caseId: string;
  caseData: any;
  userRole: string;
  onChanged: () => void | Promise<void>;
}

/**
 * The lifecycle, in the order the FSM moves through it. Mirrors `CaseStatus` in
 * `kapwa-server/src/cases/case.entity.ts` and is checked against it by
 * `src/lib/case-fsm-parity.test.ts`, so the two cannot drift silently.
 */
type CaseStatus =
  | 'enrolled' | 'assessed' | 'in_review' | 'active' | 'transitioning' | 'closed';

/** An i18n key with the English text to fall back on. */
type Copy = { key: string; fallback: string };

/**
 * An edge a step card already offers, gated on data only that card can see —
 * `StepAssessment` on the FRVA/SWDI score, `StepTransition` on the saved
 * transition plan. Recorded so the map says "this edge exists, and not here";
 * carries no copy, because nothing renders it.
 *
 * It is not "because two buttons are untidy". Offering them here would mean
 * either shipping a control whose precondition the client cannot check (the
 * server rejects `active -> transitioning` without a self-reliance level, a
 * sustainability plan and a referral decision — three rules this component would
 * have to copy, with nothing keeping the copies honest, which is the drift this
 * whole feature exists to prevent), or deleting a contextual control from the
 * card the user is filling in and making them scroll to a bar underneath it. The
 * bar owns the edges whose precondition the client already holds: the step seals
 * and the approval signature.
 */
interface SuppressedEdge {
  /** The status this edge moves the case to. */
  to: CaseStatus;
  /** The endpoint that performs it, for the record. */
  path: string;
  ownedByStepCard: true;
}

/** An edge the bar performs itself, behind a confirm dialog. */
interface RenderedHop {
  to: CaseStatus;
  path: string;
  ownedByStepCard?: false;
  /**
   * `in_review -> active` is the one hop that records *who* approved, so it goes
   * through `/approve` (which `@Roles('admin')`) rather than `/status`. The rest
   * are status changes and use the generic endpoint, except closure which has its
   * own.
   */
  needsSignature: boolean;
  label: Copy;
  title: Copy;
  body: Copy;
  /**
   * A worker-facing label, where the same transition reads differently to the
   * two roles. `assessed -> in_review` is a hand-*off* to an administrator and a
   * *send* by one, and telling the worker it is a hand-off is the whole reason
   * the confirm dialog exists.
   */
  workerLabel?: Copy;
  /**
   * Every step *due at this status* must be sealed first. Only enforced for
   * non-admin roles: the server exempts `admin` from this one gate (an admin
   * that could not move a case at all would be worse than the gap it closes).
   */
  gateOnDueStepLocks?: boolean;
}

type CaseHop = SuppressedEdge | RenderedHop;

/**
 * The forward hops, keyed by the status they leave from — an entry per lifecycle
 * position that has a successor, so an edge belonging to a step card is recorded
 * as `ownedByStepCard` rather than missing, and a status with no successor
 * (`closed`) is simply absent.
 *
 * Three edges live here and two do not. The bar is deliberately *not* the one
 * place every forward transition happens from: it is the one place the
 * transitions whose preconditions the client can see happen from.
 *
 * Named hops rather than one generic "Advance": a control whose effect depends on
 * state the user cannot see is exactly the accident this bar replaces, and the
 * server's validation rules (assessment fields, FRVA/SWDI, the all-locked gate,
 * activation documents, self-reliance plan) make those effects materially
 * different.
 *
 * `Partial`, not a `Record` over the five non-terminal statuses: two of them
 * carry no copy at all, so there is nothing for the compiler to require. What
 * keeps the map honest instead is `CaseActionBar.test.tsx`, which walks all six
 * statuses and asserts what renders at each — so a status that silently loses its
 * hop is caught as behaviour, which is the failure that actually matters.
 */
const FORWARD_HOPS: Partial<Record<CaseStatus, CaseHop>> = {
  // `StepAssessment`'s "Complete Assessment": the card holding the fields, and
  // it already withholds the control until an FRVA/SWDI score exists.
  enrolled: { to: 'assessed', path: '/cases/%s/status', ownedByStepCard: true },
  assessed: {
    to: 'in_review',
    path: '/cases/%s/status',
    needsSignature: false,
    label: { key: 'caseView.action.sendToReview', fallback: 'Send to review' },
    workerLabel: { key: 'caseView.action.flagForReview', fallback: 'Flag for admin review' },
    title: { key: 'caseView.action.flagConfirmTitle', fallback: 'Flag for admin review?' },
    body: {
      key: 'caseView.action.flagConfirmBody',
      fallback: 'This hands the case to an administrator for approval. It moves to In Review, and an administrator decides whether it activates.',
    },
    gateOnDueStepLocks: true,
  },
  in_review: {
    to: 'active',
    path: '/cases/%s/approve',
    needsSignature: true,
    label: { key: 'caseView.action.approveActivate', fallback: 'Approve & activate' },
    title: { key: 'caseView.action.approveTitle', fallback: 'Approve and activate this case?' },
    body: {
      key: 'caseView.action.approveBody',
      fallback: 'The case moves from In Review to Active. Your signature is recorded as the approver.',
    },
  },
  // `StepTransition`'s "Mark Ready for Graduation", beside the plan it needs.
  active: { to: 'transitioning', path: '/cases/%s/status', ownedByStepCard: true },
  transitioning: {
    to: 'closed',
    path: '/cases/%s/close',
    needsSignature: false,
    label: { key: 'caseView.action.closeCase', fallback: 'Close case' },
    title: { key: 'caseView.action.closeTitle', fallback: 'Close this case?' },
    body: {
      key: 'caseView.action.closeBody',
      fallback: 'The case moves from Transitioning to Closed. Closure requires the client signature and the closure outcome already recorded.',
    },
  },
};

/** Replaces the `%s` placeholder in a hop's endpoint with the case id. */
function endpoint(caseId: string, path: string): string {
  return path.replace('%s', caseId);
}

/**
 * The deliberate controls for the case transitions whose preconditions the
 * client already holds: the step seals, and the approval signature.
 *
 * One control per case view, mounted once. It is the only place a worker can
 * flag a case for review: `StepImplementHIP`'s `ReviewButton` used to be a second
 * one, and it carried none of the gating below — two controls for one transition
 * means one of them is a way around the rule.
 *
 * Fail-closed, and split from the control itself so the guard does not have to be
 * repeated inside a callback: no hop for this status, an edge a step card owns,
 * or a role the FSM does not admit — nothing renders at all. `StepLockBar`
 * withholds its buttons from a viewer for the same reason.
 */
export function CaseActionBar({ caseId, caseData, userRole, onChanged }: CaseActionBarProps) {
  const status = (caseData?.status ?? null) as CaseStatus | null;
  if (status == null) return null;
  const hop = FORWARD_HOPS[status];
  if (!hop || hop.ownedByStepCard || !canTransitionCase(status, userRole)) return null;
  return (
    <CaseHopControl
      caseId={caseId}
      caseData={caseData}
      userRole={userRole}
      status={status}
      hop={hop}
      onChanged={onChanged}
    />
  );
}

/**
 * One hop's control. `hop` arrives resolved and non-optional, so the gate, the
 * confirm dialog and the write all agree on which transition this is.
 *
 * The all-locked gate asks for the steps **due at the current lifecycle
 * position**, not for all five, and reads that set from `stepsDueAt` so it agrees
 * with the floors `StepLockBar` enforces and with the server's own gate
 * (`stepsDueAt` in `kapwa-server/src/cases/case-step-labels.ts`). Asking for all
 * five made the gate unsatisfiable: at `assessed`, steps 4 and 5 cannot be sealed
 * at all, so no social worker could ever flag a case.
 */
function CaseHopControl({
  caseId, caseData, userRole, status, hop, onChanged,
}: CaseActionBarProps & { status: CaseStatus; hop: RenderedHop }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * What this bar last committed, for the window in which the parent has not
   * re-read it yet — which, when the reload fails, is forever.
   *
   * `from` is the status the case was in when the write landed. While the parent
   * still reports that same status this bar knows better than it does; the moment
   * it moves — a revalidation, another tab, a plain reload — the parent wins and
   * this record is ignored. Same shape as `StepLockBar`'s `mine`, and for the same
   * reason: without it, a committed transition the page never learns about leaves
   * an *enabled* control for a transition that has already happened, and the
   * second press comes back "could not be moved" — a change that succeeded
   * reported as a failure, which is what makes people perform it a third time.
   */
  const [mine, setMine] = useState<{ from: CaseStatus; to: CaseStatus } | null>(null);
  const committed = mine && mine.from === status ? mine : null;

  const isAdmin = userRole === CASE_ADMIN_ROLE;
  const label = hop.workerLabel && !isAdmin ? hop.workerLabel : hop.label;

  /**
   * The steps due at this position that are not sealed yet — the worker's half
   * of "you are not ready", rendered by name rather than greying out silently.
   * Read through the same `stepsDueAt` the server's gate reads.
   */
  const openSteps = hop.gateOnDueStepLocks && !isAdmin
    ? stepsDueAt(status).filter((i) =>
        !((caseData?.stepLocks ?? []) as StepLock[]).some((l) => l?.stepIndex === i),
      )
    : [];
  const gated = openSteps.length > 0;

  const signatureMissing = hop.needsSignature && signature.trim().length === 0;

  const stepName = (i: number): string => {
    const entry = STEP_LABEL_KEYS[i];
    return entry ? t(entry.key, entry.fallback) : `#${i + 1}`;
  };

  /**
   * The committed case, stated and not offered again. No button at all rather
   * than a disabled one: a control for a transition that has already happened is
   * a question the page cannot answer, and a worker pressing it is told the case
   * could not be moved — the worst possible answer about a move that worked.
   */
  if (committed) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check aria-hidden="true" />
          {t('caseView.action.movedTo', 'Moved to {{status}}.', { status: statusLabel(t, committed.to) })}
        </p>
      </div>
    );
  }

  async function submit() {
    if (busy || signatureMissing || gated) return;
    setBusy(true);
    // Cleared on the way in, so a stale refusal cannot outlive the retry that is
    // meant to replace it.
    setFailure(null);
    try {
      try {
        if (hop.needsSignature) {
          // `signature` is the field `ApproveCaseSchema` names; anything else is
          // dropped by the schema and the approval lands with no approver on it.
          await api.patch(endpoint(caseId, hop.path), { status: hop.to, signature: signature.trim() });
        } else if (hop.to === 'closed') {
          await api.patch(endpoint(caseId, hop.path));
        } else {
          await api.patch(endpoint(caseId, hop.path), { status: hop.to });
        }
      } catch (err) {
        // Nothing committed. The server's own words, unmodified: for the
        // all-locked gate that message already names the open steps in the
        // stepper's labels, and paraphrasing it would throw that away.
        setFailure(humanizeError(err));
        toast.error(t('caseView.action.transitionFailed', 'The case could not be moved'), {
          description: humanizeError(err),
        });
        return;
      }
      // Committed. Recorded *before* the refresh, not after it: `onChanged` is
      // the step most likely to fail, and the whole point of this record is the
      // case where it does. Close the dialog and stop offering the hop at the same
      // moment, so a committed transition cannot be performed twice from this bar.
      setMine({ from: status, to: hop.to });
      setOpen(false);
      setSignature('');
      try {
        await onChanged();
      } catch (err) {
        // A separate problem from the write, and used to share one message with
        // it: telling someone a committed transition failed is what makes them
        // perform it a second time.
        toast.error(t('caseView.action.refreshFailed', 'The case moved, but the page did not refresh'), {
          description: humanizeError(err),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* No heading repeating the button's own name — the button says what the
              action is; this line says what it will do, which it does not. */}
          <p className="text-xs text-muted-foreground">
            {gated
              ? t('caseView.action.lockedStepsHint', 'Seal the steps below, then flag this case for review.')
              : t('caseView.action.nextStatusHint', 'Moves this case to {{status}}.', {
                  // The shared status vocabulary, so this names the next status
                  // the way the badge and the history trail already spell it.
                  status: statusLabel(t, hop.to),
                })}
          </p>
          <Button
            size="sm"
            disabled={gated || busy}
            // `title` is the accessible *description* of a disabled button, which
            // is the half the list below cannot deliver; the list is the half a
            // `pointer-events-none` button can never show as a tooltip. Same two
            // mechanisms as `StepLockBar`, for the same reason.
            title={gated ? t('caseView.action.lockedStepsTitle', 'Steps still open: {{names}}', { names: openSteps.map(stepName).join(', ') }) : undefined}
            onClick={() => { setFailure(null); setOpen(true); }}
          >
            <ArrowRight aria-hidden="true" />
            {t(label.key, label.fallback)}
          </Button>
        </div>
        {gated && (
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock size={12} aria-hidden="true" />
              {t('caseView.action.lockedStepsHeading', 'Seal these steps before flagging for review:')}
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {openSteps.map((i) => (
                <li key={i}>{stepName(i)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next && !busy) { setOpen(false); setFailure(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(hop.title.key, hop.title.fallback)}</DialogTitle>
            <DialogDescription>{t(hop.body.key, hop.body.fallback)}</DialogDescription>
          </DialogHeader>
          {hop.needsSignature && (
            <div className="space-y-1.5">
              <label htmlFor="case-action-signature" className="text-sm font-medium">
                {t('caseView.action.signatureLabel', 'Approver signature')}
              </label>
              <input
                id="case-action-signature"
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                aria-describedby={signatureMissing ? 'case-action-signature-hint' : undefined}
              />
              {signatureMissing && (
                <p id="case-action-signature-hint" className="text-xs text-muted-foreground">
                  {t('caseView.action.signatureRequired', 'Enter your signature to approve.')}
                </p>
              )}
            </div>
          )}
          {/* `role="alert"` so the refusal is announced, and verbatim: for the
              all-locked gate this string names the open steps the bar itself
              computed, which is the one answer a stuck worker actually needs. */}
          {failure && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setOpen(false); setFailure(null); }}>
              {t('caseView.action.cancel', 'Cancel')}
            </Button>
            <Button disabled={busy || signatureMissing || gated} onClick={submit}>
              {t('caseView.action.confirm', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}