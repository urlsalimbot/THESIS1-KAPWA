import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../cases/case.entity.js';
import { Notification } from '../notifications/notification.entity.js';
import { SlaService } from './sla.service.js';
import { SlaController } from './sla.controller.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Case, Notification])
  ],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
