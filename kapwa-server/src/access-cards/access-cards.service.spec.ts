import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service';
import { OrgService } from '../common/org.service';
import { AccessCardService } from './access-card-service.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';

describe('AccessCardsService', () => {
  let service: AccessCardsService;
  let repoMock: any;
  let queryRunnerMock: any;
  let consentRepoMock: any;
  let referralRepoMock: any;
  let agencyRepoMock: any;

  beforeEach(async () => {
    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    };
    repoMock = {
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
    };
    consentRepoMock = { findOne: jest.fn() };
    referralRepoMock = { find: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessCardsService,
        { provide: OrgService, useValue: { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') } },
        { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(InterAgencyReferral), useValue: referralRepoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
      ],
    }).compile();
    service = module.get<AccessCardsService>(AccessCardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAndAssign', () => {
    it('generates code and updates beneficiary in single call', async () => {
      queryRunnerMock.manager.query
        .mockResolvedValueOnce([{ id: 42 }])   // seq insert
        .mockResolvedValueOnce([])             // collision check (free)
        .mockResolvedValueOnce([])             // UPDATE beneficiary_roles
        .mockResolvedValueOnce([]);            // UPDATE households

      const result = await service.generateAndAssign('beneficiary-uuid');

      expect(result).toMatch(/^NORZ-AC-\d{4}-\d{4}$/);
      expect(queryRunnerMock.manager.query).toHaveBeenCalledTimes(4);
      expect(queryRunnerMock.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE beneficiary_roles SET access_card_code'),
        expect.arrayContaining(['beneficiary-uuid'])
      );
      expect(queryRunnerMock.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE households SET access_card_code'),
        expect.arrayContaining(['beneficiary-uuid'])
      );
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });

    it('handles transaction rollback on error', async () => {
      queryRunnerMock.manager.query
        .mockResolvedValueOnce([{ id: 42 }])
        .mockRejectedValueOnce(new Error('UPDATE failed'));

      await expect(service.generateAndAssign('beneficiary-uuid')).rejects.toThrow('UPDATE failed');

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunnerMock.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('findBeneficiaryCard', () => {
    it('returns beneficiary card data', async () => {
      const benData = { id: 'ben-id', access_card_code: 'NORZ-AC-2026-0042', surname: 'Doe', first_name: 'John' };
      repoMock.query.mockResolvedValue([benData]);
      repoMock.find.mockResolvedValue([]);

      const result = await service.findBeneficiaryCard('ben-id', { role: 'admin' } as any);

      expect(result).toEqual({
        beneficiary: benData,
        code: 'NORZ-AC-2026-0042',
        services: [],
      });
      expect(repoMock.query).toHaveBeenCalledWith(
        'SELECT b.id, COALESCE(h.access_card_code, br.access_card_code) AS access_card_code, p.surname, p.first_name FROM beneficiaries b LEFT JOIN households h ON h.id = b.household_id LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id JOIN persons p ON p.id = b.person_id WHERE b.id = $1',
        ['ben-id']
      );
    });

    it('throws NotFoundException when beneficiary has no card', async () => {
      repoMock.query.mockResolvedValue([{ id: 'ben-id', access_card_code: null }]);

      await expect(service.findBeneficiaryCard('ben-id', { role: 'admin' } as any)).rejects.toThrow('Beneficiary has no Access Card');
    });
  });

  describe('findCardByCode', () => {
    // Same shape as findBeneficiaryCard, but keyed on the printed card code —
    // the coordinator flow only ever has NORZ-AC-YYYY-NNNN, never a UUID.
    it('returns the card, beneficiary and services for a card code', async () => {
      const benData = { id: 'ben-id', access_card_code: 'NORZ-AC-2026-0042', surname: 'Doe', first_name: 'John' };
      repoMock.query.mockResolvedValue([benData]);
      repoMock.find.mockResolvedValue([{ id: 's1', accessCardCode: 'NORZ-AC-2026-0042' }]);

      const result = await service.findCardByCode('NORZ-AC-2026-0042', { role: 'admin' } as any);

      expect(result).toEqual({
        beneficiary: benData,
        code: 'NORZ-AC-2026-0042',
        services: [{ id: 's1', accessCardCode: 'NORZ-AC-2026-0042' }],
      });
      expect(repoMock.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE COALESCE(h.access_card_code, br.access_card_code) = $1'),
        ['NORZ-AC-2026-0042']
      );
      expect(repoMock.find).toHaveBeenCalledWith({
        where: { accessCardCode: 'NORZ-AC-2026-0042' },
        order: { serviceDate: 'DESC' },
      });
    });

    it('throws NotFoundException when no beneficiary owns the code', async () => {
      repoMock.query.mockResolvedValue([]);
      await expect(service.findCardByCode('NORZ-AC-9999', { role: 'admin' } as any))
        .rejects.toThrow('No access card found for this code');
    });

    it('denies agency_staff even when a referral links their agency', async () => {
      // The role no longer exists: assertCardAccess has no agency branch, so a
      // staff account that used to reach a card through a referral now falls
      // through to the same 'Not allowed' as anything else unrecognised.
      repoMock.query.mockResolvedValueOnce([{ beneficiary_id: 'b1', user_id: null, person_id: 'p1' }]);
      await expect(
        service.findCardByCode('NORZ-AC-2026-0042', { id: 'a1', role: 'agency_staff', agencyId: 'ag-1' } as any),
      ).rejects.toThrow('Not allowed');
    });
  });

  describe('logService', () => {
    it('creates and saves a service entry', async () => {
      const data = { accessCardCode: 'NORZ-AC-2026-0042', serviceRendered: 'Medical Aid', serviceDate: new Date() };
      const entry = { id: '1', ...data };
      repoMock.create.mockReturnValue(entry);
      repoMock.save.mockResolvedValue(entry);
      const result = await service.logService(data);
      expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining(data));
      expect(repoMock.save).toHaveBeenCalledWith(entry);
      expect(result).toEqual(entry);
    });
  });

  describe('logService boundary validation', () => {
    // POST /access-cards/log is the only writer that passes through ZodPipe.
    // FourPsService.logToCard and autoLogFromIntervention call logService as a
    // plain method — no HTTP, no pipe, no guards — which is how `4ps_compliance`
    // rows stayed invisible on the card for so long: they inserted cleanly,
    // tests passed, and the row matched no filter tab. Validating here makes an
    // out-of-vocabulary category a loud failure for every caller, not just the
    // HTTP one.
    it('rejects a category outside the sanctioned vocabulary', async () => {
      await expect(
        service.logService({
          accessCardCode: 'NORZ-AC-2026-0042',
          serviceRendered: '4Ps compliance',
          serviceDate: new Date('2026-09-01'),
          category: '4ps_compliance' as any,
        }),
      ).rejects.toThrow();
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('accepts every sanctioned category, including the 4Ps pair', async () => {
      repoMock.create.mockImplementation((d: any) => d);
      repoMock.save.mockImplementation((d: any) => Promise.resolve(d));
      for (const category of ['case_service', 'referral', 'community_service', 'seminar', 'payout', 'compliance'] as const) {
        const row = await service.logService({
          accessCardCode: 'NORZ-AC-2026-0042',
          serviceRendered: 'x',
          serviceDate: new Date('2026-09-01'),
          category,
        });
        expect(row.category).toBe(category);
      }
    });

    it('still defaults a missing category to referral', async () => {
      repoMock.create.mockImplementation((d: any) => d);
      repoMock.save.mockImplementation((d: any) => Promise.resolve(d));
      const row = await service.logService({
        accessCardCode: 'NORZ-AC-2026-0042',
        serviceRendered: 'x',
        serviceDate: new Date('2026-09-01'),
      });
      expect(row.category).toBe('referral');
    });

    it('rejects an empty serviceRendered', async () => {
      await expect(
        service.logService({
          accessCardCode: 'NORZ-AC-2026-0042',
          serviceRendered: '',
          serviceDate: new Date('2026-09-01'),
        }),
      ).rejects.toThrow();
      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('findByCard', () => {
    it('returns services for a card code ordered by date desc', async () => {
      const services = [{ id: '1', accessCardCode: 'NORZ-AC-2026-0042', serviceDate: new Date() }];
      repoMock.query.mockResolvedValue([{ id: 'b1' }]);
      repoMock.find.mockResolvedValue(services);
      const result = await service.findByCard('NORZ-AC-2026-0042', { role: 'admin' } as any);
      expect(repoMock.find).toHaveBeenCalledWith({
        where: { accessCardCode: 'NORZ-AC-2026-0042' },
        order: { serviceDate: 'DESC' },
      });
      expect(result).toEqual(services);
    });

    it('returns an empty list for a KNOWN card that has no logged services yet', async () => {
      repoMock.query.mockResolvedValue([{ id: 'b1' }]);
      repoMock.find.mockResolvedValue([]);
      const result = await service.findByCard('NORZ-AC-2026-0042', { role: 'admin' } as any);
      expect(result).toEqual([]);
      expect(repoMock.find).toHaveBeenCalled();
    });

    it('throws NotFoundException when the card code belongs to no beneficiary (Verify tab)', async () => {
      repoMock.query.mockResolvedValue([]);
      await expect(
        service.findByCard('NORZ-AC-2026-9999', { role: 'admin' } as any),
      ).rejects.toThrow('Access card not found');
      expect(repoMock.find).not.toHaveBeenCalled();
    });
  });

  describe('logService agency resolution', () => {
    // A real UUID, because `access_card_services.agency_id` is a UUID column
    // (migrate.ts) and the schema has always said so. The old 'ag-1' fixture
    // was tolerated only because nothing validated the service boundary — it
    // could never have inserted.
    const AGENCY_ID = '0192f3a4-5b6c-7d8e-9f01-234567890abc';

    it('stores agencyId directly when provided', async () => {
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 's1', ...dto }));
      const result = await service.logService({
        accessCardCode: 'NORZ-AC-2026-0042',
        serviceRendered: 'Medical Aid',
        serviceDate: new Date(),
        agencyId: AGENCY_ID,
      });
      expect(result).toEqual(expect.objectContaining({ id: 's1', agencyId: AGENCY_ID }));
    });
  });

  describe('getAgencySummary', () => {
    const admin = { id: 'u1', role: 'admin', agencyId: 'ag-1' } as any;
    const swAg1 = { id: 'u2', role: 'social_worker', agencyId: 'ag-1' } as any;

    it('splits services by caller agency and includes referral history for admin', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue({ id: 'c1' });
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
        { id: 's3', agencyId: null },
      ]);
      referralRepoMock.find.mockResolvedValue([{ id: 'r1', fromAgencyId: 'ag-2', toAgencyId: 'ag-1' }]);

      const result = await service.getAgencySummary('NORZ-AC-2026-0042', admin);

      expect(result.sharingConsentActive).toBe(true);
      expect(result.servicesRendered.map((s: any) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(result.servicesFromOtherAgencies.map((s: any) => s.id)).toEqual(['s2']);
      expect(result.referralHistory).toEqual([{ id: 'r1', fromAgencyId: 'ag-2', toAgencyId: 'ag-1' }]);
    });

    it('masks other-agency services when consent is inactive', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const result = await service.getAgencySummary('NORZ-AC-2026-0042', swAg1);

      expect(result.sharingConsentActive).toBe(false);
      expect(result.servicesRendered.map((s: any) => s.id)).toEqual(['s1']);
      expect(result.servicesFromOtherAgencies).toEqual([]);
    });

    it('throws NotFoundException when card code has no beneficiary', async () => {
      repoMock.query.mockResolvedValue([]);
      await expect(service.getAgencySummary('NORZ-AC-0000', admin)).rejects.toThrow('No access card found for this code');
    });

    it('claimant whose personId matches the card person sees referral history', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([]);
      referralRepoMock.find.mockResolvedValue([{ id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2' }]);

      const claimant = { id: 'u3', role: 'claimant', personId: 'p1' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.referralHistory).toEqual([{ id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2' }]);
      expect(result.servicesFromOtherAgencies).toEqual([]);
      expect(referralRepoMock.find).toHaveBeenCalledTimes(1);
    });

    it('claimant whose personId differs gets masked referral history and no other-agency services', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const claimant = { id: 'u3', role: 'claimant', personId: 'p9' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.referralHistory).toEqual([]);
      expect(result.servicesFromOtherAgencies).toEqual([]);
      expect(referralRepoMock.find).not.toHaveBeenCalled();
    });

    it('claimant with no personId gets masked referral history', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([]);

      const claimant = { id: 'u3', role: 'claimant' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.referralHistory).toEqual([]);
      expect(result.servicesFromOtherAgencies).toEqual([]);
      expect(referralRepoMock.find).not.toHaveBeenCalled();
    });

    it('claimant whose personId matches the card person sees servicesRendered', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const claimant = { id: 'u3', role: 'claimant', personId: 'p1' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.servicesRendered.map((s: any) => s.id)).toEqual(['s1', 's2']);
      expect(result.servicesFromOtherAgencies).toEqual([]);
    });

    it('claimant whose personId differs gets masked servicesRendered', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const claimant = { id: 'u3', role: 'claimant', personId: 'p9' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.servicesRendered).toEqual([]);
      expect(result.servicesFromOtherAgencies).toEqual([]);
    });

    it('claimant with no personId gets masked servicesRendered', async () => {
      repoMock.query.mockResolvedValue([{ beneficiary_id: 'b1', person_id: 'p1', first_name: 'Juan', surname: 'Dela Cruz' }]);
      consentRepoMock.findOne.mockResolvedValue(null);
      repoMock.find.mockResolvedValue([
        { id: 's1', agencyId: 'ag-1' },
        { id: 's2', agencyId: 'ag-2' },
      ]);

      const claimant = { id: 'u3', role: 'claimant' } as any;
      const result = await service.getAgencySummary('NORZ-AC-2026-0042', claimant);

      expect(result.servicesRendered).toEqual([]);
      expect(result.servicesFromOtherAgencies).toEqual([]);
    });
  });

  describe('autoLogFromIntervention', () => {
    it('tags the service to the MSWDO office so the aide ledger can attribute it', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ id: 'c1', beneficiary_id: 'b1' }])
        .mockResolvedValueOnce([{ id: 'b1', access_card_code: 'NORZ-AC-2026-0001' }]);
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', code: 'MSWDO' });
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 'ac-1', ...dto }));

      await service.autoLogFromIntervention({
        caseId: 'c1',
        serviceName: 'Financial Aid',
        deliveryDate: '2026-08-01',
        amount: 5000,
      });

      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessCardCode: 'NORZ-AC-2026-0001',
          serviceRendered: 'Financial Aid',
          agencyId: 'ag-mswdo',
          cost: 5000,
          category: 'case_service',
        }),
      );
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('leaves agency id null when no active MSWDO agency exists', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ id: 'c1', beneficiary_id: 'b1' }])
        .mockResolvedValueOnce([{ id: 'b1', access_card_code: 'NORZ-AC-2026-0001' }]);
      agencyRepoMock.findOne.mockResolvedValue(undefined);
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => dto);

      await service.autoLogFromIntervention({ caseId: 'c1', serviceName: 'Relief', amount: 1000 });

      expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ agencyId: undefined }));
    });

    it('does nothing when the case or access card code is missing', async () => {
      repoMock.query.mockResolvedValueOnce([]);
      await service.autoLogFromIntervention({ caseId: 'nope', serviceName: 'X' });
      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });
});

