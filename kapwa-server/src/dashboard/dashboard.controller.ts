import { Controller, Get, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CaseStatus } from '../cases/case.entity';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private dashService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard summary' })
  async getDashboard(@Request() req: any) {
    try {
      const userBarangay = req.user?.role === 'coordinator'
        ? req.user.assignedBarangay
        : undefined;
      const metrics = await this.dashService.getMetrics(userBarangay);
      const sla = await this.dashService.getSlaCompliance();

      let recentCasesRaw: any[] = [];
      try {
        recentCasesRaw = await this.dashService.getRecentCases(userBarangay);
      } catch (e: any) {
        this.logger.error('getRecentCases failed', e.message, e.stack);
      }

      return {
        servedToday: metrics.disbursedCases || 0,
        servedChange: '+0%',
        pendingReview: metrics.byStatus?.find((s: any) => s.status === CaseStatus.IN_REVIEW)?.count || 0,
        urgentCount: sla.overdueCount || 0,
        disbursedMonth: metrics.totalDisbursedAmount || 0,
        beneficiaryCount: metrics.uniqueHouseholds || 0,
        lastSync: '2m ago',
        recentCases: recentCasesRaw.map((c: any) => ({
          id: c.controlNo,
          name: `${c.beneficiary?.firstName || ''} ${c.beneficiary?.surname || ''}`.trim(),
          category: c.serviceRequested?.join(', ') || '',
          barangay: c.beneficiary?.address?.split(',').pop()?.trim() || '',
          remarks: c.remarks || '',
          date: c.updatedAt,
          status: c.status,
        })),
      };
    } catch (e: any) {
      this.logger.error('getDashboard failed', e.message, e.stack);
      throw e;
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get fund utilization metrics' })
  async getMetrics(@Request() req: any, @Query('barangay') barangay?: string) {
    const userBarangay = req.user.role === 'coordinator'
      ? req.user.assignedBarangay
      : barangay;
    return this.dashService.getMetrics(userBarangay);
  }

  @Get('daily-tracker')
  @ApiOperation({ summary: 'Get daily case tracker' })
  async getDailyTracker(@Query('date') date: string) {
    return this.dashService.getDailyTracker(new Date(date));
  }

  @Get('sla')
  @ApiOperation({ summary: 'Get SLA compliance status' })
  async getSlaCompliance() {
    return this.dashService.getSlaCompliance();
  }
}
