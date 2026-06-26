import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('hash-chain')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Verify SHA-256 hash chain for interventions' })
  async verifyHashChain(@Query('startId') startId?: string) {
    return this.auditService.verifyInterventionChain(startId);
  }

  @Get('verify-all')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Verify hash chain integrity across all audit tables' })
  async verifyAllChains() {
    return this.auditService.verifyAllChains();
  }

  @Get('logs')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Get audit logs' })
  async getLogs(
    @Query('table') table: string,
    @Query('recordId') recordId: string,
    @Query('limit') limit?: number
  ) {
    return this.auditService.getAuditLog(table, recordId, limit);
  }

    @Get('consent-ledger')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Read consent ledger (auditor read-only)' })
  async getConsentLedger(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.auditService.getConsentLedger(beneficiaryId, limitNum);
  }

  @Get('coa-export')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Export for COA' })
  async exportForCoa(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.auditService.exportForCoa(new Date(startDate), new Date(endDate));
  }
}
