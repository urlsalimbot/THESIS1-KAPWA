import { CaseStatus } from './case.entity';

// Documented case lifecycle. Closure is only reachable through Phase-Out
// (transitioning); closing directly from enrolled/assessed/in_review/active would
// skip the self-reliance evaluation and the case study. Admins who must close a
// case early use the audited override endpoint (reason required).
export const CASE_FSM: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.ENROLLED]: [CaseStatus.ASSESSED],
  [CaseStatus.ASSESSED]: [CaseStatus.IN_REVIEW],
  [CaseStatus.IN_REVIEW]: [CaseStatus.ACTIVE],
  [CaseStatus.ACTIVE]: [CaseStatus.TRANSITIONING],
  [CaseStatus.TRANSITIONING]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [CaseStatus.AFTERCARE],
  // Terminal: post-closure follow-up phase (DSWD AO 10 s. 2007 §VIII.G — the
  // case returns to the C/MSWDO for aftercare services after termination).
  [CaseStatus.AFTERCARE]: [],
};

// Non-admin roles allowed to act from each status. `admin` is always allowed
// (short-circuited in canTransition), so it is not repeated here. These match the
// controller role gates — a role listed here must have a reachable endpoint:
//   enrolled/assessed -> social_worker (request review, submit for review)
//   transitioning     -> social_worker (close)
//   closed            -> social_worker, admin (move to aftercare)
export const CASE_FSM_ROLES: Record<CaseStatus, string[]> = {
  [CaseStatus.ENROLLED]: ['social_worker'],
  [CaseStatus.ASSESSED]: ['social_worker'],
  [CaseStatus.IN_REVIEW]: [],
  [CaseStatus.ACTIVE]: [],
  [CaseStatus.TRANSITIONING]: ['social_worker'],
  [CaseStatus.CLOSED]: ['social_worker'],
  [CaseStatus.AFTERCARE]: [],
};

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_FSM[from] ?? []).includes(to);
}

export function canTransition(from: CaseStatus, role: string): boolean {
  if (role === 'admin') return true;
  return (CASE_FSM_ROLES[from] ?? []).includes(role);
}

/**
 * Who the case waits on once it reaches a status, and the action they owe it.
 * A status whose forward edge is admin-only (`in_review`) puts the case in the
 * admin's queue; the rest are the worker's. `closed`/`aftercare` wait on nobody
 * — the existing status-change notice is all they carry.
 *
 * Declared here beside the roles because it is the same fact seen from the
 * other side: `CASE_FSM_ROLES` says who *may* act from a status, this says who
 * *must* — and the notification layer reads it so a case is never parked
 * waiting on someone nobody told.
 */
export interface CaseNextAction {
  audience: 'admin' | 'worker';
  action: string;
}

export const CASE_NEXT_ACTION: Record<string, CaseNextAction | null> = {
  [CaseStatus.ENROLLED]: { audience: 'worker', action: 'Complete the assessment and interview.' },
  [CaseStatus.ASSESSED]: { audience: 'worker', action: 'Score the assessment tools and flag the case for admin review.' },
  [CaseStatus.IN_REVIEW]: { audience: 'admin', action: 'Review and approve the case to activate it.' },
  [CaseStatus.ACTIVE]: { audience: 'worker', action: 'Implement the approved services and record the interventions.' },
  [CaseStatus.TRANSITIONING]: { audience: 'worker', action: 'Complete the case study and close the case.' },
  [CaseStatus.CLOSED]: null,
  [CaseStatus.AFTERCARE]: null,
};

export function nextActionFor(status: string | null | undefined): CaseNextAction | null {
  return (status && CASE_NEXT_ACTION[status]) || null;
}
