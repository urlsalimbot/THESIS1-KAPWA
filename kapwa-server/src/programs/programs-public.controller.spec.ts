import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProgramsPublicController } from './programs-public.controller';
import { ProgramsService } from './programs.service';

describe('ProgramsPublicController', () => {
  let ctrl: ProgramsPublicController;
  const svc = { findAll: jest.fn(), findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramsPublicController],
      providers: [{ provide: ProgramsService, useValue: svc }],
    }).compile();
    ctrl = module.get(ProgramsPublicController);
  });

  it('lists active programs mapped to public-safe fields', async () => {
    svc.findAll.mockResolvedValue([
      { id: 'p1', name: 'AICS', category: 'Aid', waitingPeriodDays: 5, fundSources: ['LGU'], requiredDocuments: undefined, legalBasis: 'RA 11165', approvalWorkflow: [{ stepName: 'x' }] },
    ]);
    const result = await ctrl.list();
    expect(result).toEqual([
      { id: 'p1', name: 'AICS', category: 'Aid', waitingPeriodDays: 5, fundSources: ['LGU'], requiredDocuments: undefined, legalBasis: 'RA 11165' },
    ]);
    expect(result[0]).not.toHaveProperty('approvalWorkflow');
    expect(svc.findAll).toHaveBeenCalledWith(true);
  });

  it('throws NotFoundException for an inactive program', async () => {
    svc.findById.mockResolvedValue({ id: 'p1', name: 'AICS', isActive: false });
    await expect(ctrl.byId('p1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the active program when found', async () => {
    svc.findById.mockResolvedValue({ id: 'p1', name: 'AICS', isActive: true, category: undefined });
    const result = await ctrl.byId('p1');
    expect(result.id).toBe('p1');
  });
});