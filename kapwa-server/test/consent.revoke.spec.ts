import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { FamilyMember } from '../src/beneficiaries/family-member.entity';
import { Case } from '../src/cases/case.entity';
import { Intervention } from '../src/interventions/intervention.entity';

describe('BeneficiariesService — Consent Revoke', () => {
  let service: BeneficiariesService;
  let consentRepo: Repository<ConsentLedger>;
  let benRepo: Repository<Beneficiary>;

  const savedLedgers: any[] = [];

  beforeEach(async () => {
    // Clear saved state between tests
    savedLedgers.length = 0;

    const module = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        {
          provide: getRepositoryToken(Beneficiary),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 'ben-1', consentStatus: 'active' }),
            update: jest.fn().mockResolvedValue({}),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConsentLedger),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((ledger) => {
              savedLedgers.push(ledger);
              return Promise.resolve({ ...ledger, id: 'cl-1' });
            }),
          },
        },
        {
          provide: getRepositoryToken(FamilyMember),
          useValue: {
            find: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Intervention), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<BeneficiariesService>(BeneficiariesService);
    consentRepo = module.get<Repository<ConsentLedger>>(getRepositoryToken(ConsentLedger));
    benRepo = module.get<Repository<Beneficiary>>(getRepositoryToken(Beneficiary));
  });

  afterEach(() => jest.clearAllMocks());

  // Test 4: Revoke changes consent_ledger status to 'revoked', sets revokedAt
  it('should set consent ledger status to revoked with revokedAt timestamp', async () => {
    const activeLedger = {
      id: 'cl-1',
      beneficiaryId: 'ben-1',
      status: 'active',
      grantedAt: new Date(),
    };
    (consentRepo.findOne as jest.Mock).mockResolvedValue(activeLedger);

    const result = await service.revokeConsent('ben-1', { reason: 'No longer needed' });

    expect(result.status).toBe('revoked');
    expect(result.revokedAt).toBeDefined();
    expect(result.revokedAt).toBeInstanceOf(Date);
  });

  // Test 5: Revoke with reason stores revoked_reason
  it('should store revokedReason when reason is provided', async () => {
    const activeLedger = {
      id: 'cl-1',
      beneficiaryId: 'ben-1',
      status: 'active',
      grantedAt: new Date(),
    };
    (consentRepo.findOne as jest.Mock).mockResolvedValue(activeLedger);

    await service.revokeConsent('ben-1', { reason: 'No longer needed' });

    // Verify the ledger was saved with correct properties
    expect(savedLedgers).toHaveLength(1);
    expect(savedLedgers[0].status).toBe('revoked');
    expect(savedLedgers[0].revokedAt).toBeDefined();
    expect(savedLedgers[0].revokedReason).toBe('No longer needed');
  });

  // Test 6: Revoke on already-revoked consent returns NotFoundException
  it('should throw NotFoundException for already-revoked consent', async () => {
    (consentRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.revokeConsent('ben-1', { reason: 'Try again' })).rejects.toThrow(NotFoundException);
  });

  // Test 7: Revoke updates beneficiary.consent_status to 'revoked'
  it('should update beneficiary consentStatus to revoked', async () => {
    const activeLedger = {
      id: 'cl-1',
      beneficiaryId: 'ben-1',
      status: 'active',
      grantedAt: new Date(),
    };
    (consentRepo.findOne as jest.Mock).mockResolvedValue(activeLedger);

    await service.revokeConsent('ben-1', { reason: 'Withdrawn' });

    expect(benRepo.update).toHaveBeenCalledWith('ben-1', { consentStatus: 'revoked' });
  });
});
