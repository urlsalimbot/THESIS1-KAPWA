import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { Person } from './person.entity';
import { Beneficiary } from './beneficiary.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { Household } from './household.entity';
import { HouseholdMembership } from './household-membership.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';

describe('BeneficiariesService', () => {
  let service: BeneficiariesService;
  let personRepoMock: any;
  let benRepoMock: any;
  let consentRepoMock: any;
  let caseRepoMock: any;
  let hmRepoMock: any;

  beforeEach(async () => {
    personRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    benRepoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), manager: { update: jest.fn() } };
    consentRepoMock = { save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    hmRepoMock = { query: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        { provide: getRepositoryToken(Person), useValue: personRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(BeneficiaryRole), useValue: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d: any) => d), save: jest.fn(async (d: any) => ({ id: 'role-1', ...d })) } },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(HouseholdMembership), useValue: hmRepoMock },
        { provide: getRepositoryToken(Case), useValue: (caseRepoMock = { find: jest.fn(), findOne: jest.fn(), manager: { query: jest.fn() } }) },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(), query: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    service = module.get<BeneficiariesService>(BeneficiariesService);
  });

  describe('createBeneficiary', () => {
    const baseData = {
      surname: 'Dela Cruz',
      firstName: 'Juan',
      gender: 'Male',
      dob: new Date('2000-01-01'),
      philsysNumber: '1234-5678-9012',
    };

    it('reuses an existing person when philsysNumber matches (no duplicate)', async () => {
      personRepoMock.findOne.mockResolvedValue({ id: 'person-existing', philsysNumber: '1234-5678-9012' });
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-1', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c1' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalledWith({ where: { philsysNumber: '1234-5678-9012' } });
      expect(personRepoMock.save).not.toHaveBeenCalled();
      expect(result.personId).toBe('person-existing');
    });

    it('creates a new person when philsysNumber is new', async () => {
      personRepoMock.findOne.mockResolvedValue(null);
      personRepoMock.create.mockImplementation((dto: any) => dto);
      personRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'person-new', ...dto }));
      benRepoMock.create.mockImplementation((dto: any) => dto);
      benRepoMock.save.mockImplementation(async (dto: any) => ({ id: 'ben-2', ...dto }));
      consentRepoMock.save.mockResolvedValue({ id: 'c2' });

      const result = await service.createBeneficiary(baseData);

      expect(personRepoMock.findOne).toHaveBeenCalled();
      expect(personRepoMock.save).toHaveBeenCalledTimes(1);
      expect(result.personId).toBe('person-new');
    });
  });

  describe('setHouseholdNhtsPr', () => {
    it('sets the Listahanan reference id', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: { id: 'h1' } });
      const res = await service.setHouseholdNhtsPr('ben-1', 'NHTS-2024-000123');
      expect(benRepoMock.manager.update).toHaveBeenCalledWith(Household, 'h1', { nhtsPrId: 'NHTS-2024-000123' });
      expect(res).toEqual({ householdId: 'h1', nhtsPrId: 'NHTS-2024-000123' });
    });

    it('clears the id when passed an empty string', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: { id: 'h1' } });
      await service.setHouseholdNhtsPr('ben-1', '');
      expect(benRepoMock.manager.update).toHaveBeenCalledWith(Household, 'h1', { nhtsPrId: null });
    });

    it('throws when the beneficiary has no household', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', household: null });
      await expect(service.setHouseholdNhtsPr('ben-1', 'X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setFamilyMemberStatus', () => {
    it('marks a member inactive with a reason', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'h1' });
      hmRepoMock.findOne.mockResolvedValue({ id: 'hm-1', householdId: 'h1', status: 'Active' });
      hmRepoMock.save.mockImplementation(async (m: any) => m);

      const res = await service.setFamilyMemberStatus('ben-1', 'hm-1', { active: false, reason: 'Moved out' });

      expect(hmRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 'hm-1', householdId: 'h1' } });
      expect(hmRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'Inactive', statusReason: 'Moved out' }));
      expect(res).toEqual({ id: 'hm-1', status: 'Inactive', statusReason: 'Moved out' });
    });

    it('reactivates a member and clears the reason', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'h1' });
      hmRepoMock.findOne.mockResolvedValue({ id: 'hm-1', householdId: 'h1', status: 'Inactive', statusReason: 'Moved out' });
      hmRepoMock.save.mockImplementation(async (m: any) => m);

      const res = await service.setFamilyMemberStatus('ben-1', 'hm-1', { active: true });

      expect(hmRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'Active', statusReason: null }));
      expect(res).toEqual({ id: 'hm-1', status: 'Active', statusReason: null });
    });

    it('refuses a membership that is not in the beneficiary household', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'h1' });
      hmRepoMock.findOne.mockResolvedValue(null);
      await expect(service.setFamilyMemberStatus('ben-1', 'hm-x', { active: false })).rejects.toThrow(NotFoundException);
    });

    it('refuses a beneficiary with no household', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: null });
      await expect(service.setFamilyMemberStatus('ben-1', 'hm-1', { active: false })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFamilyGraph', () => {
    it('keeps inactive members in the roster but out of the household count', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'h1', personId: 'p1' });
      personRepoMock.findOne.mockResolvedValue({
        id: 'p1', surname: 'Dela Cruz', firstName: 'Juan', middleName: null, extension: null,
        gender: 'Male', dob: new Date('1980-01-01'), occupation: 'Farmer', estimatedMonthlyIncome: 0, age: 46,
      });
      hmRepoMock.query.mockResolvedValue([
        { id: 'hm-1', full_name: 'Elena Dela Cruz', surname: 'Dela Cruz', first_name: 'Elena', middle_name: null, extension: null, gender: 'Female', dob: '1956-08-11', relationship: 'Spouse', age: 69, occupation: 'Housewife', income: 0, status: 'Active', status_reason: null, is_primary: false },
        { id: 'hm-2', full_name: 'Kuatro Dela Cruz', surname: 'Dela Cruz', first_name: 'Kuatro', middle_name: null, extension: null, gender: 'Female', dob: '2020-01-01', relationship: 'Child', age: 6, occupation: null, income: 0, status: 'Inactive', status_reason: 'Moved out', is_primary: false },
      ]);

      benRepoMock.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT t.person_id)')) return Promise.resolve([{ size: '2' }]);
        if (sql.includes('FROM beneficiaries b')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const res = await service.getFamilyGraph('ben-1');

      // Primary + one active member; the inactive member is still listed.
      expect(res.totalCount).toBe(2);
      expect(res.members).toHaveLength(3);

      const sizeCall = benRepoMock.query.mock.calls.find((c: any[]) =>
        String(c[0]).includes('COUNT(DISTINCT t.person_id)'),
      );
      expect(String(sizeCall[0])).toContain("<> 'inactive'");
      // a membership row for the primary would list the same person twice
      expect(String(hmRepoMock.query.mock.calls[0][0])).toContain('hm.person_id <> $3');
      expect(hmRepoMock.query.mock.calls[0][1]).toContain('p1');
      // The primary carries the same detail fields as a member.
      expect(res.primary).toMatchObject({ gender: 'Male', dob: '1980-01-01' });
      const inactive = res.members.find((m: any) => m.id === 'hm-2');
      expect(inactive).toMatchObject({ status: 'Inactive', statusReason: 'Moved out' });
    });

    it('lists and counts a second beneficiary that intake created without a membership row', async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1', householdId: 'h1', personId: 'p1' });
      personRepoMock.findOne.mockResolvedValue({
        id: 'p1', surname: 'Reyes', firstName: 'Pedro', middleName: null, extension: null,
        gender: 'Male', dob: new Date('1988-03-21'), occupation: null, estimatedMonthlyIncome: 0, age: 38,
      });
      // confirmMatch writes no membership row for the member it turns into a
      // beneficiary: the roster used to hold only the primary while two people
      // shared the household, and the size counted one.
      hmRepoMock.query.mockResolvedValue([]);
      benRepoMock.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT t.person_id)')) return Promise.resolve([{ size: '2' }]);
        if (sql.includes('FROM beneficiaries b')) {
          return Promise.resolve([{
            id: 'ben-2', person_id: 'p2', full_name: 'Ana Reyes', surname: 'Reyes', first_name: 'Ana',
            middle_name: 'Lontok', extension: null, gender: 'Female', dob: '1990-01-01', age: 36,
            occupation: 'Vendor', income: 5000,
          }]);
        }
        return Promise.resolve([]);
      });

      const res = await service.getFamilyGraph('ben-1');

      expect(res.totalCount).toBe(2);
      // primary + the co-beneficiary, which has no relationship stored
      expect(res.members).toHaveLength(2);
      const co = res.members.find((m: any) => m.personId === 'p2');
      expect(co).toMatchObject({ fullName: 'Ana Reyes', relationship: null, isBeneficiary: true, isPrimary: false });
      expect(res.members.find((m: any) => m.isPrimary)?.fullName).toContain('Pedro');
    });
  });

  describe('getAccessCard', () => {
    it('returns { card: null } (200) when the claimant has no beneficiary', async () => {
      // resolveMyBeneficiary direct hit misses, userRepo.findOne yields no
      // person, so no beneficiary resolves at all.
      benRepoMock.findOne.mockResolvedValue(undefined);

      await expect(service.getAccessCard('user-1')).resolves.toEqual({ card: null });

      expect(caseRepoMock.manager.query).not.toHaveBeenCalled();
    });

    it('returns { card: null } (200) when the household has no access card', async () => {
      benRepoMock.findOne
        .mockResolvedValueOnce({ id: 'ben-1' }) // resolveMyBeneficiary direct hit
        .mockResolvedValueOnce({ id: 'ben-1', household: null }); // withHousehold lookup

      await expect(service.getAccessCard('user-1')).resolves.toEqual({ card: null });

      expect(caseRepoMock.manager.query).not.toHaveBeenCalled();
    });

    it('returns the card shape when the household has an access card', async () => {
      benRepoMock.findOne
        .mockResolvedValueOnce({ id: 'ben-1' })
        .mockResolvedValueOnce({
          id: 'ben-1',
          person: { firstName: 'Juan', surname: 'Dela Cruz' },
          household: { accessCardCode: 'NORZ-AC-2026-0042', barangay: 'Poblacion' },
        });
      caseRepoMock.manager.query.mockResolvedValue([
        { service_rendered: 'Medical Consultation', service_date: new Date('2026-07-20'), cost: 1500, category: 'community_service' },
      ]);

      const res = await service.getAccessCard('user-1');

      expect(res).toEqual({
        code: 'NORZ-AC-2026-0042',
        beneficiary: { name: 'Juan Dela Cruz', barangay: 'Poblacion' },
        services: [{ serviceRendered: 'Medical Consultation', serviceDate: '2026-07-20', cost: 1500, category: 'community_service' }],
        remainingSlots: 17,
      });
    });
  });

  describe('findAll', () => {
    function mockListQuery(rows: any[]) {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
      };
      benRepoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);
      return qb;
    }

    it('enriches each row with its intervention count and last delivery', async () => {
      const rows = [
        { id: 'ben-1', person: { id: 'p-1' }, household: { id: 'h-1' } },
        { id: 'ben-2', person: { id: 'p-2' }, household: { id: 'h-2' } },
      ];
      mockListQuery(rows);
      benRepoMock.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT t.person_id)')) {
          return Promise.resolve([{ household_id: 'h-1', cnt: '4' }]);
        }
        if (sql.includes('case_interventions')) {
          return Promise.resolve([{ beneficiary_id: 'ben-1', cnt: '5', last: '2026-06-02' }]);
        }
        return Promise.resolve([]); // the client-category lookup
      });

      const res = await service.findAll(undefined, 'pedro', 1, 50);

      expect(res.total).toBe(2);
      expect((res.data[0] as any).interventionCount).toBe(5);
      expect((res.data[0] as any).lastInterventionDate).toBe('2026-06-02');
      // someone with no interventions reports zero rather than being absent
      expect((res.data[1] as any).interventionCount).toBe(0);
      expect((res.data[1] as any).lastInterventionDate).toBeNull();

      // the count is scoped to the ids on this page
      const ivCall = benRepoMock.query.mock.calls.find((c: any[]) =>
        String(c[0]).includes('case_interventions'),
      );
      expect(ivCall[1][0]).toEqual(['ben-1', 'ben-2']);
    });

    it('reports household size as the distinct people in the household', async () => {
      const rows = [
        { id: 'ben-1', person: { id: 'p-1' }, household: { id: 'h-1' } },
        { id: 'ben-2', person: { id: 'p-2' }, household: { id: 'h-2' } },
      ];
      mockListQuery(rows);
      benRepoMock.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT t.person_id)')) {
          return Promise.resolve([{ household_id: 'h-1', cnt: '4' }]);
        }
        return Promise.resolve([]);
      });

      const res = await service.findAll(undefined, 'pedro', 1, 50);

      expect((res.data[0].household as any).familyMemberCount).toBe(4);
      // a household the lookup misses still counts its own beneficiary
      expect((res.data[1].household as any).familyMemberCount).toBe(1);

      // the rule: beneficiaries unioned with active memberships, per person
      const sizeCall = benRepoMock.query.mock.calls.find((c: any[]) =>
        String(c[0]).includes('COUNT(DISTINCT t.person_id)'),
      );
      const sql = String(sizeCall[0]);
      expect(sql).toContain('FROM beneficiaries');
      expect(sql).toContain('FROM household_memberships');
      expect(sql).toContain("<> 'inactive'");
    });

    it('still returns the list when the history lookup fails', async () => {
      const rows = [{ id: 'ben-1', person: { id: 'p-1' }, household: { id: 'h-1' } }];
      mockListQuery(rows);
      benRepoMock.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('case_interventions')) return Promise.reject(new Error('boom'));
        return Promise.resolve([]);
      });

      const res = await service.findAll(undefined, 'pedro');

      expect(res.data).toHaveLength(1);
      expect((res.data[0] as any).interventionCount).toBeUndefined();
    });
  });

  describe('getInterventions', () => {
    it("returns every intervention across the beneficiary's cases", async () => {
      benRepoMock.findOne.mockResolvedValue({ id: 'ben-1' });
      const rows = [
        { id: 'IV-1', caseId: 'C-001', serviceName: 'Cash grant', interventionType: 'FA', deliveryDate: '2026-06-02', amount: '1500.00', fundSource: 'MSWDO', notes: null },
      ];
      caseRepoMock.manager.query.mockResolvedValue(rows);

      const res = await service.getInterventions('ben-1');

      expect(res).toEqual(rows);
      const [sql, params] = caseRepoMock.manager.query.mock.calls[0];
      expect(sql).toContain('case_interventions');
      expect(sql).toContain('c.beneficiary_id = $1');
      expect(params).toEqual(['ben-1']);
    });

    it('throws NotFoundException when the beneficiary does not exist', async () => {
      benRepoMock.findOne.mockResolvedValue(null);

      await expect(service.getInterventions('missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(caseRepoMock.manager.query).not.toHaveBeenCalled();
    });
  });
});
