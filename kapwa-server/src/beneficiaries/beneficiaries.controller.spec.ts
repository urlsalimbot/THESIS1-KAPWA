import { Test } from '@nestjs/testing';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { AbacGuard } from '../auth/guards/abac.guard';

describe('BeneficiariesController', () => {
  let controller: BeneficiariesController;
  const svc = {
    setHouseholdNhtsPr: jest.fn(),
    getInterventions: jest.fn(),
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
    svc.getInterventions.mockReset();
  });

  it('updates the household NHTS-PR reference id', async () => {
    svc.setHouseholdNhtsPr.mockResolvedValue({ householdId: 'h1', nhtsPrId: 'NHTS-1' });
    await expect(controller.setHouseholdNhtsPr('ben-1', { nhtsPrId: 'NHTS-1' })).resolves.toEqual({
      householdId: 'h1',
      nhtsPrId: 'NHTS-1',
    });
    expect(svc.setHouseholdNhtsPr).toHaveBeenCalledWith('ben-1', 'NHTS-1');
  });

  it('delegates the aggregated interventions lookup for a beneficiary', async () => {
    const rows = [{ id: 'IV-1', caseId: 'C-001', serviceName: 'Cash grant' }];
    svc.getInterventions.mockResolvedValue(rows);

    await expect(controller.getInterventions('ben-1')).resolves.toEqual(rows);
    expect(svc.getInterventions).toHaveBeenCalledWith('ben-1');
  });
});
