import { CaseStatus } from './case.entity';
import { CASE_FSM, CASE_FSM_ROLES, isValidTransition, canTransition, nextActionFor } from './case-fsm';

describe('case-fsm', () => {
  it('enforces the documented transition table', () => {
    expect(isValidTransition(CaseStatus.ENROLLED, CaseStatus.ASSESSED)).toBe(true);
    expect(isValidTransition(CaseStatus.TRANSITIONING, CaseStatus.CLOSED)).toBe(true);
    expect(isValidTransition(CaseStatus.CLOSED, CaseStatus.ENROLLED)).toBe(false);
  });

  it('only allows closure through Phase-Out (transitioning)', () => {
    expect(isValidTransition(CaseStatus.ENROLLED, CaseStatus.CLOSED)).toBe(false);
    expect(isValidTransition(CaseStatus.ASSESSED, CaseStatus.CLOSED)).toBe(false);
    expect(isValidTransition(CaseStatus.IN_REVIEW, CaseStatus.CLOSED)).toBe(false);
    expect(isValidTransition(CaseStatus.ACTIVE, CaseStatus.CLOSED)).toBe(false);
  });

  it('allows admin to transition any state (override role)', () => {
    expect(canTransition(CaseStatus.TRANSITIONING, 'admin')).toBe(true);
    expect(canTransition(CaseStatus.ACTIVE, 'admin')).toBe(true);
  });

  it('restricts disburse (active->transitioning) to admin', () => {
    expect(canTransition(CaseStatus.ACTIVE, 'social_worker')).toBe(false);
    expect(canTransition(CaseStatus.ACTIVE, 'admin')).toBe(true);
  });

  it('allows a social worker to close transitioning cases', () => {
    expect(canTransition(CaseStatus.TRANSITIONING, 'social_worker')).toBe(true);
  });

  it('does not grant coordinator any case transition (no reachable endpoint)', () => {
    for (const s of Object.values(CaseStatus)) {
      expect(canTransition(s, 'coordinator')).toBe(false);
    }
  });

  it('exports complete role matrix keyed by every status', () => {
    for (const s of Object.values(CaseStatus)) {
      expect(CASE_FSM_ROLES[s]).toBeDefined();
      expect(Array.isArray(CASE_FSM[s])).toBe(true);
    }
  });
});

describe('CASE_NEXT_ACTION — who each status waits on', () => {
  it('names an owner for every status the case can act from, and nobody for the terminals', () => {
    for (const status of Object.keys(CASE_FSM)) {
      const action = nextActionFor(status);
      if (status === 'closed' || status === 'aftercare') {
        expect(action).toBeNull();
        continue;
      }
      expect(action).toBeTruthy();
    }
    // `in_review` is the approval queue: its work is done and the only forward
    // edge is admin-only, so the admin is who it waits on.
    expect(nextActionFor('in_review')?.audience).toBe('admin');
    // `active` is deliberately NOT the admin's queue even though its exit is
    // admin-only: the implementation work is the worker's, and the admin is
    // asked for the move only once that work is sealed.
    expect(nextActionFor('active')?.audience).toBe('worker');
    for (const status of ['enrolled', 'assessed', 'transitioning']) {
      expect(nextActionFor(status)?.audience).toBe('worker');
    }
  });

  it('treats an unknown or missing status as waiting on nobody', () => {
    expect(nextActionFor('nonsense')).toBeNull();
    expect(nextActionFor(null)).toBeNull();
  });
});
