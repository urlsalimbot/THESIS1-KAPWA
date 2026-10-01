import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';
import { User, UserRole } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

function agencyUser(id: string, agencyId: string) {
  return { id, role: 'social_worker', agencyId } as any;
}

/** Granted = resolved; refused = rejected. Error messages are asserted separately. */
const granted = (p: Promise<unknown>) => p.then(() => true, () => false);

describe('InterAgencyReferralsService', () => {
  let service: InterAgencyReferralsService;
  let repoMock: any;
  let agencyRepoMock: any;
  let benRepoMock: any;
  let caseRepoMock: any;
  let casesServiceMock: any;
  let userRepoMock: any;
  let notifServiceMock: any;

  beforeEach(async () => {
    repoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    benRepoMock = { findOne: jest.fn(), manager: { query: jest.fn() } };
    caseRepoMock = { findOne: jest.fn() };
    casesServiceMock = { create: jest.fn() };
    userRepoMock = { find: jest.fn().mockResolvedValue([]) };
    notifServiceMock = { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterAgencyReferralsService,
        { provide: getRepositoryToken(InterAgencyReferral), useValue: repoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: CasesService, useValue: casesServiceMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: NotificationsService, useValue: notifServiceMock },
      ],
    }).compile();
    service = module.get<InterAgencyReferralsService>(InterAgencyReferralsService);
  });

  describe('create', () => {
    it('rejects callers with no linked agency', async () => {
      await expect(service.create({ toAgencyId: 'ag-2', reason: 'x', legalBasisCode: 'c' } as any, agencyUser('u1', ''))).rejects.toThrow('Your account is not linked to an agency');
    });

    it('rejects admin with no linked agency', async () => {
      await expect(
        service.create({ toAgencyId: 'ag-2', reason: 'x', legalBasisCode: 'c' } as any, { id: 'u-admin', role: 'admin' } as any),
      ).rejects.toThrow('Your account is not linked to an agency');
    });

    it('rejects unknown target agency with 422', async () => {
      agencyRepoMock.findOne.mockResolvedValue(null);
      await expect(
        service.create({ personId: 'p1', toAgencyId: 'ag-2', reason: 'x', legalBasisCode: 'c' } as any, agencyUser('u1', 'ag-1')),
      ).rejects.toThrow('Unknown target agency');
    });

    it('creates a referred referral from the caller agency', async () => {
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-2', name: 'RHU' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1', personId: 'p1' });
      repoMock.create.mockImplementation((dto: any) => dto);
      repoMock.save.mockImplementation(async (dto: any) => ({ id: 'r1', ...dto }));

      const result = await service.create(
        { beneficiaryId: 'b1', toAgencyId: 'ag-2', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13' } as any,
        agencyUser('u1', 'ag-1'),
      );
      expect(result).toEqual(expect.objectContaining({
        id: 'r1',
        personId: 'p1',
        fromAgencyId: 'ag-1',
        toAgencyId: 'ag-2',
        status: 'referred',
        createdBy: 'u1',
      }));
    });
  });

  describe('transitions', () => {
    const baseRef = { id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2', status: 'referred', personId: 'p1' };

    it('receive by receiving agency works', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      repoMock.save.mockImplementation(async (dto: any) => dto);
      const result = await service.receive('r1', agencyUser('u2', 'ag-2'));
      expect(result.status).toBe('received');
      expect(result.receivedAt).toBeInstanceOf(Date);
    });

    it('rejects a non-participating agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.receive('r1', agencyUser('u9', 'ag-9'))).rejects.toThrow('Referral is not associated with your agency');
    });

    it('rejects sending agency from performing a transition', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.receive('r1', agencyUser('u1', 'ag-1'))).rejects.toThrow('Only the receiving agency can update this referral');
    });

    it('rejects illegal closed->referred transition', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'closed' });
      await expect(service.receive('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('Cannot transition from "closed" to "received"');
    });

    it('rejects action before receive', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'referred' });
      await expect(service.action('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('Cannot transition from "referred" to "actioned"');
    });

    it('allows decline only from referred', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'received' });
      await expect(service.decline('r1', agencyUser('u2', 'ag-2'), { declinedReason: 'no' })).rejects.toThrow('Cannot transition from "received" to "declined"');
    });

    it('decline from referred works', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      repoMock.save.mockImplementation(async (dto: any) => dto);
      const result = await service.decline('r1', agencyUser('u2', 'ag-2'), { declinedReason: 'Out of scope' });
      expect(result.status).toBe('declined');
      expect(result.declinedReason).toBe('Out of scope');
    });

    it('close requires an outcome and only from actioned', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, status: 'received' });
      await expect(service.close('r1', agencyUser('u2', 'ag-2'), { outcome: 'Done' })).rejects.toThrow('Cannot transition from "received" to "closed"');
    });
  });

  describe('findOne', () => {
    const baseRef = { id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2', status: 'referred', personId: 'p1', createdBy: 'u1' };

    it('returns the referral for a participating agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, fromAgency: { id: 'ag-1' }, toAgency: { id: 'ag-2' }, person: { id: 'p1' } });
      const result = await service.findOne('r1', agencyUser('u2', 'ag-2'));
      expect(result.id).toBe('r1');
      expect(result.toAgency).toEqual({ id: 'ag-2' });
    });

    it('admin sees any referral', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      const result = await service.findOne('r1', { id: 'u-admin', role: 'admin' } as any);
      expect(result.id).toBe('r1');
    });

    it('social worker without agency sees referrals they created', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      const result = await service.findOne('r1', agencyUser('u1', ''));
      expect(result.id).toBe('r1');
    });

    it('throws NotFound for a non-participating caller', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.findOne('r1', agencyUser('u3', 'ag-3'))).rejects.toThrow('Inter-agency referral not found');
    });

    it('throws NotFound for a missing referral', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing', agencyUser('u2', 'ag-2'))).rejects.toThrow('Inter-agency referral not found');
    });
  });

  describe('searchBeneficiaries', () => {
    function qbMock() {
      return {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
      };
    }

    it('agency caller gets only beneficiaries in referrals touching their agency', async () => {
      const qb = qbMock();
      qb.getRawMany.mockResolvedValue([
        { id: 'b1', full_name: 'Juan Santos', control_no: 'KAPWA-C-1', barangay: 'Bigte' },
      ]);
      repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.searchBeneficiaries('juan', agencyUser('u1', 'ag-rhu'));

      expect(repoMock.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(r.from_agency_id = :agencyId OR r.to_agency_id = :agencyId)',
        { agencyId: 'ag-rhu' },
      );
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([
        { id: 'b1', fullName: 'Juan Santos', controlNo: 'KAPWA-C-1', barangay: 'Bigte' },
      ]);
    });

    it('no agencyId resolves [] without throwing', async () => {
      await expect(service.searchBeneficiaries('juan', agencyUser('u1', ''))).resolves.toEqual([]);
      expect(repoMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('empty query resolves [] without invoking the query builder', async () => {
      const result = await service.searchBeneficiaries('   ', agencyUser('u1', 'ag-rhu'));
      expect(result).toEqual([]);
      expect(repoMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('escapes ilike wildcards, dedupes via distinct, and null-safes the full name', async () => {
      const qb = qbMock();
      qb.getRawMany.mockResolvedValue([]);
      repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.searchBeneficiaries('100%_x', { id: 'u-admin', role: 'admin' } as any);

      expect(qb.distinct).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining("ESCAPE '\\'"),
        { q: '%100\\%\\_x%' },
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(p.first_name'),
        'full_name',
      );
      expect(qb.addSelect).toHaveBeenCalledWith('p.surname', 'surname');
    });

    it('admin caller searches referral-derived beneficiaries without agency scoping', async () => {
      const qb = qbMock();
      qb.getRawMany.mockResolvedValue([
        { id: 'b2', full_name: 'Maria Cruz', control_no: null, barangay: null },
      ]);
      repoMock.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.searchBeneficiaries('maria', {
        id: 'u-admin',
        role: 'admin',
      } as any);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'b2', fullName: 'Maria Cruz', controlNo: null, barangay: null },
      ]);
    });
  });

  describe('promoteToCase', () => {
    it('creates a case and links the referral', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'r1', personId: 'p1', status: 'received', caseId: null, fromAgencyId: 'ag-1', toAgencyId: 'ag-2' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1' });
      casesServiceMock.create.mockResolvedValue({ id: 'case-1', controlNo: 'KAPWA-2026-0001' });
      repoMock.save.mockImplementation(async (dto: any) => dto);

      const result = await service.promoteToCase('r1', agencyUser('u2', 'ag-2'));
      expect(result.id).toBe('case-1');
      expect(casesServiceMock.create).toHaveBeenCalledWith({
        beneficiaryId: 'b1',
        serviceRequested: expect.any(Array),
        assignedWorkerId: 'u2',
      });
    });

    it('rejects promote when already linked to a case', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'r1', personId: 'p1', status: 'received', caseId: 'case-9', fromAgencyId: 'ag-1', toAgencyId: 'ag-2' });
      await expect(service.promoteToCase('r1', agencyUser('u2', 'ag-2'))).rejects.toThrow('already linked to a case');
    });
  });


  describe('getPersonBenefitLedger', () => {
    const query = () => benRepoMock.manager.query as jest.Mock;

    function seedPerson(cards: string[], interventions: any[], referrals: any[]) {
      query().mockImplementation(async (sql: string) => {
        if (/FROM persons/.test(sql)) return [{ id: 'p1' }];
        if (/access_card_services/.test(sql)) return [];
        if (/access_card_code/.test(sql)) return cards.map((c) => ({ code: c }));
        if (/case_interventions/.test(sql)) return interventions;
        if (/inter_agency_referrals/.test(sql)) return referrals;
        return [];
      });
    }

    it('throws NotFound when the person does not exist', async () => {
      query().mockResolvedValue([]);
      await expect(service.getPersonBenefitLedger('p1', { id: 'u1', role: 'admin' } as any))
        .rejects.toThrow('Person not found');
    });

    it('rejects a caller with no agency and no MSWDO role', async () => {
      query().mockResolvedValue([{ id: 'p1' }]);
      await expect(
        service.getPersonBenefitLedger('p1', { id: 'u1', role: 'coordinator', agencyId: '' } as any),
      ).rejects.toThrow('Your account is not linked to an agency');
    });

    it('groups benefits by facility and flags multi-facility receipt for admin', async () => {
      seedPerson(
        ['NORZ-AC-2026-0001'],
        [
          { id: 'iv1', service: 'Financial Aid', date: '2026-08-01', amount: '5000', fundSource: 'LGU - Municipal' },
        ],
        [],
      );
      query().mockImplementation(async (sql: string) => {
        if (/FROM persons/.test(sql)) return [{ id: 'p1' }];
        if (/access_card_services/.test(sql)) return [
          { cardCode: 'NORZ-AC-2026-0001', service: 'LTO Gas Subsidy', date: '2026-08-10', amount: '3000', agencyId: 'ag-lto', agencyCode: 'LTO', agencyName: 'LTO Norzagaray', category: 'fuel' },
        ];
        if (/access_card_code/.test(sql)) return [{ code: 'NORZ-AC-2026-0001' }];
        if (/case_interventions/.test(sql)) return [
          { id: 'iv1', service: 'Financial Aid', date: '2026-08-01', amount: '5000', fundSource: 'LGU - Municipal', agencyId: 'MSWDO', agencyCode: 'MSWDO', agencyName: 'MSWDO Norzagaray' },
        ];
        if (/inter_agency_referrals/.test(sql)) return [];
        return [];
      });

      const result = await service.getPersonBenefitLedger('p1', { id: 'u-admin', role: 'admin' } as any);

      expect(result.person.id).toBe('p1');
      expect(result.totalAidAmount).toBe(8000);
      expect(result.distinctFacilities).toBe(2);
      expect(result.multiFacilityDetected).toBe(true);
      expect(result.byAgency.map((a: any) => a.agencyCode).sort()).toEqual(['LTO', 'MSWDO']);
      const lto = result.byAgency.find((a: any) => a.agencyCode === 'LTO')!;
      expect(lto.totalAmount).toBe(3000);
      const mswdo = result.byAgency.find((a: any) => a.agencyCode === 'MSWDO')!;
      expect(mswdo.totalAmount).toBe(5000);
    });

    it('does not flag multi-facility when aid comes from a single office', async () => {
      seedPerson(
        ['NORZ-AC-2026-0001'],
        [
          { id: 'iv1', service: 'Financial Aid', date: '2026-08-01', amount: '5000', fundSource: 'LGU - Municipal', agencyId: 'MSWDO', agencyCode: 'MSWDO', agencyName: 'MSWDO Norzagaray' },
        ],
        [],
      );
      query().mockImplementation(async (sql: string) => {
        if (/FROM persons/.test(sql)) return [{ id: 'p1' }];
        if (/access_card_services/.test(sql)) return [];
        if (/access_card_code/.test(sql)) return [{ code: 'NORZ-AC-2026-0001' }];
        if (/case_interventions/.test(sql)) return [
          { id: 'iv1', service: 'Financial Aid', date: '2026-08-01', amount: '5000', fundSource: 'LGU - Municipal', agencyId: 'MSWDO', agencyCode: 'MSWDO', agencyName: 'MSWDO Norzagaray' },
        ];
        if (/inter_agency_referrals/.test(sql)) return [];
        return [];
      });

      const result = await service.getPersonBenefitLedger('p1', { id: 'u-admin', role: 'admin' } as any);
      expect(result.multiFacilityDetected).toBe(false);
      expect(result.distinctFacilities).toBe(1);
      expect(result.totalAidAmount).toBe(5000);
    });

    it('scopes agency_staff to their own facility and treats unassigned as visible', async () => {
      seedPerson(['NORZ-AC-2026-0001'], [], []);
      query().mockImplementation(async (sql: string) => {
        if (/FROM persons/.test(sql)) return [{ id: 'p1' }];
        if (/access_card_services/.test(sql)) return [
          { cardCode: 'NORZ-AC-2026-0001', service: 'GAS', date: '2026-08-10', amount: '1000', agencyId: 'ag-lto', agencyCode: 'LTO', agencyName: 'LTO Norzagaray', category: 'fuel' },
          { cardCode: 'NORZ-AC-2026-0001', service: 'Meds', date: '2026-08-11', amount: '500', agencyId: null, agencyCode: null, agencyName: null, category: 'med' },
        ];
        if (/access_card_code/.test(sql)) return [{ code: 'NORZ-AC-2026-0001' }];
        if (/case_interventions/.test(sql)) return [];
        if (/inter_agency_referrals/.test(sql)) return [];
        return [];
      });

      const result = await service.getPersonBenefitLedger('p1', { id: 'u-admin', role: 'admin' } as any);

      expect(result.byAgency.length).toBe(2);
      expect(result.services.some((s: any) => s.agencyId === 'ag-lto')).toBe(true);
      expect(result.services.some((s: any) => s.agencyName === 'Unassigned office')).toBe(true);
    });
  });

  describe('endorsement letter', () => {
    const fullReferral = {
      id: 'r1',
      caseId: 'c1',
      fromAgencyId: 'ag-mswdo',
      toAgencyId: 'ag-rhu',
      reason: 'Medical coordination',
      notes: 'Bring philhealth id',
      legalBasisCode: 'public_authority_sec13',
      person: { firstName: 'Juan', middleName: 'B.', surname: 'Dela Cruz' },
      toAgency: { name: 'Rural Health Unit - Norzagaray' },
      fromAgency: { name: 'MSWDO Norzagaray' },
      case: { controlNo: 'CASE-2026-0009', clientCategory: 'Indigent' },
      status: 'referred',
      createdAt: new Date(),
    } as any;

    function seedIssueFlow() {
      agencyRepoMock.findOne.mockImplementation((opts: any) => {
        if (opts.where?.code === 'MSWDO') return Promise.resolve({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });
        return Promise.resolve({ id: 'ag-rhu', name: 'Rural Health Unit - Norzagaray' });
      });
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'b1' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1', personId: 'p1' });
      repoMock.create.mockImplementation((d: any) => d);
      repoMock.save.mockImplementation(async (d: any) => ({ id: 'r1', ...d }));
      repoMock.findOne.mockResolvedValue(fullReferral);
    }

    it('records the referral and returns a letter PDF', async () => {
      seedIssueFlow();
      const actor = { id: 'u1', role: 'admin', fullName: 'Rosario Mendoza' } as any;

      const { referral, pdf } = await service.issueEndorsementLetter(
        'c1',
        { toAgencyId: 'ag-rhu', reason: 'Medical coordination', legalBasisCode: 'public_authority_sec13', notes: 'Bring philhealth id' },
        actor,
      );

      expect(referral.caseId).toBe('c1');
      expect(referral.toAgencyId).toBe('ag-rhu');
      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(1000);
    });

    it('denies the letter for a referral outside the caller agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...fullReferral, fromAgencyId: 'ag-other', toAgencyId: 'ag-other' });

      await expect(
        service.endorsementLetterPdf('r1', { id: 'x', role: 'social_worker', agencyId: 'ag-rhu' } as any),
      ).rejects.toThrow('not associated with your agency');
    });

    it('renders the endorsement letter for a social worker with no agencyId', async () => {
      // MSWDO staff carry no agency on production accounts, so create()
      // substitutes the MSWDO agency as fromAgencyId. The scope check must
      // recognise the same caller, or the worker who just issued the letter
      // is refused it with 403 — the bug this test pins.
      //
      // `createdBy` is the caller, because that is what `create()` writes for
      // this scenario: the unlinked-worker exemption is "the worker who created
      // it", not "any unlinked MSWDO worker". A referral this worker had no part
      // in is a different case, and `the letter is scoped by the same rule as
      // findOne` below refuses it.
      repoMock.findOne.mockResolvedValue({ ...fullReferral, createdBy: 'u-sw' });
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });

      const pdf = await service.endorsementLetterPdf('r1', {
        id: 'u-sw',
        role: UserRole.SW,
        agencyId: null,
        fullName: 'Ana Reyes',
      } as any);

      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('re-downloads the letter for an existing referral', async () => {
      repoMock.findOne.mockResolvedValue(fullReferral);
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });

      const pdf = await service.endorsementLetterPdf('r1', { id: 'u1', role: 'admin' } as any);

      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(repoMock.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1' } }),
      );
    });
  });

  /**
   * The endorsement letter is a read of the referral row, so the linkage it
   * demands has to be the linkage `findOne` demands. It did not: `findOne` wants
   * admin, a participating agency, or the social worker who created the referral,
   * while the letter wanted admin *or an unlinked MSWDO staff member* — so an
   * MSWDO worker who had nothing to do with a referral could download that
   * referral's letter, a PII-bearing document, for any referral id in the table.
   *
   * Every caller below is asserted against BOTH entry points, and against a
   * spelled-out expected answer, so the two cannot drift apart again and neither
   * can be wrong in the same direction.
   */
  describe('the letter is scoped by the same rule as findOne', () => {
    const referral = (over: Record<string, unknown> = {}) => ({
      id: 'r1',
      caseId: 'c1',
      fromAgencyId: 'ag-mswdo',
      toAgencyId: 'ag-rhu',
      reason: 'Medical coordination',
      legalBasisCode: 'public_authority_sec13',
      person: { firstName: 'Juan', surname: 'Dela Cruz' },
      toAgency: { name: 'Rural Health Unit - Norzagaray' },
      fromAgency: { name: 'MSWDO Norzagaray' },
      case: { controlNo: 'CASE-2026-0009', clientCategory: 'Indigent' },
      status: 'referred',
      createdBy: 'u-creator',
      createdAt: new Date(),
      ...over,
    } as any);

    /** Granted = resolved; refused = rejected. The message is asserted separately. */
    const CASES: Array<[string, any, boolean]> = [
      // An MSWDO worker is not linked to an agency at all, so nothing in the row
      // points at them — unless they are the one who created it.
      ['an unlinked MSWDO worker who did not create it', { id: 'u-other', role: UserRole.SW, agencyId: null }, false],
      ['an unlinked MSWDO worker who created it', { id: 'u-creator', role: UserRole.SW, agencyId: null }, true],
      ['an unlinked admin', { id: 'u-admin', role: UserRole.ADMIN }, true],
      // Deliberate: an admin carrying an agencyId is NOT narrowed to it. That is
      // `findOne`'s answer too, and the letter matching it is the point of this
      // test — see the A3 note in the consolidation report.
      ['an admin carrying an unrelated agencyId', { id: 'u-admin-ag', role: UserRole.ADMIN, agencyId: 'ag-lto' }, true],
      ['a worker at the sending agency', { id: 'u-mswdo', role: UserRole.SW, agencyId: 'ag-mswdo' }, true],
      ['a worker at the receiving agency', { id: 'u-rhu', role: UserRole.SW, agencyId: 'ag-rhu' }, true],
      ['a worker at an unrelated agency', { id: 'u-lto', role: UserRole.SW, agencyId: 'ag-lto' }, false],
      // Not reachable through the route (`@Roles('admin','social_worker')`), but the
      // service must not hand out the letter to it either.
      ['a coordinator at an unrelated agency', { id: 'u-coord', role: UserRole.COORDINATOR, agencyId: 'ag-lto' }, false],
    ];

    for (const [label, caller, expected] of CASES) {
      it(`refuses the letter to ${label} and grants it to everyone else in the table`, async () => {
        repoMock.findOne.mockResolvedValue(referral());
        agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });

        expect(await granted(service.endorsementLetterPdf('r1', caller))).toBe(expected);
        expect(await granted(service.findOne('r1', caller))).toBe(expected);
      });
    }

    it('refuses the letter to the widened case without naming the referral', async () => {
      repoMock.findOne.mockResolvedValue(referral({ createdBy: 'someone-else' }));

      await expect(
        service.endorsementLetterPdf('r1', { id: 'u-other', role: UserRole.SW, agencyId: null } as any),
      ).rejects.toThrow('Referral is not associated with your agency');
    });
  });

  /**
   * `findForCase` cannot call the point-read predicate — it is a `WHERE` array,
   * which is a set union rather than a per-row test — so it restates the same rule
   * in query shape. This is what stops the restatement from drifting: the list
   * and the point read are compared row-for-row, per caller, over a fixture that
   * covers each linkage (sender, receiver, creator, unrelated).
   */
  describe('findForCase returns the rows the single rule accepts', () => {
    const fixture = [
      { id: 'r-partner', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu', createdBy: 'u-creator' },
      { id: 'r-unrelated', fromAgencyId: 'ag-lto', toAgencyId: 'ag-lto', createdBy: 'u-lto' },
      { id: 'r-mine', fromAgencyId: 'ag-lto', toAgencyId: 'ag-lto', createdBy: 'u-creator' },
      { id: 'r-incoming', fromAgencyId: 'ag-lto', toAgencyId: 'ag-rhu', createdBy: 'u-lto' },
    ].map((r) => ({ ...r, caseId: 'c1', status: 'referred', reason: 'x', createdAt: new Date() } as any));

    const CALLERS: Array<[string, any]> = [
      ['an unlinked MSWDO worker who created two of them', { id: 'u-creator', role: UserRole.SW, agencyId: null }],
      ['an unlinked MSWDO worker who created none', { id: 'u-other', role: UserRole.SW, agencyId: null }],
      ['an unlinked admin', { id: 'u-admin', role: UserRole.ADMIN }],
      ['an admin carrying an unrelated agencyId', { id: 'u-admin-ag', role: UserRole.ADMIN, agencyId: 'ag-lto' }],
      ['a worker at the sending agency', { id: 'u-mswdo', role: UserRole.SW, agencyId: 'ag-mswdo' }],
      ['a worker at the receiving agency', { id: 'u-rhu', role: UserRole.SW, agencyId: 'ag-rhu' }],
      ['a worker at an unrelated agency', { id: 'u-lto', role: UserRole.SW, agencyId: 'ag-lto' }],
    ];

    beforeEach(() => {
      // `findForCase` hands TypeORM an array of `where` objects, which it ORs.
      repoMock.find.mockImplementation(async ({ where }: any) => {
        const clauses = Array.isArray(where) ? where : [where];
        return fixture.filter((r) =>
          clauses.some((clause: Record<string, unknown>) =>
            Object.entries(clause).every(([k, v]) => (r as any)[k] === v),
          ),
        );
      });
    });

    for (const [label, caller] of CALLERS) {
      it(`agrees with the point read for ${label}`, async () => {
        const listed = (await service.findForCase('c1', caller)).map((r: any) => r.id).sort();

        const readable: string[] = [];
        for (const r of fixture) {
          repoMock.findOne.mockResolvedValue(r);
          if (await granted(service.findOne(r.id, caller))) readable.push(r.id);
        }

        expect(listed).toEqual(readable.sort());
      });
    }
  });
});
