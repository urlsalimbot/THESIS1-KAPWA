import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CaseInterventionsController } from './case-interventions.controller';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseStepLocksService } from '../cases/case-step-locks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../auth/types';

/**
 * The intervention routes assert step 1's seal before writing.
 *
 * These routes are the reason the guard exists at all on this module's side: the
 * interventions *are* step 1's data, so a worker could seal step 1 and then
 * delete the very intervention the seal claimed. The service cannot catch that —
 * it is handed a caseId and an intervention id and never learns a seal exists —
 * and a client that merely hid the delete button would still be bypassable by
 * calling `DELETE /cases/:id/interventions/:iid` directly, which is the mistake
 * the `assessed -> in_review` gate was built not to make.
 *
 * Only step 1 is named: every route here asserts index 1, so the mapping is
 * asserted explicitly rather than left implicit in three call sites.
 */
describe('CaseInterventionsController sealed step 1', () => {
  let ctrl: CaseInterventionsController;
  const service = { findByCaseId: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const stepLocks = { assertUnsealed: jest.fn() };
  const req = { user: { id: 'u1' } } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    stepLocks.assertUnsealed.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseInterventionsController],
      providers: [
        { provide: CaseInterventionsService, useValue: service },
        { provide: CaseStepLocksService, useValue: stepLocks },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CaseInterventionsController);
  });

  it('checks step 1 before creating an intervention', async () => {
    await ctrl.create('c1', {} as any, req);
    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 'interventions');
  });

  it('checks step 1 before updating an intervention', async () => {
    await ctrl.update('c1', 'i1', {} as any);
    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 'interventions');
  });

  it('checks step 1 before deleting an intervention', async () => {
    await ctrl.delete('c1', 'i1');
    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 'interventions');
  });

  // The read stays available: a sealed step must remain inspectable, or the
  // worker holding the seal could not see what they sealed.
  it('does not gate the read', async () => {
    await ctrl.findAll('c1');
    expect(stepLocks.assertUnsealed).not.toHaveBeenCalled();
    expect(service.findByCaseId).toHaveBeenCalledWith('c1');
  });

  it.each([
    ['create', () => ctrl.create('c1', {} as any, req), () => service.create],
    ['update', () => ctrl.update('c1', 'i1', {} as any), () => service.update],
    ['delete', () => ctrl.delete('c1', 'i1'), () => service.delete],
  ] as const)('writes nothing when %s is refused', async (_name, call, spyFor) => {
    stepLocks.assertUnsealed.mockRejectedValue(new ConflictException('sealed'));

    await expect(call()).rejects.toBeInstanceOf(ConflictException);

    expect(spyFor()).not.toHaveBeenCalled();
  });
});