import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Case } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { VersionVector } from '../sync/version-vector.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Beneficiary, VersionVector])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}