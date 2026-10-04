import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramEnrollment } from './program-enrollment.entity';
import { Program } from '../programs/program.entity';
import { CaseEnrollmentsService } from './case-enrollments.service';
import { CaseEnrollmentsController } from './case-enrollments.controller';
import { CasesModule } from '../cases/cases.module';

@Module({
  // `CasesModule` for the enrollments-step seal assertion, and `forwardRef`
  // because the edge runs both ways: `cases.module.ts` registers the
  // `ProgramEnrollment` *entity* in its `forFeature` (a registration, not an
  // import), while this module requires the cases module to reach the locks
  // service.
  imports: [TypeOrmModule.forFeature([ProgramEnrollment, Program]), forwardRef(() => CasesModule)],
  controllers: [CaseEnrollmentsController],
  providers: [CaseEnrollmentsService],
  exports: [CaseEnrollmentsService],
})
export class CaseEnrollmentsModule {}