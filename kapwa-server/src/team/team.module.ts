import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { OfficeEvent } from './office-event.entity';
import { TeamStatus } from './team-status.entity';

// Team workspace: schedule blocks, office events, whereabouts status.
// Services + controllers land in later tasks; this module only registers the
// entities so repositories are injectable.
@Module({
  imports: [TypeOrmModule.forFeature([TeamScheduleBlock, OfficeEvent, TeamStatus])],
})
export class TeamModule {}