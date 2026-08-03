import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { AgencyPortalService } from './agency-portal.service';

@ApiTags('Agency Portal')
@Controller('agency-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgencyPortalController {
  constructor(private readonly svc: AgencyPortalService) {}

  @Get('dashboard')
  @Roles('agency_staff', 'admin')
  @ApiOperation({ summary: 'Agency dashboard: referral counts + recent' })
  async dashboard(@Request() req: AuthenticatedRequest) {
    return this.svc.getDashboard(req.user);
  }

  @Get('profile')
  @Roles('agency_staff', 'admin')
  @ApiOperation({ summary: 'The caller agency profile' })
  async profile(@Request() req: AuthenticatedRequest) {
    return this.svc.getProfile(req.user);
  }
}
