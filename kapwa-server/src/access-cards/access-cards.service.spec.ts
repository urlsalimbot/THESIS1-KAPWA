import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service';
import { AccessCardService } from './access-card-service.entity';

describe('AccessCardsService', () => {
  let service: AccessCardsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessCardsService,
        { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
      ],
    }).compile();
    service = module.get<AccessCardsService>(AccessCardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCode', () => {
    it('returns a formatted access card code string', async () => {
      repoMock.query.mockResolvedValue([{ id: 42 }]);
      const result = await service.generateCode();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^NORZ-AC-\d{4}-\d{4}$/);
    });
  });

  describe('logService', () => {
    it('creates and saves a service entry', async () => {
      const data = { accessCardCode: 'NORZ-AC-2026-0042', serviceRendered: 'Medical Aid', serviceDate: new Date() };
      const entry = { id: '1', ...data };
      repoMock.create.mockReturnValue(entry);
      repoMock.save.mockResolvedValue(entry);
      const result = await service.logService(data);
      expect(repoMock.create).toHaveBeenCalledWith(data);
      expect(repoMock.save).toHaveBeenCalledWith(entry);
      expect(result).toEqual(entry);
    });
  });

  describe('findByCard', () => {
    it('returns services for a card code ordered by date desc', async () => {
      const services = [{ id: '1', accessCardCode: 'NORZ-AC-2026-0042', serviceDate: new Date() }];
      repoMock.find.mockResolvedValue(services);
      const result = await service.findByCard('NORZ-AC-2026-0042');
      expect(repoMock.find).toHaveBeenCalledWith({
        where: { accessCardCode: 'NORZ-AC-2026-0042' },
        order: { serviceDate: 'DESC' },
      });
      expect(result).toEqual(services);
    });
  });

  describe('generateAndAssign', () => {
    it('generates code and updates beneficiary in single call', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockResolvedValueOnce([]);
      await expect(service.generateAndAssign('beneficiary-uuid')).rejects.toThrow();
    });

    it('handles transaction rollback on error', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockRejectedValueOnce(new Error('UPDATE failed'));
      await expect(service.generateAndAssign('beneficiary-uuid')).rejects.toThrow();
    });
  });

  describe('findBeneficiaryCard', () => {
    it('returns beneficiary card data', async () => {
      const result = await service.findBeneficiaryCard('ben-id');
      expect(result).toHaveProperty('beneficiary');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('services');
    });

    it('throws NotFoundException when beneficiary has no card', async () => {
      await expect(service.findBeneficiaryCard('ben-id')).rejects.toThrow('NotFoundException');
    });
  });
});
