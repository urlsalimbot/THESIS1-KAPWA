import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { User, UserRole } from '../auth/user.entity';

function agencyUser(id: string, agencyId: string) {
  return { id, role: 'social_worker', agencyId } as any;
}

describe('InterAgencyReferralsService', () => {
  let service: InterAgencyReferralsService;
  let repoMock: any;
  let agencyRepoMock: any;
  let benRepoMock: any;
  let caseRepoMock: any;

  beforeEach(async () => {
    repoMock = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    agencyRepoMock = { findOne: jest.fn() };
    benRepoMock = { findOne: jest.fn() };
    caseRepoMock = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterAgencyReferralsService,
        { provide: getRepositoryToken(InterAgencyReferral), useValue: repoMock },
        { provide: getRepositoryToken(Agency), useValue: agencyRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(User), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    service = module.get<InterAgencyReferralsService>(InterAgencyReferralsService);
  });

  describe('issueEndorsementLetter', () => {
    it('rejects a caller that is neither agency-linked nor MSWDO staff', async () => {
      await expect(
        service.issueEndorsementLetter(
          'c1', { toAgencyId: 'ag-2', reason: 'x' },
          { id: 'u1', role: 'coordinator', agencyId: null } as any,
        ),
      ).rejects.toThrow('not linked to an agency');
      expect(agencyRepoMock.findOne).not.toHaveBeenCalled();
    });

    it('rejects an unknown target agency with 422', async () => {
      agencyRepoMock.findOne.mockResolvedValue(undefined);
      await expect(
        service.issueEndorsementLetter('c1', { toAgencyId: 'ag-nope', reason: 'x' }, agencyUser('u1', 'ag-ms')),
      ).rejects.toThrow('Unknown target agency');
    });

    it('rejects referring to your own agency', async () => {
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-me', name: 'Me' });
      await expect(
        service.issueEndorsementLetter('c1', { toAgencyId: 'ag-me', reason: 'x' }, agencyUser('u1', 'ag-me')),
      ).rejects.toThrow('Cannot refer to your own agency');
    });

    it('rejects a missing case and a case without a beneficiary person', async () => {
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-rhu', name: 'RHU' });
      caseRepoMock.findOne.mockResolvedValue(undefined);
      await expect(
        service.issueEndorsementLetter('c1', { toAgencyId: 'ag-rhu', reason: 'x' }, agencyUser('u1', 'ag-ms')),
      ).rejects.toThrow('Case not found');

      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: null });
      await expect(
        service.issueEndorsementLetter('c1', { toAgencyId: 'ag-rhu', reason: 'x' }, agencyUser('u1', 'ag-ms')),
      ).rejects.toThrow('no beneficiary person to refer');
    });

    it('records the referral and returns a letter PDF', async () => {
      agencyRepoMock.findOne.mockImplementation((opts: any) => {
        if (opts.where?.code === 'MSWDO') return Promise.resolve({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });
        return Promise.resolve({ id: 'ag-rhu', name: 'Rural Health Unit - Norzagaray' });
      });
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'b1' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1', personId: 'p1' });
      repoMock.create.mockImplementation((d: any) => d);
      repoMock.save.mockImplementation(async (d: any) => ({ id: 'r1', ...d }));
      repoMock.findOne.mockResolvedValue({
        id: 'r1', caseId: 'c1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
        reason: 'Medical coordination', notes: 'Bring philhealth id',
        person: { firstName: 'Juan', middleName: 'B.', surname: 'Dela Cruz' },
        toAgency: { name: 'Rural Health Unit - Norzagaray' },
        fromAgency: { name: 'MSWDO Norzagaray' },
        case: { controlNo: 'CASE-2026-0009', clientCategory: 'Indigent' },
        createdAt: new Date(),
      } as any);

      const actor = { id: 'u1', role: 'admin', fullName: 'Rosario Mendoza' } as any;
      const { referral, pdf } = await service.issueEndorsementLetter(
        'c1',
        { toAgencyId: 'ag-rhu', reason: 'Medical coordination', notes: 'Bring philhealth id' },
        actor,
      );

      expect(referral.caseId).toBe('c1');
      expect(referral.toAgencyId).toBe('ag-rhu');
      expect(referral.reason).toBe('Medical coordination');
      expect(referral.notes).toBe('Bring philhealth id');
      // The letter-only shape: no lifecycle columns are written anymore.
      const created = repoMock.create.mock.calls[0][0];
      expect(created).not.toHaveProperty('status');
      expect(created).not.toHaveProperty('legalBasisCode');
      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(1000);
    });
  });

  describe('endorsementLetterPdf', () => {
    const fullReferral = {
      id: 'r1',
      caseId: 'c1',
      fromAgencyId: 'ag-mswdo',
      toAgencyId: 'ag-rhu',
      reason: 'Medical coordination',
      notes: 'Bring philhealth id',
      person: { firstName: 'Juan', middleName: 'B.', surname: 'Dela Cruz' },
      toAgency: { name: 'Rural Health Unit - Norzagaray' },
      fromAgency: { name: 'MSWDO Norzagaray' },
      case: { controlNo: 'CASE-2026-0009', clientCategory: 'Indigent' },
      createdAt: new Date(),
    } as any;

    it('denies the letter for a referral outside the caller agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...fullReferral, fromAgencyId: 'ag-other', toAgencyId: 'ag-other' });
      await expect(
        service.endorsementLetterPdf('r1', { id: 'x', role: 'social_worker', agencyId: 'ag-rhu' } as any),
      ).rejects.toThrow('not associated with your agency');
    });

    it('renders the letter for the social worker who created it (unlinked MSWDO)', async () => {
      repoMock.findOne.mockResolvedValue({ ...fullReferral, createdBy: 'u-sw' });
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });

      const pdf = await service.endorsementLetterPdf('r1', {
        id: 'u-sw', role: UserRole.SW, agencyId: null, fullName: 'Ana Reyes',
      } as any);
      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('re-downloads the letter for an admin', async () => {
      repoMock.findOne.mockResolvedValue(fullReferral);
      agencyRepoMock.findOne.mockResolvedValue({ id: 'ag-mswdo', name: 'MSWDO Norzagaray' });
      const pdf = await service.endorsementLetterPdf('r1', { id: 'a1', role: UserRole.ADMIN } as any);
      expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });
  });

  describe('findForCase', () => {
    it('admin sees every referral of the case', async () => {
      repoMock.find.mockResolvedValue([{ id: 'r1' }]);
      const rows = await service.findForCase('c1', { id: 'a1', role: UserRole.ADMIN } as any);
      expect(rows).toHaveLength(1);
      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { caseId: 'c1' } }),
      );
    });

    it('a participating agency or the creator sees the case referrals', async () => {
      repoMock.find.mockResolvedValue([{ id: 'r1' }]);
      const rows = await service.findForCase('c1', agencyUser('u1', 'ag-rhu'));
      expect(rows).toHaveLength(1);
      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.arrayContaining([
          expect.objectContaining({ toAgencyId: 'ag-rhu' }),
          expect.objectContaining({ createdBy: 'u1' }),
        ]) }),
      );
    });

    it('an unlinked non-admin sees nothing', async () => {
      repoMock.find.mockResolvedValue([]);
      const rows = await service.findForCase('c1', { id: 'u1', role: 'agency_staff', agencyId: null } as any);
      expect(rows).toEqual([]);
      expect(repoMock.find).not.toHaveBeenCalled();
    });
  });

  describe('ensureReferralForIntervention', () => {
    it('creates the PAO referral once and reuses it on a later log', async () => {
      agencyRepoMock.findOne.mockImplementation(({ where }: any) => Promise.resolve(
        where.code === 'MSWDO' ? { id: 'ag-mswdo', name: 'MSWDO' }
          : where.code === 'PAO' ? { id: 'ag-pao', name: 'Public Attorney\'s Office' }
            : null,
      ));
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'b1' });
      benRepoMock.findOne.mockResolvedValue({ id: 'b1', personId: 'p1' });
      repoMock.findOne.mockResolvedValue(null);
      repoMock.create.mockImplementation((d: any) => d);
      repoMock.save.mockImplementation(async (d: any) => ({ id: 'r-pao', ...d }));

      const out = await service.ensureReferralForIntervention({
        caseId: 'c1', interventionType: 'referral_pao', serviceName: 'Referral to PAO', createdBy: 'u1',
      });

      expect(out).toMatchObject({
        caseId: 'c1', personId: 'p1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-pao',
        reason: 'Referral to PAO', createdBy: 'u1',
      });
      expect(repoMock.save).toHaveBeenCalledTimes(1);

      repoMock.findOne.mockResolvedValue({ id: 'r-pao' });
      const again = await service.ensureReferralForIntervention({
        caseId: 'c1', interventionType: 'referral_pao', serviceName: 'Referral to PAO', createdBy: 'u2',
      });
      expect(again?.id).toBe('r-pao');
      expect(repoMock.save).toHaveBeenCalledTimes(1);
    });

    it('ignores non-referral services', async () => {
      await expect(service.ensureReferralForIntervention({
        caseId: 'c1', interventionType: 'food_pack', serviceName: 'Food pack',
      })).resolves.toBeNull();
      expect(agencyRepoMock.findOne).not.toHaveBeenCalled();
    });
  });
});