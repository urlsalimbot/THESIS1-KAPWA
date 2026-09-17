import { Test } from '@nestjs/testing';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { AbacGuard } from '../auth/guards/abac.guard';

describe('BeneficiariesController', () => {
  let controller: BeneficiariesController;
  const svc = {
    setHouseholdNhtsPr: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BeneficiariesController],
      providers: [{ provide: BeneficiariesService, useValue: svc }],
    })
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(BeneficiariesController);
    svc.setHouseholdNhtsPr.mockReset();
  });

  it('updates the household NHTS-PR reference id', async () => {
    svc.setHouseholdNhtsPr.mockResolvedValue({ householdId: 'h1', nhtsPrId: 'NHTS-1' });
    await expect(controller.setHouseholdNhtsPr('ben-1', { nhtsPrId: 'NHTS-1' })).resolves.toEqual({
      householdId: 'h1',
      nhtsPrId: 'NHTS-1',
    });
    expect(svc.setHouseholdNhtsPr).toHaveBeenCalledWith('ben-1', 'NHTS-1');
  });
});
