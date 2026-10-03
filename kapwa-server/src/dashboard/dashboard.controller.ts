import { Controller, Get, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { CaseStatus } from '../cases/case.entity';
import { AuthenticatedRequest } from '../auth/types';
import { SLA_OVERDUE_DAYS, RECENT_CASES_LIMIT } from '../common/constants';

/**
 * The window values the dashboard's range selector offers. The main dashboard
 * endpoint accepts only these — anything else falls back to no cutoff, so the
 * unfiltered numbers are preserved for callers that do not pass a range.
 */
const DASHBOARD_RANGES = ['1w', '1m', '3m', '6m'] as const;

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
  async getDashboard(@Request() req: AuthenticatedRequest, @Query('range') range?: string) {
    try {
      const userBarangay = req.user?.role === 'coordinator'
        ? req.user.assignedBarangay
        : undefined;
      // The range selector filters the dashboard's date-derived numbers. Only
      // the four known windows are accepted — anything else counts everything,
      // the behavior these endpoints had before the selector moved here.
      const createdAfter = DashboardService.rangeStart(DASHBOARD_RANGES.includes(range as never) ? range : undefined);
      const [metrics, sla, servedToday, lastSync] = await Promise.all([
        this.dashService.getMetrics(userBarangay, createdAfter),
        this.dashService.getSlaCompliance(userBarangay),
        this.dashService.getServedToday(),
        this.dashService.getLastSync(),
      ]);

      let recentCasesRaw: any[] = [];
      try {
        recentCasesRaw = await this.dashService.getRecentCases(userBarangay, 1, RECENT_CASES_LIMIT, createdAfter);
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
        activeCases: metrics.activeCases || 0,
        transitioningCases: metrics.transitioningCases || 0,
        recentInterventions: metrics.recentInterventions || 0,
        byStatus: metrics.byStatus || [],
        lastSync,
        recentCases: recentCasesRaw.map((c: any, i: number) => {
          const ben = c.beneficiary || {};
          const person = ben.person || {};
          const age = person.age || 0;
          const overdueStatuses = [CaseStatus.ENROLLED, CaseStatus.ASSESSED, CaseStatus.IN_REVIEW];
          const createdTime = new Date(c.createdAt).getTime();
          const slaOverdue = overdueStatuses.includes(c.status) && !isNaN(createdTime)
            && (Date.now() - createdTime) > SLA_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
          return {
            id: c.id,
            no: i + 1,
            name: [person.firstName, person.middleName, person.surname].filter(Boolean).join(' '),
            surname: person.surname || '',
            first: person.firstName || '',
            middle: person.middleName || '',
            gender: (person.gender || '').trim(),
            ageRange: age ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '',
            category: (c.clientCategory || '').trim(),
            status: c.status || 'enrolled',
            slaOverdue,
            barangay: (person.currentAddress?.barangay || '').trim() || (person.address || '').split(',').pop()?.trim() || '',
            remarks: c.remarks || '',
            date: c.updatedAt?.toISOString?.() ?? c.updatedAt ?? '',
            controlNo: c.controlNo || '',
            createdAt: c.createdAt?.toISOString?.() ?? c.createdAt ?? '',
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

  @Get('trends')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get case/disbursement trends for a range (1w | 1m | 3m | 6m)' })
  @ApiQuery({ name: 'range', required: false, enum: ['1w', '1m', '3m', '6m'] })
  async getTrends(@Query('range') range = '6m') {
    if (!['1w', '1m', '3m', '6m'].includes(range)) range = '6m';
    return this.dashService.getTrends(range);
  }

  @Get('daily-counts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get daily intervention/case counts for a month' })
  async getDailyCounts(@Query('year') year: string, @Query('month') month: string) {
    return this.dashService.getDailyCounts(parseInt(year), parseInt(month));
  }

  @Get('sla')
  @Roles('admin')
  @ApiOperation({ summary: 'Get SLA compliance status' })
  async getSlaCompliance() {
    return this.dashService.getSlaCompliance();
  }
}
