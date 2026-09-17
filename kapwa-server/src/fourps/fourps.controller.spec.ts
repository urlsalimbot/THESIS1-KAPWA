import { Test } from '@nestjs/testing';
import { FourPsController } from './fourps.controller';
import { FourPsService } from './fourps.service';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RESOURCE_SENSITIVITY_KEY } from '../auth/decorators/resource-sensitivity.decorator';

describe('FourPsController', () => {
  let controller: FourPsController;
  const svc = {
    generateComplianceItems: jest.fn(),
    getComplianceStatus: jest.fn(),
    markComplied: jest.fn(),
    unmarkComplied: jest.fn(),
    schedulePayout: jest.fn(),
    listByCase: jest.fn(),
    setPayoutStatus: jest.fn(),
    markNotified: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FourPsController],
      providers: [{ provide: FourPsService, useValue: svc }],
    })
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FourPsController);
    Object.values(svc).forEach(fn => fn.mockReset());
  });

  it('generates compliance items', async () => {
    svc.generateComplianceItems.mockResolvedValue(60);
    await expect(controller.generateCompliance('case-1')).resolves.toEqual({ generated: 60 });
  });

  it('returns compliance status', async () => {
    svc.getComplianceStatus.mockResolvedValue({ total: 0, complied: 0, rate: 0, byType: {}, entries: [] });
    await expect(controller.getCompliance('case-1')).resolves.toMatchObject({ total: 0 });
  });

  it('marks and unmarks a compliance item', async () => {
    svc.markComplied.mockResolvedValue(undefined);
    svc.unmarkComplied.mockResolvedValue(undefined);
    await expect(controller.markComplied('item-1', { user: { id: 'user-1' } } as any)).resolves.toEqual({ met: true });
    expect(svc.markComplied).toHaveBeenCalledWith('item-1', 'user-1');
    await expect(controller.unmarkComplied('item-1')).resolves.toEqual({ met: false });
  });

  it('schedules and lists payouts', async () => {
    svc.schedulePayout.mockResolvedValue({ id: 'p1' });
    svc.listByCase.mockResolvedValue([]);
    await controller.schedulePayout('case-1', { scheduledAt: '2026-10-01', amount: 1200 });
    expect(svc.schedulePayout).toHaveBeenCalledWith('case-1', { scheduledAt: '2026-10-01', amount: 1200 });
    await expect(controller.listPayouts('case-1')).resolves.toEqual([]);
  });

  it('marks compliance status as public sensitivity for claimant read access', () => {
    expect(Reflect.getMetadata(RESOURCE_SENSITIVITY_KEY, FourPsController.prototype.getCompliance)).toBe('public');
  });

  it('updates payout status and records notification', async () => {
    svc.setPayoutStatus.mockResolvedValue({ id: 'p1' });
    svc.markNotified.mockResolvedValue({ id: 'p1' });
    await controller.setPayoutStatus('p1', { status: 'completed' });
    expect(svc.setPayoutStatus).toHaveBeenCalledWith('p1', 'completed', undefined);
    await controller.notifyPayout('p1', { user: { id: 'user-1' } } as any);
    expect(svc.markNotified).toHaveBeenCalledWith('p1', 'user-1');
  });
});
