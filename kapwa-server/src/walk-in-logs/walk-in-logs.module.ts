import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalkInLog } from './walk-in-log.entity.js';
import { WalkInLogsService } from './walk-in-logs.service.js';
import { WalkInLogsController } from './walk-in-logs.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([WalkInLog])],
  controllers: [WalkInLogsController],
  providers: [WalkInLogsService],
  exports: [WalkInLogsService],
})
export class WalkInLogsModule {}
