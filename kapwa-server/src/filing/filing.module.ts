import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilingService } from './filing.service';
import { FilingController } from './filing.controller';
import { DocumentVault } from './filing.entity';
import { Case } from '../cases/case.entity';
import { CasesModule } from '../cases/cases.module';

@Module({
  // `CasesModule` for the step-1 seal assertion on the requirement write routes.
  // `forwardRef` because the edge runs both ways: `cases.module.ts` imports this
  // module for `CasesExportService`'s `FilingService`. Only the seal service is
  // asked for, so the exposure is the one guard.
  imports: [TypeOrmModule.forFeature([DocumentVault, Case]), forwardRef(() => CasesModule)],
  controllers: [FilingController],
  providers: [FilingService],
  exports: [FilingService],
})
export class FilingModule {}
