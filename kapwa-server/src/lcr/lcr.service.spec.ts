import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LcrService } from './lcr.service';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

describe('LcrService', () => {
  let service: LcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LcrService,
        { provide: getRepositoryToken(Person), useValue: { findOne: jest.fn(), createQueryBuilder: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: getRepositoryToken(Beneficiary), useValue: { findOne: jest.fn(), createQueryBuilder: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } },
      ],
    }).compile();
    service = module.get<LcrService>(LcrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
