import { Test } from '@nestjs/testing';
import { AuditService } from '../src/audit/audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Intervention } from '../src/interventions/intervention.entity';
import { Case } from '../src/cases/case.entity';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

describe('AuditService — Hash Chain', () => {
  let service: AuditService;
  let intRepoMock: any;
  let caseRepoMock: any;
  let benRepoMock: any;
  let consentRepoMock: any;

  const seedChain = (count: number): any[] => {
    const records: any[] = [];
    let prevHash: string | null = null;
    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID();
      const hashVal: string = prevHash
        ? crypto.createHash('sha256').update(JSON.stringify({ id, hash: prevHash })).digest('hex')
        : crypto.createHash('sha256').update(JSON.stringify({ id })).digest('hex');
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
    intRepoMock = { find: jest.fn().mockResolvedValue([]) };
    caseRepoMock = { find: jest.fn().mockResolvedValue([]) };
    benRepoMock = { find: jest.fn().mockResolvedValue([]) };
    consentRepoMock = { find: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Intervention), useValue: intRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('verifies intact intervention hash chain', async () => {
    const records = seedChain(5);
    intRepoMock.find.mockResolvedValue(records);

    const result = await service.verifyHashChain(intRepoMock, 'createdAt');
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  it('detects broken hash chain', async () => {
    const records = seedChain(5);
    records[2].hash = crypto.createHash('sha256').update('tampered').digest('hex');
    intRepoMock.find.mockResolvedValue(records);

    const result = await service.verifyHashChain(intRepoMock, 'createdAt');
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(records[2].id);
  });

  it('verifies empty chain as valid', async () => {
    intRepoMock.find.mockResolvedValue([]);

    const result = await service.verifyHashChain(intRepoMock, 'createdAt');
    expect(result.valid).toBe(true);
  });

  it('verifies all 4 chains via verifyAllChains', async () => {
    intRepoMock.find.mockResolvedValue(seedChain(3));
    caseRepoMock.find.mockResolvedValue(seedChain(2));
    benRepoMock.find.mockResolvedValue([]);
    consentRepoMock.find.mockResolvedValue(seedChain(1));

    const result = await service.verifyAllChains();
    expect(result).toHaveProperty('interventions');
    expect(result).toHaveProperty('cases');
    expect(result).toHaveProperty('beneficiaries');
    expect(result).toHaveProperty('consentLedger');
    expect(result.interventions.valid).toBe(true);
    expect(result.cases.valid).toBe(true);
    expect(result.beneficiaries.valid).toBe(true);
    expect(result.consentLedger.valid).toBe(true);
  });
});