describe('AccessCardsService — ensureHouseholdCard', () => {
  let service: AccessCardsService;
  let repoMock: any;
  let qrMock: any;

  beforeEach(async () => {
    qrMock = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), manager: { query: jest.fn() },
    };
    repoMock = {
      query: jest.fn(),
      manager: { connection: { createQueryRunner: jest.fn().mockReturnValue(qrMock) } },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessCardsService,
        { provide: OrgService, useValue: { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') } },
        { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(InterAgencyReferral), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Agency), useValue: { findOne: jest.fn() } },
      ],
    }).compile();
    service = module.get(AccessCardsService);
  });

  it('returns the existing household card without generating a new one', async () => {
    repoMock.query.mockResolvedValue([{ code: 'NORZ-AC-2026-0007' }]);
    const code = await service.ensureHouseholdCard('b1');
    expect(code).toBe('NORZ-AC-2026-0007');
    expect(repoMock.query).toHaveBeenCalledTimes(1);
  });

  it('generates and assigns a new card when none exists', async () => {
    repoMock.query.mockResolvedValue([{ code: null }]);
    qrMock.manager.query
      .mockResolvedValueOnce([{ id: 42 }])  // seq insert
      .mockResolvedValueOnce([])            // collision check (free)
      .mockResolvedValueOnce([])            // UPDATE beneficiary_roles
      .mockResolvedValueOnce([]);           // UPDATE households
    const code = await service.ensureHouseholdCard('b1');
    expect(code).toMatch(/^NORZ-AC-\d{4}-\d{4}$/);
    expect(qrMock.manager.query).toHaveBeenCalledTimes(4);
  });

  it('skips taken codes and allocates a free one', async () => {
    repoMock.query.mockResolvedValue([{ code: null }]);
    qrMock.manager.query
      .mockResolvedValueOnce([{ id: 42 }])  // first seq insert
      .mockResolvedValueOnce([{ id: 1 }])   // code 0042 taken
      .mockResolvedValueOnce([{ id: 43 }])  // second seq insert
      .mockResolvedValueOnce([])            // code 0043 free
      .mockResolvedValueOnce([])            // UPDATE beneficiary_roles
      .mockResolvedValueOnce([]);           // UPDATE households
    const code = await service.ensureHouseholdCard('b1');
    expect(code).toBe('NORZ-AC-2026-0043');
    expect(qrMock.manager.query).toHaveBeenCalledTimes(6);
  });
});

