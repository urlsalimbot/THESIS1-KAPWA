import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
  const cases = { getCaseWithSla: jest.fn() };
  const stepLocks = { lock: jest.fn(), unlock: jest.fn(), listForCase: jest.fn() };
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

  // The route is the boundary where a step index becomes a number, and it is
  // the only place `parseInt`-style truncation could silently seal a *different*
  // step than the caller named: `1.5` truncates to 1. The service rejects a
  // non-integer, but the route can never hand it one, so this is asserted here.
  describe('step index parsing', () => {
    it('passes a plain integer through unchanged', async () => {
      stepLocks.lock.mockResolvedValue({ stepIndex: 3 });
      await ctrl.lockStep('c1', '3', req);
      expect(stepLocks.lock).toHaveBeenCalledWith('c1', 3, req.user);
    });

    it.each([
      ['1.5', 'a fractional index'],
      ['0.0', 'a zero-valued fraction'],
      ['2abc', 'trailing garbage'],
      ['abc', 'a non-numeric index'],
      ['-1', 'a negative index'],
      ['+1', 'a signed index'],
      ['1e0', 'exponent notation'],
      [' 1', 'a leading space'],
      ['0x2', 'hex notation'],
      ['', 'an empty index'],
    ])('rejects %p (%s) instead of truncating it into a valid step', async (raw) => {
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
      expect(stepLocks.lock).not.toHaveBeenCalledWith('c1', 1, expect.anything());
    });

    it('lets the service own the range check for a well-formed but unknown index', async () => {
      // '7' is an integer, so the route must not pre-empt the service's own
      // 0..4 validation — that message names the allowed range.
      stepLocks.lock.mockRejectedValue(new BadRequestException('Unknown step 7 — expected 0..4'));
      await expect(ctrl.lockStep('c1', '7', req)).rejects.toThrow(/expected 0\.\.4/);
      expect(stepLocks.lock).toHaveBeenCalledWith('c1', 7, req.user);
    });

    it('returns ok after a release', async () => {
      stepLocks.unlock.mockResolvedValue(undefined);
      await expect(ctrl.unlockStep('c1', '2', req)).resolves.toEqual({ ok: true });
      expect(stepLocks.unlock).toHaveBeenCalledWith('c1', 2, req.user);
    });
  });
});
