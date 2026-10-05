import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { CaseStepLocksService } from './case-step-locks.service';
import { GisExportService } from '../gis/gis-export.service';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('CasesController step-lock routes', () => {
  let ctrl: CasesController;
  const cases = {
    getCaseWithSla: jest.fn(),
    updateAssessmentV2: jest.fn(),
    updateTransitionPlan: jest.fn(),
    updateRequirements: jest.fn(),
    updateClosure: jest.fn(),
    updateReferralDecision: jest.fn(),
    updateInterventionDecision: jest.fn(),
    updateEnrollmentsDecision: jest.fn(),
    updateDiscernment: jest.fn(),
    updateProtectionOrder: jest.fn(),
    updateSoloParent: jest.fn(),
    updateAdoption: jest.fn(),
    updateCaseMeta: jest.fn(),
    listInterventionDocuments: jest.fn(),
  };
  const stepLocks = {
    lock: jest.fn(),
    unlock: jest.fn(),
    listForCase: jest.fn(),
    assertUnsealed: jest.fn(),
  };
  const req = { user: { id: 'u1' } } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [
        { provide: CasesService, useValue: cases },
        { provide: CasesExportService, useValue: {} },
        { provide: CaseStepLocksService, useValue: stepLocks },
        { provide: GisExportService, useValue: {} },
      ],
    })
      // The controller's guards need AbacService and the consent-ledger repo.
      // Role enforcement is asserted at the e2e level, not here.
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CasesController);
  });

  // The route is the boundary where a step key becomes the string param the
  // service validates, and it is the only place a malformed key could be lost:
  // keys are lowercase snake identifiers, and anything else is refused here so
  // URLs like `steps/1.5/lock` fail loudly instead of reaching the service.
  describe('step key parsing', () => {
    it('passes a plain key through unchanged', async () => {
      stepLocks.lock.mockResolvedValue({ stepKey: 'referrals' });
      await ctrl.lockStep('c1', 'referrals', req);
      expect(stepLocks.lock).toHaveBeenCalledWith('c1', 'referrals', req.user);
    });

    it.each([
      ['1.5', 'a fractional index'],
      ['3', 'a numeric-looking key'],
      ['2abc', 'trailing garbage'],
      ['Assessment', 'an uppercase key'],
      ['-1', 'a negative index'],
      ['+1', 'a signed index'],
      ['1e0', 'exponent notation'],
      [' 1', 'a leading space'],
      ['0x2', 'hex notation'],
      ['', 'an empty key'],
      ['UnderScore', 'an uppercase key'],
    ])('rejects %p (%s) instead of passing it through', async (raw) => {
      // Whichever step a lenient parse would have produced, nothing is sealed.
      await expect(ctrl.lockStep('c1', raw, req)).rejects.toBeInstanceOf(BadRequestException);
      expect(stepLocks.lock).not.toHaveBeenCalled();

      await expect(ctrl.unlockStep('c1', raw, req)).rejects.toBeInstanceOf(BadRequestException);
      expect(stepLocks.unlock).not.toHaveBeenCalled();
    });

    // The specific silent-corruption case: 1.5 -> 1 would seal the very step
    // the client was checking, and the response would look like a success.
    it('does not turn a fractional index into the step below it', async () => {
      await expect(ctrl.lockStep('c1', '1.5', req)).rejects.toBeInstanceOf(BadRequestException);
      expect(stepLocks.lock).not.toHaveBeenCalledWith('c1', 'interventions', expect.anything());
    });

    it('lets the service own the catalog check for a well-formed but unknown key', async () => {
      // 'bogus' matches the key pattern, so the route must not pre-empt the
      // service's own catalog validation — that message names the allowed keys.
      stepLocks.lock.mockRejectedValue(new BadRequestException('Unknown step "bogus" — expected one of: assessment, …'));
      await expect(ctrl.lockStep('c1', 'bogus', req)).rejects.toThrow(/Unknown step/);
      expect(stepLocks.lock).toHaveBeenCalledWith('c1', 'bogus', req.user);
    });

    it('returns ok after a release', async () => {
      stepLocks.unlock.mockResolvedValue(undefined);
      await expect(ctrl.unlockStep('c1', 'referrals', req)).resolves.toEqual({ ok: true });
      expect(stepLocks.unlock).toHaveBeenCalledWith('c1', 'referrals', req.user);
    });
  });

  /**
   * Which step each step-field write belongs to.
   *
   * The rule under test is that no route can change a sealed step's own data.
   * What is asserted here is the *mapping* — route to step index — because the
   * index is the whole content of the guard: wired to the wrong step, the route
   * refuses edits to a step nobody sealed and permits them to one that was.
   * That is invisible from the service, which is handed an index and never
   * learns which route asked.
   */
  describe('sealed-step refusals on the step-field writes', () => {
    beforeEach(() => {
      stepLocks.assertUnsealed.mockResolvedValue(undefined);
    });

    const CASES: Array<[string, string, () => Promise<unknown>]> = [
      ['assessment', 'assessment', () => ctrl.updateAssessment('c1', {} as any, req)],
      ['requirements', 'interventions', () => ctrl.updateRequirements('c1', {} as any)],
      ['intervention-decision', 'interventions', () => ctrl.updateInterventionDecision('c1', { notNeeded: true })],
      ['referral-decision', 'referrals', () => ctrl.updateReferralDecision('c1', { notNeeded: true })],
      ['enrollments-decision', 'enrollments', () => ctrl.updateEnrollmentsDecision('c1', { notNeeded: true })],
      ['transition-plan', 'evaluate', () => ctrl.updateTransitionPlan('c1', {} as any, req)],
      ['closure', 'closure', () => ctrl.updateClosure('c1', {} as any, req)],
    ];

    it.each(CASES)('checks the seal of step for %s', async (route, stepKey, call) => {
      await call();

      // `transition-plan` is the one route that hands the guard its body, so that
      // the guard can tell a visits-only write from one that moves the assessment.
      // Asserting the whole call for that route is what pins it; the rest pass no
      // body and are asserted on `(caseId, stepKey)` alone.
      const expectedArgs = route === 'transition-plan' ? ['c1', 'evaluate', {}] : ['c1', stepKey];
      expect(stepLocks.assertUnsealed.mock.calls.at(-1)?.slice(0, expectedArgs.length)).toEqual(expectedArgs);
    });

    /**
     * The body has to reach the guard on the one route that carries two kinds of
     * data. `PATCH /cases/:id/transition-plan` writes step 4's self-reliance
     * assessment — which is what step 4's seal claims — and the case's follow-up
     * visits, which are in no step's done-predicate and keep accruing after the
     * assessment is done. `CASE_STEP_UNGUARDED_FIELDS` lets a visits-only body past
     * a sealed step; without the body the guard cannot tell the two apart, so the
     * visits become unsaveable the moment the assessment is sealed.
     */
    it('hands the transition-plan guard the body it must judge', async () => {
      const body = { followUpVisits: [{ date: '2026-10-01', type: 'Home Visit' }] };

      await ctrl.updateTransitionPlan('c1', body as any, req);

      expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 'evaluate', body);
      // …and the write still happened, so the guard let it through rather than the
      // route skipping the save.
      expect(cases.updateTransitionPlan).toHaveBeenCalledWith('c1', body, req.user?.id);
    });

    // The other step-field routes must NOT start forwarding bodies: they carry
    // nothing but their own step's data, and a guard that took a body there would
    // be a guard whose rule nobody could state.
    it.each([
      ['assessment', () => ctrl.updateAssessment('c1', { problemsPresented: 'p' } as any, req)],
      ['requirements', () => ctrl.updateRequirements('c1', {} as any)],
      ['intervention-decision', () => ctrl.updateInterventionDecision('c1', { notNeeded: true })],
      ['referral-decision', () => ctrl.updateReferralDecision('c1', { notNeeded: true })],
      ['closure', () => ctrl.updateClosure('c1', {} as any, req)],
    ] as const)('%s passes the guard no body', async (_route, call) => {
      await call();

      expect(stepLocks.assertUnsealed.mock.calls.at(-1)).toHaveLength(2);
    });

    // The order is the fix: the assertion runs *before* the write, so a refusal
    // leaves nothing behind. Asserted after the call as well as before it,
    // because a guard that ran after the write would pass every other test here
    // while persisting exactly the edit the feature exists to prevent.
    it.each(CASES)('asks about the seal before %s writes anything', async (_route, _stepIndex, call) => {
      const order: string[] = [];
      stepLocks.assertUnsealed.mockImplementation(async () => { order.push('assert'); });
      cases.updateAssessmentV2.mockImplementation(async () => { order.push('write'); return {}; });
      cases.updateTransitionPlan.mockImplementation(async () => { order.push('write'); return {}; });
      cases.updateRequirements.mockImplementation(async () => { order.push('write'); return {}; });
      cases.updateClosure.mockImplementation(async () => { order.push('write'); return {}; });
      cases.updateReferralDecision.mockImplementation(async () => { order.push('write'); return {}; });
      cases.updateInterventionDecision.mockImplementation(async () => { order.push('write'); return {}; });

      await call();

      expect(order[0]).toBe('assert');
    });

    it.each(CASES)('does not write when %s is refused', async (_route, _stepIndex, call) => {
      stepLocks.assertUnsealed.mockRejectedValue(new ConflictException('sealed'));

      await expect(call()).rejects.toBeInstanceOf(ConflictException);

      // Nothing reached the service: the case file is unchanged.
      for (const write of [
        cases.updateAssessmentV2, cases.updateTransitionPlan, cases.updateRequirements,
        cases.updateClosure, cases.updateReferralDecision, cases.updateInterventionDecision,
      ]) {
        expect(write).not.toHaveBeenCalled();
      }
    });
  });

  describe('intervention-documents route', () => {
    it('serves the crisis-mode documentary catalog', async () => {
      cases.listInterventionDocuments.mockResolvedValue([
        { interventionType: 'medical_assistance', documentKey: 'medical_certificate' },
      ]);
      await expect(ctrl.listInterventionDocuments()).resolves.toEqual([
        { interventionType: 'medical_assistance', documentKey: 'medical_certificate' },
      ]);
      expect(cases.listInterventionDocuments).toHaveBeenCalled();
    });
  });
});
