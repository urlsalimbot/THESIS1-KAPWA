import { CaseStatus } from './case.entity';

export const CASE_FSM: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.ENROLLED]: [CaseStatus.ASSESSED, CaseStatus.CLOSED],
  [CaseStatus.ASSESSED]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
  [CaseStatus.IN_REVIEW]: [CaseStatus.ACTIVE, CaseStatus.CLOSED],
  [CaseStatus.ACTIVE]: [CaseStatus.TRANSITIONING, CaseStatus.CLOSED],
  [CaseStatus.TRANSITIONING]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};

export const CASE_FSM_ROLES: Record<CaseStatus, string[]> = {
  [CaseStatus.ENROLLED]: ['social_worker', 'coordinator'],
  [CaseStatus.ASSESSED]: ['social_worker', 'coordinator'],
  [CaseStatus.IN_REVIEW]: ['admin', 'coordinator'],
  [CaseStatus.ACTIVE]: ['admin'],
  [CaseStatus.TRANSITIONING]: ['social_worker', 'coordinator'],
  [CaseStatus.CLOSED]: ['admin', 'social_worker', 'coordinator'],
};

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_FSM[from] ?? []).includes(to);
}

export function canTransition(from: CaseStatus, role: string): boolean {
  if (role === 'admin') return true;
  return (CASE_FSM_ROLES[from] ?? []).includes(role);
}
