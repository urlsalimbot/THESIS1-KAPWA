import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterventionsService } from './interventions.service';
import { InterventionsController } from './interventions.controller';
import { Intervention } from './intervention.entity';
import { Case } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { MinioModule } from '../minio/minio.module';
import { TrackerModule } from '../tracker/tracker.module';

@Module({
  imports: [TypeOrmModule.forFeature([Intervention, Case, ConsentLedger]), MinioModule, TrackerModule],
  controllers: [InterventionsController],
  providers: [InterventionsService],
  exports: [InterventionsService]
})
export class InterventionsModule {}
