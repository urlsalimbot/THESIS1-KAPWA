import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgenciesService } from './agencies.service';
import { Agency } from './agency.entity';

describe('AgenciesService', () => {
  let service: AgenciesService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenciesService,
        { provide: getRepositoryToken(Agency), useValue: repoMock },
      ],
    }).compile();
    service = module.get<AgenciesService>(AgenciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists only active agencies ordered by code', async () => {
    const agencies = [{ id: 'a1', code: 'RHU', name: 'RHU', isActive: true }];
    repoMock.find.mockResolvedValue(agencies);
    const result = await service.findAll();
    expect(repoMock.find).toHaveBeenCalledWith({ where: { isActive: true }, order: { code: 'ASC' } });
    expect(result).toEqual(agencies);
  });

  it('findByCode queries by exact code', async () => {
    const agency = { id: 'a1', code: 'MSWDO' };
    repoMock.findOne.mockResolvedValue(agency);
    const result = await service.findByCode('MSWDO');
    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { code: 'MSWDO' } });
    expect(result).toEqual(agency);
  });

  it('create rejects a duplicate code', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'a1', code: 'MSWDO' });
    await expect(
      service.create({ code: 'mswdo', name: 'Duplicate', type: 'social_services' }),
    ).rejects.toThrow('Agency code already exists: MSWDO');
  });

  it('create uppercases and persists a new agency', async () => {
    repoMock.findOne.mockResolvedValue(null);
    repoMock.create.mockImplementation((dto: any) => dto);
    repoMock.save.mockImplementation(async (dto: any) => ({ id: 'a2', ...dto }));
    const result = await service.create({ code: 'ngo1', name: 'NGO One', type: 'social_services' });
    expect(result).toEqual(expect.objectContaining({ id: 'a2', code: 'NGO1', name: 'NGO One', isActive: true }));
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'NGO1' }));
  });
});
