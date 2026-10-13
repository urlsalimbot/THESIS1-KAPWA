import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReferralsService } from './referrals.service';
import { Referral, ReferralStatus } from './referral.entity';
import { Person } from '../beneficiaries/person.entity';

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

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: { query: jest.fn().mockResolvedValue([{ last_seq: 1 }]) },
    };
    personRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: getRepositoryToken(Referral), useValue: repoMock },
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
      ],
    }).compile();
    service = module.get<ReferralsService>(ReferralsService);
  });

  describe('accept', () => {
    it('rejects a referral that is not pending', async () => {
      repoMock.findOne.mockResolvedValue(pendingReferral({ status: ReferralStatus.ACCEPTED }));
      await expect(service.accept('ref-1')).rejects.toThrow('Referral is not in pending status');
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('accepts without creating a case', async () => {
      // The case is created by the intake this hands off to (see
      // IntakeService.linkSourceReferral). Accepting must not create one here,
      // or every accepted referral would produce two cases.
      repoMock.findOne
        .mockResolvedValueOnce(pendingReferral())
        .mockResolvedValueOnce({ ...pendingReferral(), status: ReferralStatus.ACCEPTED });
      repoMock.save.mockResolvedValue({ ...pendingReferral(), status: ReferralStatus.ACCEPTED });

      const result = await service.accept('ref-1');

      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' }),
      );
      expect((result as any).caseId).toBeUndefined();
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
    it('assigns the RFRL control number and persists the case category', async () => {
      repoMock.create.mockImplementation((d: any) => d);
      const saved: any = {};
      repoMock.save.mockImplementation(async (d: any) => { Object.assign(saved, d); return d; });
      personRepoMock.save.mockResolvedValue({ id: 'p1' });
      personRepoMock.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });

      const referral = await service.create(
        { reason: 'Needs AICS help', caseCategory: 'Individual in Crisis Situation (AICS)' } as any,
        'coor-1', 'Bigte',
      );

      expect(saved.controlNo).toBe('RFRL-2026-0001');
      expect(repoMock.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('referral_control_counters'),
        [new Date().getFullYear()],
      );
      expect(saved.caseCategory).toBe('Individual in Crisis Situation (AICS)');
    });

    it('builds a GIS-style intake sheet PDF from the referral', async () => {
      const referral = {
        id: 'r1', controlNo: 'RFRL-2026-0001', barangay: 'Bigte', status: 'pending',
        reason: 'Needs AICS help', caseCategory: 'Individual in Crisis Situation (AICS)',
        createdAt: new Date(), coordinator: { firstName: 'Ana', lastName: 'Cruz' },
        surname: 'Reyes', firstName: 'Pedro', gender: 'Male', phone: '09171234567',
        addressLine: 'Blk 2, Bigte',
      };
      repoMock.findOne.mockResolvedValue(referral);
      const pdf = await service.gisPdf('r1');
      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(500);
    });

});
