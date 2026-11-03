import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramEnrollment } from './program-enrollment.entity.js';
import { Program } from '../programs/program.entity.js';
import { Case } from '../cases/case.entity.js';
import { CaseEnrollmentsService } from './case-enrollments.service.js';
import { CaseEnrollmentsController } from './case-enrollments.controller.js';
import { CasesModule } from '../cases/cases.module.js';

@Module({
  // `CasesModule` for the enrollments-step seal assertion, and `forwardRef`
  // because the edge runs both ways: `cases.module.ts` registers the
  // `ProgramEnrollment` *entity* in its `forFeature` (a registration, not an
  // import), while this module requires the cases module to reach the locks
  // service.
  imports: [TypeOrmModule.forFeature([ProgramEnrollment, Program, Case]), forwardRef(() => CasesModule)],
  controllers: [CaseEnrollmentsController],
  providers: [CaseEnrollmentsService],
  exports: [CaseEnrollmentsService],
})
export class CaseEnrollmentsModule {}