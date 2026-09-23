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
  [CaseStatus.CLOSED]: [],
};

// Non-admin roles allowed to act from each status. `admin` is always allowed
// (short-circuited in canTransition), so it is not repeated here. These match the
// controller role gates — a role listed here must have a reachable endpoint:
//   enrolled/assessed -> social_worker (request review, submit for review)
//   transitioning     -> social_worker (close)
export const CASE_FSM_ROLES: Record<CaseStatus, string[]> = {
  [CaseStatus.ENROLLED]: ['social_worker'],
  [CaseStatus.ASSESSED]: ['social_worker'],
  [CaseStatus.IN_REVIEW]: [],
  [CaseStatus.ACTIVE]: [],
  [CaseStatus.TRANSITIONING]: ['social_worker'],
  [CaseStatus.CLOSED]: [],
};

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_FSM[from] ?? []).includes(to);
}

export function canTransition(from: CaseStatus, role: string): boolean {
  if (role === 'admin') return true;
  return (CASE_FSM_ROLES[from] ?? []).includes(role);
}
