export const ROLE_REDIRECT_MAP: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
};

// Must mirror the @Roles decorators on kapwa-server notifications.controller
export const NOTIFICATION_ROLES = [
  'admin', 'social_worker', 'coordinator', 'claimant',
];

// Must mirror the @Roles decorators on kapwa-server chat.controller
export const CHAT_ROLES = ['admin', 'social_worker', 'coordinator', 'claimant'];

/**
 * The role the case FSM short-circuits. It may move a case out of any status,
 * and it is the one role `CasesService.validateTransition`'s all-locked gate
 * exempts — so a surface that must *distinguish* it (to decide whether to enforce
 * that gate) needs to name it. Named once here so that decision does not become
 * a second role slug typed into a component.
 */
export const CASE_ADMIN_ROLE = 'admin';

/**
 * The non-admin roles the case FSM admits from each lifecycle status. Mirrors
 * `CASE_FSM_ROLES` in kapwa-server/src/cases/case-fsm.ts — `admin` is always
 * allowed (short-circuited in the server's `canTransition`), so it is not
 * repeated here.
 *
 * This is the client half of that map. `CaseActionBar` decides which forward
 * hop to offer from it rather than from a second hand-written list of role
 * strings: a role slug typed into a component is a slug nobody can grep for,
 * and the server's answer to "who may move this case" is the one that decides
 * whether the click works.
 */
export const CASE_TRANSITION_ROLES: Record<string, string[]> = {
  enrolled: ['social_worker'],
  assessed: ['social_worker'],
  in_review: [],
  active: [],
  transitioning: ['social_worker'],
  closed: ['social_worker'],
  // Terminal post-closure phase: no outgoing edges (mirrors CASE_FSM_ROLES).
  aftercare: [],
};

/**
 * Whether `role` may move a case out of `status`. Fail-closed: an unknown status
 * or a missing role is `false`, so a payload the client cannot read offers
 * nothing rather than offering everything.
 */
export function canTransitionCase(status: string | null | undefined, role: string | null | undefined): boolean {
  if (role === CASE_ADMIN_ROLE) return true;
  return (status == null ? undefined : CASE_TRANSITION_ROLES[status])?.includes(role ?? '') ?? false;
}
