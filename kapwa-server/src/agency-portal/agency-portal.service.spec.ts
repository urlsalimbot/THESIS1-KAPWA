import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AgencyPortalService } from './agency-portal.service';
import { InterAgencyReferralsService } from '../inter-agency-referrals/inter-agency-referrals.service';
import { AgenciesService } from '../agencies/agencies.service';

function agencyUser(id: string, agencyId: string, role = 'agency_staff') {
  return { id, role, agencyId } as any;
}

describe('AgencyPortalService', () => {
  let service: AgencyPortalService;
  let referralsMock: any;
  let agenciesMock: any;

  beforeEach(async () => {
    referralsMock = { findInbox: jest.fn() };
    agenciesMock = { findById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgencyPortalService,
        { provide: InterAgencyReferralsService, useValue: referralsMock },
        { provide: AgenciesService, useValue: agenciesMock },
      ],
    }).compile();
    service = module.get<AgencyPortalService>(AgencyPortalService);
  });

  const ref = (id: string, from: string, to: string, status: string) => ({
    id, fromAgencyId: from, toAgencyId: to, status,
  });

  describe('getDashboard', () => {
    it('returns agency info + counts scoped to the caller agency', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
      referralsMock.findInbox.mockResolvedValue([
        ref('r1', 'ag-mswdo', 'ag-rhu', 'referred'),
        ref('r2', 'ag-mswdo', 'ag-rhu', 'referred'),
        ref('r3', 'ag-mswdo', 'ag-rhu', 'closed'),
        ref('r4', 'ag-rhu', 'ag-deped', 'received'),
        ref('r5', 'ag-rhu', 'ag-deped', 'declined'),
      ]);

      const result = await service.getDashboard(agencyUser('u1', 'ag-rhu'));

      expect(agenciesMock.findById).toHaveBeenCalledWith('ag-rhu');
      expect(referralsMock.findInbox).toHaveBeenCalledWith(agencyUser('u1', 'ag-rhu'));
      expect(result.agency.code).toBe('RHU');
      expect(result.counts).toEqual({
        total: 5,
        sent: 2,
        received: 3,
        byStatus: { referred: 2, received: 1, actioned: 0, closed: 1, declined: 1 },
      });
      expect(result.recent.length).toBe(5);
    });

    it('caps recent at 5', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU' });
      referralsMock.findInbox.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ref(`r${i}`, 'ag-mswdo', 'ag-rhu', 'referred')),
      );
      const result = await service.getDashboard(agencyUser('u1', 'ag-rhu'));
      expect(result.recent.length).toBe(5);
    });

    it('throws 403 when caller has no agencyId', async () => {
      await expect(service.getDashboard(agencyUser('u1', ''))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProfile', () => {
    it('returns the caller agency', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
      const result = await service.getProfile(agencyUser('u1', 'ag-rhu'));
      expect(result).toEqual({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
    });

    it('throws 403 when caller has no agencyId', async () => {
      await expect(service.getProfile(agencyUser('u1', ''))).rejects.toThrow(ForbiddenException);
    });
  });
});
