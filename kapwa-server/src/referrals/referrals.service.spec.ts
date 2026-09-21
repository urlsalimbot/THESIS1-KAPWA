import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReferralsService } from './referrals.service';
import { Referral, ReferralStatus } from './referral.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { CasesService } from '../cases/cases.service';

function pendingReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: 'ref-1',
    coordinatorId: 'coord-1',
    barangay: 'Bigte',
    reason: 'Needs financial assistance',
    status: ReferralStatus.PENDING,
    personId: 'person-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Referral;
}

describe('ReferralsService', () => {
  let service: ReferralsService;
  let repoMock: any;
  let personRepoMock: any;
  let benRepoMock: any;
  let casesServiceMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    personRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    benRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    casesServiceMock = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: getRepositoryToken(Referral), useValue: repoMock },
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: CasesService, useValue: casesServiceMock },
      ],
    }).compile();
    service = module.get<ReferralsService>(ReferralsService);
  });

  describe('accept', () => {
    it('rejects a referral that is not pending', async () => {
      repoMock.findOne.mockResolvedValue(pendingReferral({ status: ReferralStatus.ACCEPTED }));
      await expect(service.accept('ref-1')).rejects.toThrow('Referral is not in pending status');
      expect(casesServiceMock.create).not.toHaveBeenCalled();
    });

    it('creates a beneficiary (when missing) and a case, then links and accepts', async () => {
      repoMock.findOne.mockResolvedValue(pendingReferral());
      benRepoMock.findOne.mockResolvedValue(null);
      benRepoMock.create.mockReturnValue({ id: 'ben-1', personId: 'person-1' });
      benRepoMock.save.mockResolvedValue({ id: 'ben-1', personId: 'person-1' });
      casesServiceMock.create.mockResolvedValue({ id: 'case-1', controlNo: 'KAPWA-2026-00010' });

      const accepted = { ...pendingReferral(), status: ReferralStatus.ACCEPTED, caseId: 'case-1' };
      repoMock.save.mockResolvedValue(accepted);
      repoMock.findOne
        .mockResolvedValueOnce(pendingReferral())
        .mockResolvedValueOnce({ ...accepted, case: { controlNo: 'KAPWA-2026-00010' } });

      const result = await service.accept('ref-1', 'actor-1');

      expect(benRepoMock.create).toHaveBeenCalledWith({ personId: 'person-1' });
      expect(casesServiceMock.create).toHaveBeenCalledWith({
        beneficiaryId: 'ben-1',
        serviceRequested: ['Needs financial assistance'],
        assignedWorkerId: 'actor-1',
      });
      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted', caseId: 'case-1' }));
      expect((result as any).case?.controlNo).toBe('KAPWA-2026-00010');
    });

    it('reuses an existing beneficiary instead of creating one', async () => {
      repoMock.findOne.mockResolvedValue(pendingReferral());
      const existing = { id: 'ben-9', personId: 'person-1' };
      benRepoMock.findOne.mockResolvedValue(existing);
      casesServiceMock.create.mockResolvedValue({ id: 'case-2' });
      repoMock.save.mockResolvedValue({});

      await service.accept('ref-1', 'actor-1');

      expect(benRepoMock.create).not.toHaveBeenCalled();
      expect(casesServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({ beneficiaryId: 'ben-9' }));
    });

    it('accepts without creating a case when the referral has no linked person', async () => {
      repoMock.findOne.mockResolvedValue(pendingReferral({ personId: undefined }));
      repoMock.save.mockResolvedValue({});
      repoMock.findOne.mockResolvedValueOnce(pendingReferral({ personId: undefined }))
        .mockResolvedValueOnce({ ...pendingReferral({ personId: undefined }), status: ReferralStatus.ACCEPTED });

      const result = await service.accept('ref-1', 'actor-1');

      expect(benRepoMock.findOne).not.toHaveBeenCalled();
      expect(casesServiceMock.create).not.toHaveBeenCalled();
      expect((result as any).status).toBe('accepted');
    });
  });

  describe('create', () => {
    // resolveOrCreatePerson looks up an existing person first; return no match
    // so the address write path is exercised.
    function stubPersonLookupMiss() {
      personRepoMock.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
    }

    function stubEntityPersistence() {
      personRepoMock.create.mockImplementation((v: Record<string, unknown>) => ({ ...v }));
      personRepoMock.save.mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: 'person-new' }));
      repoMock.create.mockImplementation((v: Record<string, unknown>) => ({ ...v }));
      repoMock.save.mockImplementation(async (r: Record<string, unknown>) => ({ ...r, id: 'ref-1' }));
    }

    it('stores a structured barangay alongside the raw address string', async () => {
      stubPersonLookupMiss();
      stubEntityPersistence();

      await service.create(
        {
          surname: 'Reyes',
          firstName: 'Maria',
          gender: 'Female',
          dob: '1995-08-20',
          phone: '09171234567',
          address: { street: '123 Mabini St', barangay: 'Poblacion' },
          reason: 'Medical assistance',
        } as any,
        'coord-1',
        'Poblacion',
      );

      const savedPerson = personRepoMock.save.mock.calls[0][0];
      expect(savedPerson.addresses).toEqual([
        expect.objectContaining({
          addressType: 'current',
          raw: '123 Mabini St, Poblacion',
          barangay: 'Poblacion',
          isPrimary: true,
        }),
      ]);
    });

    it('omits the structured barangay when the payload has none', async () => {
      stubPersonLookupMiss();
      stubEntityPersistence();

      await service.create(
        {
          surname: 'Reyes',
          firstName: 'Maria',
          gender: 'Female',
          dob: '1995-08-20',
          address: { street: '123 Mabini St' },
          reason: 'Medical assistance',
        } as any,
        'coord-1',
        'Poblacion',
      );

      const savedPerson = personRepoMock.save.mock.calls[0][0];
      expect(savedPerson.addresses[0].barangay).toBeUndefined();
      expect(savedPerson.addresses[0].raw).toBe('123 Mabini St');
    });
  });
});