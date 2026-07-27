import { Test } from '@nestjs/testing';
import { AuditService } from '../src/audit/audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Case } from '../src/cases/case.entity';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { CacheService } from '../src/common/cache.service';
import * as crypto from 'crypto';

describe('AuditService — Hash Chain', () => {
  let service: AuditService;
  let caseRepoMock: any;
  let benRepoMock: any;
  let consentRepoMock: any;

  const seedChain = (count: number): any[] => {
    const records: any[] = [];
    let prevHash: string | null = null;
    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID();
      const prevId = i > 0 ? records[i - 1].id : id;
      const hashInput = prevHash
        ? JSON.stringify({ id: prevId, hash: prevHash })
        : JSON.stringify({ id });
      const hashVal: string = crypto.createHash('sha256').update(hashInput).digest('hex');

      records.push({
        id,
        hash: hashVal,
        prevHash,
        createdAt: new Date(2026, 0, 1 + i),
      });
      prevHash = hashVal;
    }
    return records;
  };

  beforeEach(async () => {
    caseRepoMock = { find: jest.fn().mockResolvedValue([]) };
    benRepoMock = { find: jest.fn().mockResolvedValue([]) };
    consentRepoMock = { find: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: CacheService, useValue: { wrap: jest.fn((_key: string, fn: () => any) => fn()) } },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('verifies intact hash chain', async () => {
    const records = seedChain(5);
    caseRepoMock.find.mockResolvedValue(records);

    const result = await service.verifyHashChain(caseRepoMock, 'createdAt');
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  it('detects broken hash chain', async () => {
    const records = seedChain(5);
    records[2].hash = crypto.createHash('sha256').update('tampered').digest('hex');
    caseRepoMock.find.mockResolvedValue(records);

    const result = await service.verifyHashChain(caseRepoMock, 'createdAt');
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(records[2].id);
  });

  it('verifies empty chain as valid', async () => {
    caseRepoMock.find.mockResolvedValue([]);

    const result = await service.verifyHashChain(caseRepoMock, 'createdAt');
    expect(result.valid).toBe(true);
  });

  it('verifies all chains via verifyAllChains', async () => {
    caseRepoMock.find.mockResolvedValue(seedChain(3));
    benRepoMock.find.mockResolvedValue([]);
    consentRepoMock.find.mockResolvedValue(seedChain(1));

    const result = await service.verifyAllChains();
    expect(result).toHaveProperty('cases');
    expect(result).toHaveProperty('beneficiaries');
    expect(result).toHaveProperty('consentLedger');
    expect(result.cases.valid).toBe(true);
    expect(result.beneficiaries.valid).toBe(true);
    expect(result.consentLedger.valid).toBe(true);
  });
});
