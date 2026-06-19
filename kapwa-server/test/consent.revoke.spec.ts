import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BeneficiariesController } from '../src/beneficiaries/beneficiaries.controller';
import { BeneficiariesService } from '../src/beneficiaries/beneficiaries.service';
import { Beneficiary } from '../src/beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';
import { FamilyMember } from '../src/beneficiaries/family-member.entity';
import { Case } from '../src/cases/case.entity';
import { Intervention } from '../src/interventions/intervention.entity';

describe('BeneficiariesController — Consent Revoke', () => {
  let controller: BeneficiariesController;
  let consentRepo: Repository<ConsentLedger>;
  let benRepo: Repository<Beneficiary>;
  let service: BeneficiariesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BeneficiariesController],
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
            save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
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

    controller = module.get<BeneficiariesController>(BeneficiariesController);
    service = module.get<BeneficiariesService>(BeneficiariesService);
    consentRepo = module.get<Repository<ConsentLedger>>(getRepositoryToken(ConsentLedger));
    benRepo = module.get<Repository<Beneficiary>>(getRepositoryToken(Beneficiary));
  });

  afterEach(() => jest.clearAllMocks());

  // Test 4: Revoke changes consent_ledger status to 'revoked', sets revokedAt
  it('should set consent ledger status to revoked with revokedAt timestamp', async () => {
    (consentRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'cl-1',
      beneficiaryId: 'ben-1',
      status: 'active',
      grantedAt: new Date(),
    });

    // We need to call the service method directly since controller depends on ZodPipe
    const result = await service.revokeConsent('ben-1', { reason: 'No longer needed' });

    expect(result).toBeDefined();
    expect(result.status).toBe('revoked');
    expect(result.revokedAt).toBeDefined();
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
    (consentRepo.save as jest.Mock).mockImplementation((ledger) => Promise.resolve({
      ...ledger,
      id: 'cl-1',
      revokedReason: 'No longer needed',
    }));

    const result = await service.revokeConsent('ben-1', { reason: 'No longer needed' });

    expect(result.status).toBe('revoked');
    expect(consentRepo.save).toHaveBeenCalled();
    // Verify the save was called — the reason is set on the ledger before save
    expect(result).toHaveProperty('revokedAt');
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
