import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case } from '../cases/case.entity';
import { AuditModule } from '../audit/audit.module';

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
