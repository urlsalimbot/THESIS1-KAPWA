import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service';
import { AccessCardService } from './access-card-service.entity';

describe('AccessCardsService', () => {
  let service: AccessCardsService;
  let repoMock: any;
  let queryRunnerMock: any;

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    };
    repoMock = {
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
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

  describe('generateAndAssign', () => {
    it('generates code and updates beneficiary in single call', async () => {
      queryRunnerMock.manager.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockResolvedValueOnce([]);

      const result = await service.generateAndAssign('beneficiary-uuid');

      expect(result).toMatch(/^NORZ-AC-\d{4}-\d{4}$/);
      expect(queryRunnerMock.manager.query).toHaveBeenCalledTimes(2);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });

    it('handles transaction rollback on error', async () => {
      queryRunnerMock.manager.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockRejectedValueOnce(new Error('UPDATE failed'));

      await expect(service.generateAndAssign('beneficiary-uuid')).rejects.toThrow('UPDATE failed');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('findBeneficiaryCard', () => {
    it('returns beneficiary card data', async () => {
      const benData = { id: 'ben-id', access_card_code: 'NORZ-AC-2026-0042', surname: 'Doe', first_name: 'John', barangay: 'Barangay' };
      repoMock.query.mockResolvedValue([benData]);
      repoMock.find.mockResolvedValue([]);

      const result = await service.findBeneficiaryCard('ben-id');

      expect(result).toEqual({
        beneficiary: benData,
        code: 'NORZ-AC-2026-0042',
        services: [],
      });
      expect(repoMock.query).toHaveBeenCalledWith(
        'SELECT id, access_card_code, surname, first_name, barangay FROM beneficiaries WHERE id = $1',
        ['ben-id']
      );
    });

    it('throws NotFoundException when beneficiary has no card', async () => {
      repoMock.query.mockResolvedValue([{ id: 'ben-id', access_card_code: null }]);

      await expect(service.findBeneficiaryCard('ben-id')).rejects.toThrow('Beneficiary has no Access Card');
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
});
