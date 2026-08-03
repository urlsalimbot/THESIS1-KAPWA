import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';

function agencyUser(id: string, agencyId: string) {
  return { id, role: 'social_worker', agencyId } as any;
}

describe('InterAgencyReferralsService', () => {
  let service: InterAgencyReferralsService;
  let repoMock: any;
  let agencyRepoMock: any;
  let benRepoMock: any;
  let caseRepoMock: any;
  let casesServiceMock: any;

  beforeEach(async () => {
    repoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    benRepoMock = { findOne: jest.fn() };
    caseRepoMock = { findOne: jest.fn() };
    casesServiceMock = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterAgencyReferralsService,
        { provide: getRepositoryToken(InterAgencyReferral), useValue: repoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: CasesService, useValue: casesServiceMock },
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

  describe('inbox scoping', () => {
    it('admin sees all', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findInbox({ id: 'u-admin', role: 'admin' } as any);
      expect(repoMock.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });

    it('agency caller sees from and to rows only', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findInbox(agencyUser('u1', 'ag-1'));
      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: [{ fromAgencyId: 'ag-1' }, { toAgencyId: 'ag-1' }] }),
      );
    });

    it('caller with no agency sees nothing', async () => {
      const result = await service.findInbox(agencyUser('u1', ''));
      expect(result).toEqual([]);
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
});
