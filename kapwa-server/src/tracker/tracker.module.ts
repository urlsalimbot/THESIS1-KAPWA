import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { CaseTrackerLog } from './tracker.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CaseTrackerLog])],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService],
})
export class TrackerModule {}
