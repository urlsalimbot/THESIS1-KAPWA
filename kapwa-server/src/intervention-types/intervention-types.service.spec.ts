import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InterventionTypesService } from './intervention-types.service';
import { InterventionTypeEntity } from './intervention-type.entity';

describe('InterventionTypesService', () => {
  let service: InterventionTypesService;
  let repoMock: any;

  const mockType: InterventionTypeEntity = {
    id: '1a000000-0000-0000-0000-000000000001',
    code: 'FA',
    name: 'Financial Assistance',
    description: 'Direct financial aid',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockTypeInactive: InterventionTypeEntity = {
    ...mockType,
    id: '1a000000-0000-0000-0000-000000000008',
    code: 'LEGACY',
    name: 'Legacy Type',
    isActive: false,
  };

  beforeEach(async () => {
    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionTypesService,
        { provide: getRepositoryToken(InterventionTypeEntity), useValue: repoMock },
      ],
    }).compile();

    service = module.get<InterventionTypesService>(InterventionTypesService);
  });

  describe('findAll', () => {
    it('returns only active types by default', async () => {
      repoMock.find.mockResolvedValue([mockType]);
      const result = await service.findAll();
      expect(repoMock.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { code: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('FA');
    });

    it('returns all types when includeInactive is true', async () => {
      repoMock.find.mockResolvedValue([mockType, mockTypeInactive]);
      const result = await service.findAll(true);
      expect(repoMock.find).toHaveBeenCalledWith({ order: { code: 'ASC' } });
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns type when found', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      const result = await service.findById(mockType.id);
      expect(result).toEqual(mockType);
    });

    it('throws NotFoundException when not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('returns active type by code', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      const result = await service.findByCode('FA');
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { code: 'FA', isActive: true },
      });
      expect(result).toEqual(mockType);
    });

    it('returns null when type is inactive', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const result = await service.findByCode('LEGACY');
      expect(result).toBeNull();
    });
  });

  describe('validateCode', () => {
    it('resolves when type exists and is active', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      await expect(service.validateCode('FA')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when type is inactive or missing', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.validateCode('BOGUS')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a new intervention type', async () => {
      repoMock.findOne.mockResolvedValue(null);
      repoMock.create.mockReturnValue(mockType);
      repoMock.save.mockResolvedValue(mockType);

      const result = await service.create({
        code: 'FA',
        name: 'Financial Assistance',
        description: 'Direct financial aid',
      });

      expect(repoMock.create).toHaveBeenCalledWith({
        code: 'FA',
        name: 'Financial Assistance',
        description: 'Direct financial aid',
        isActive: true,
      });
      expect(result).toEqual(mockType);
    });

    it('throws ConflictException when code already exists', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      await expect(
        service.create({ code: 'FA', name: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates an existing type', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      repoMock.save.mockResolvedValue({ ...mockType, name: 'Updated Name' });

      const result = await service.update(mockType.id, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('throws NotFoundException when type does not exist', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', { name: 'Whatever' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      repoMock.findOne.mockResolvedValue(mockType);
      repoMock.save.mockResolvedValue({ ...mockType, isActive: false });

      await service.deactivate(mockType.id);

      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws NotFoundException when type does not exist', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.deactivate('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
