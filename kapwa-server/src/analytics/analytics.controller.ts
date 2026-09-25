import { Controller, Get, Post, Param, Query, Body, Res, Request, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';
import {
  AnalyticsRangeSchema, AnalyticsRangeInput,
  ClusteringRunSchema, ClusteringRunInput,
  RunMembersQuerySchema, RunMembersQueryInput,
  RunListQuerySchema, RunListQueryInput,
} from './dto/analytics.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private analytics: AnalyticsService,
    private clustering: ClusteringService,
  ) {}

  @Get('demographics')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Demographic analysis for a date range and barangay' })
  async demographics(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getDemographics(query);
  }

  @Get('concentration')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Geographic concentration of cases and assistance (HHI)' })
  async concentration(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getConcentration(query);
  }

  @Get('equity')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Barangay equity and coverage ratios' })
  async equity(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getEquity(query);
  }

  @Post('clustering/runs')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Run household k-means clustering and persist the run' })
  async createRun(
    @Body(new ZodPipe(ClusteringRunSchema)) body: ClusteringRunInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.clustering.createRun(body, req.user?.id);
  }

  @Get('clustering/runs')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'List clustering runs (newest first)' })
  async listRuns(@Query(new ZodPipe(RunListQuerySchema)) query: RunListQueryInput) {
    return this.clustering.listRuns(query.limit);
  }

  @Get('clustering/runs/:id')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Get a clustering run with cluster profiles' })
  async getRun(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clustering.getRun(id);
  }

  @Get('clustering/runs/:id/members')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Paged household drill-down for a cluster (audited)' })
  async runMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodPipe(RunMembersQuerySchema)) query: RunMembersQueryInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.clustering.getRunMembers(id, query.clusterIndex, query.page, query.limit, req.user?.id);
  }

  @Get('clustering/runs/:id/export')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Export a run summary as an aggregate CSV' })
  async exportCsv(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: any) {
    const { buffer, filename } = await this.clustering.exportRunCsv(id);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
