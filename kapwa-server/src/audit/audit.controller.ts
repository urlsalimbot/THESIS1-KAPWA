import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('hash-chain')
  @ApiOperation({ summary: 'Verify SHA-256 hash chain' })
  async verifyHashChain(@Query('startId') startId?: string) {
    return this.auditService.verifyHashChain(startId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs' })
  async getLogs(
    @Query('table') table: string,
    @Query('recordId') recordId: string,
    @Query('limit') limit?: number
  ) {
    return this.auditService.getAuditLog(table, recordId, limit);
  }

  @Get('coa-export')
  @ApiOperation({ summary: 'Export for COA' })
  async exportForCoa(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.auditService.exportForCoa(new Date(startDate), new Date(endDate));
  }
}