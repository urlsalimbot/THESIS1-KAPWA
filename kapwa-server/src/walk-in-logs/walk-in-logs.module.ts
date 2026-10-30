import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalkInLog } from './walk-in-log.entity';
import { WalkInLogsService } from './walk-in-logs.service';
import { WalkInLogsController } from './walk-in-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WalkInLog])],
  controllers: [WalkInLogsController],
  providers: [WalkInLogsService],
  exports: [WalkInLogsService],
})
export class WalkInLogsModule {}
