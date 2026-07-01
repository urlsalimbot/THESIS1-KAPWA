import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SlaService } from './sla.service';

@ApiTags('SLA')
@Controller('sla')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SlaController {
  constructor(private slaService: SlaService) {}

  @Post('check')
  @Roles('admin')
  @ApiOperation({ summary: 'Run SLA compliance check and auto-escalate' })
  async runCheck() {
    return this.slaService.checkAndEscalate();
  }
}
