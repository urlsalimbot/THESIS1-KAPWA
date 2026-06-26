import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { CaseTrackerLog } from './tracker.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseTrackerLog, ConsentLedger]), AuthModule],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService],
})
export class TrackerModule {}
