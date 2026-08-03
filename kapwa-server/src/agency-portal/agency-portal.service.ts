import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Agency } from '../agencies/agency.entity';
import { AgenciesService } from '../agencies/agencies.service';
import { User } from '../auth/user.entity';
import { InterAgencyReferralsService } from '../inter-agency-referrals/inter-agency-referrals.service';

@Injectable()
export class AgencyPortalService {
  constructor(
    private referralsService: InterAgencyReferralsService,
    private agenciesService: AgenciesService,
  ) {}

  async getDashboard(caller: User) {
    const agencyId = this.requireAgencyId(caller);
    const [agency, referrals] = await Promise.all([
      this.agenciesService.findById(agencyId),
      this.referralsService.findInbox(caller),
    ]);
    if (!agency) {
      throw new NotFoundException('Agency not found');
    }
    const counts = {
      total: referrals.length,
      sent: referrals.filter(r => r.fromAgencyId === agencyId).length,
      received: referrals.filter(r => r.toAgencyId === agencyId).length,
      byStatus: {
        referred: referrals.filter(r => r.status === 'referred').length,
        received: referrals.filter(r => r.status === 'received').length,
        actioned: referrals.filter(r => r.status === 'actioned').length,
        closed: referrals.filter(r => r.status === 'closed').length,
        declined: referrals.filter(r => r.status === 'declined').length,
      },
    };
    return { agency, counts, recent: referrals.slice(0, 5) };
  }

  async getProfile(caller: User): Promise<Agency | null> {
    const agencyId = this.requireAgencyId(caller);
    return this.agenciesService.findById(agencyId);
  }

  private requireAgencyId(caller: User): string {
    if (!caller.agencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    return caller.agencyId;
  }
}
