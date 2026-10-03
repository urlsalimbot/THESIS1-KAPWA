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

      const res = await service.getFamilyGraph('ben-1');

      // Primary (1) + one active member; the inactive member is still listed.
      expect(res.totalCount).toBe(2);
      expect(res.members).toHaveLength(3);
      // The primary carries the same detail fields as a member.
      expect(res.primary).toMatchObject({ gender: 'Male', dob: '1980-01-01' });
      const inactive = res.members.find((m: any) => m.id === 'hm-2');
      expect(inactive).toMatchObject({ status: 'Inactive', statusReason: 'Moved out' });
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
});
