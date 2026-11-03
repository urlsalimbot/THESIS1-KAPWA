import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { Case } from '../cases/case.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { VersionVector } from '../sync/version-vector.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Beneficiary, VersionVector])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}