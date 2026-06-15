import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Case } from '../cases/case.entity';
import { Intervention } from '../interventions/intervention.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Intervention, Beneficiary])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}