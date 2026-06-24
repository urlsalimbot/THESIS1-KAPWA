import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';
import { Program } from './program.entity';
import { FormVersionHistory } from './form-version-history.entity';
import { ProgramAssignment } from './program-assignment.entity';
import { ProgramAssignmentStep } from './program-assignment-step.entity';
import { ProgramAssignmentsController } from './program-assignments.controller';
import { ProgramAssignmentsService } from './program-assignments.service';
import { InterventionsModule } from '../interventions/interventions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Program, FormVersionHistory, ProgramAssignment, ProgramAssignmentStep]),
    InterventionsModule,
    NotificationsModule,
  ],
  controllers: [ProgramsController, ProgramAssignmentsController],
  providers: [ProgramsService, ProgramAssignmentsService],
  exports: [TypeOrmModule, ProgramAssignmentsService],
})
export class ProgramsModule {}
