import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { ClusteringService } from './clustering.service.js';
import { AnalyticsFeaturesService } from './analytics-features.service.js';
import { AnalysisRun } from './analysis-run.entity.js';
import { AnalysisRunCluster } from './analysis-run-cluster.entity.js';
import { AnalysisRunMember } from './analysis-run-member.entity.js';
import { Household } from '../beneficiaries/household.entity.js';
import { Case } from '../cases/case.entity.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisRun, AnalysisRunCluster, AnalysisRunMember, Household, Case]),
    AuditModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ClusteringService, AnalyticsFeaturesService],
  exports: [AnalyticsService, ClusteringService],
})
export class AnalyticsModule {}
