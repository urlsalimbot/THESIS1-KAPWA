import { Controller, Get, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { CaseStatus } from '../cases/case.entity';
import { AuthenticatedRequest } from '../auth/types';
import { SLA_OVERDUE_DAYS } from './constants';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private dashService: DashboardService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get dashboard summary' })
  async getDashboard(@Request() req: AuthenticatedRequest) {
    try {
      const userBarangay = req.user?.role === 'coordinator'
        ? req.user.assignedBarangay
        : undefined;
      const [metrics, sla, servedToday, lastSync] = await Promise.all([
        this.dashService.getMetrics(userBarangay),
        this.dashService.getSlaCompliance(),
        this.dashService.getServedToday(),
        this.dashService.getLastSync(),
      ]);

      let recentCasesRaw: any[] = [];
      try {
        recentCasesRaw = await this.dashService.getRecentCases(userBarangay);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const errStack = e instanceof Error ? e.stack : '';
        this.logger.error('getRecentCases failed', errMsg, errStack);
      }

      return {
        servedToday,
        servedChange: '+0%',
        pendingReview: metrics.byStatus?.find((s: any) => s.status === CaseStatus.IN_REVIEW)?.count || 0,
        urgentCount: sla.overdueCount || 0,
        disbursedMonth: metrics.totalDisbursedAmount || 0,
        beneficiaryCount: metrics.uniqueHouseholds || 0,
        totalCases: metrics.totalCases || 0,
        approvedCases: metrics.approvedCases || 0,
        disbursedCases: metrics.disbursedCases || 0,
        recentInterventions: metrics.recentInterventions || 0,
        byStatus: metrics.byStatus || [],
        lastSync,
        recentCases: recentCasesRaw.map((c: any, i: number) => {
          const ben = c.beneficiary || {};
          const age = ben.age || 0;
          const createdAt = c.createdAt?.toISOString?.() ?? c.createdAt ?? '';
          const updatedAt = c.updatedAt?.toISOString?.() ?? c.updatedAt ?? '';
          const overdueStatuses = [CaseStatus.PENDING, CaseStatus.IN_REVIEW];
          const createdTime = new Date(createdAt).getTime();
          const slaOverdue = overdueStatuses.includes(c.status) && !isNaN(createdTime)
            && (Date.now() - createdTime) > SLA_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
          return {
            id: c.id,
            no: i + 1,
            surname: ben.surname || '',
            first: ben.firstName || '',
            middle: ben.middleName || '',
            gender: (ben.gender || '').trim(),
            ageRange: age ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '',
            category: (c.serviceRequested ?? []).join(', '),
            status: c.status || 'pending_assessment',
            slaOverdue,
            barangay: (ben.address || '').split(',').pop()?.trim() || '',
            remarks: c.remarks || '',
            date: updatedAt,
            controlNo: c.controlNo || '',
            createdAt,
          };
        }),
      };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.logger.error('getDashboard failed', errMsg);
      throw e;
    }
  }

  @Get('metrics')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get fund utilization metrics' })
  async getMetrics(@Request() req: AuthenticatedRequest, @Query('barangay') barangay?: string) {
    const userBarangay = req.user.role === 'coordinator'
      ? req.user.assignedBarangay
      : barangay;
    return this.dashService.getMetrics(userBarangay);
  }

    @Get('reports/mayor')
  @Roles('mayor')
  @ApiOperation({ summary: 'Mayor aggregate reports - zero PII' })
  async getMayorReports(@Request() req: AuthenticatedRequest) {
    const metrics = await this.dashService.getMetrics();
    const sla = await this.dashService.getSlaCompliance();
    const servedToday = await this.dashService.getServedToday();
    return {
      fundUtilization: metrics.totalDisbursedAmount,
      uniqueHouseholds: metrics.uniqueHouseholds,
      caseStatusDistribution: metrics.byStatus,
      totalCases: metrics.totalCases,
      slaCompliance: sla,
      servedToday,
    };
  }

  @Get('trends')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get monthly case/disbursement trends for past 6 months' })
  async getTrends() {
    return this.dashService.getTrends();
  }

  @Get('daily-counts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get daily intervention/case counts for a month' })
  async getDailyCounts(@Query('year') year: string, @Query('month') month: string) {
    return this.dashService.getDailyCounts(parseInt(year), parseInt(month));
  }

  @Get('daily-tracker')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get daily case tracker' })
  async getDailyTracker(@Query('date') date: string) {
    return this.dashService.getDailyTracker(new Date(date));
  }

  @Get('sla')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Get SLA compliance status' })
  async getSlaCompliance() {
    return this.dashService.getSlaCompliance();
  }
}
