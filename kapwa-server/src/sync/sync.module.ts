import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';
import { ConflictResolver } from './conflict-resolver';
import { IntakeModule } from '../intake/intake.module';
import { AuthModule } from '../auth/auth.module';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncQueue, VersionVector, ConsentLedger]),
    IntakeModule,
    AuthModule,
    // `CaseStepLocksService`, so a `case_requirements` replay is weighed
    // against the step-1 seal through the same guard the HTTP routes use.
    // `IntakeModule` already imports this module, so the edge is not new and no
    // `forwardRef` is needed: the dependency only runs one way.
    CasesModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, ConflictResolver],
  exports: [SyncService],
})
export class SyncModule {}