describe('AccessCardsService.generateAccessCardPdf', () => {
  let service: AccessCardsService;
  let repoMock: any;
  let consentRepoMock: any;
  let referralRepoMock: any;
  let agencyRepoMock: any;

  beforeEach(async () => {
    repoMock = {
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      manager: { connection: { createQueryRunner: jest.fn() } },
    };
    consentRepoMock = { findOne: jest.fn() };
    referralRepoMock = { find: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessCardsService,
        { provide: OrgService, useValue: { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') } },
        { provide: getRepositoryToken(AccessCardService), useValue: repoMock },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepoMock },
        { provide: getRepositoryToken(InterAgencyReferral), useValue: referralRepoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
      ],
    }).compile();
    service = module.get<AccessCardsService>(AccessCardsService);
  });

  it('builds a PDF for a beneficiary with a card', async () => {
    repoMock.query
      .mockResolvedValueOnce([
        { id: 'b1', access_card_code: 'NORZ-AC-2026-0001', surname: 'Dela Cruz', first_name: 'Juan' },
      ])
      .mockResolvedValueOnce([
        { surname: 'Dela Cruz', first_name: 'Juan', middle_name: 'B', gender: 'Male', dob: new Date('1990-01-01'), address_raw: 'Brgy. San Mateo, Norzagaray, Bulacan; 123', phone: '0917-000-0000', nhts_pr_id: 'NHTS-2024-000123' },
      ])
      .mockResolvedValueOnce([
        { full_name: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, status: 'Employed', income: 15000 },
      ]);
    repoMock.find.mockResolvedValueOnce([
      { accessCardCode: 'NORZ-AC-2026-0001', serviceDate: new Date('2026-07-01'), serviceRendered: 'Financial Assistance', cost: 5000, agencyId: 'ag-1', agencyRef: { name: 'MSWDO' }, workerNameSign: 'R. Santos' },
    ]);
    const pdf = await service.generateAccessCardPdf('b1');
    expect(pdf.toString('latin1')).toContain('%PDF');
  });

  describe('claimant card ownership', () => {
    it('blocks a claimant from reading another beneficiary card', async () => {
      repoMock.query.mockResolvedValueOnce([
        { beneficiary_id: 'b1', user_id: 'someone-else', person_id: 'p-other' },
      ]);
      await expect(
        service.findBeneficiaryCard('b1', { id: 'me', role: 'claimant' } as any),
      ).rejects.toThrow('own access card');
    });

    it('allows a claimant to read their own card', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ beneficiary_id: 'b1', user_id: 'me', person_id: 'p1' }])
        .mockResolvedValueOnce([{ id: 'b1', access_card_code: 'NORZ-AC-2026-0001', surname: 'X', first_name: 'Y' }]);
      repoMock.find.mockResolvedValueOnce([]);
      await expect(
        service.findBeneficiaryCard('b1', { id: 'me', role: 'claimant' } as any),
      ).resolves.toMatchObject({ code: 'NORZ-AC-2026-0001' });
    });

    it('allows a claimant with a beneficiary_claimants link but no user_id stamp', async () => {
      repoMock.query
        .mockResolvedValueOnce([{ beneficiary_id: 'b2', user_id: null, person_id: 'p-ben' }])
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ id: 'b2', access_card_code: 'NORZ-AC-2026-0002', surname: 'X', first_name: 'Y' }]);
      repoMock.find.mockResolvedValueOnce([]);
      await expect(
        service.findBeneficiaryCard('b2', { id: 'me', role: 'claimant', personId: 'p-claim' } as any),
      ).resolves.toMatchObject({ code: 'NORZ-AC-2026-0002' });
    });

    it('denies agency_staff on findByCard too', async () => {
      repoMock.query.mockResolvedValueOnce([{ beneficiary_id: 'b1', user_id: null, person_id: 'p1' }]);
      await expect(
        service.findByCard('NORZ-AC-2026-0001', { id: 'a', role: 'agency_staff', agencyId: 'ag-9' } as any),
      ).rejects.toThrow('Not allowed');
    });
  });
});
