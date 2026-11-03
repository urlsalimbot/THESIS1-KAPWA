import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingIntake } from './pending-intake.entity.js';
import { PendingIntakesService } from './pending-intakes.service.js';
import { PendingIntakesController } from './pending-intakes.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([PendingIntake])],
  controllers: [PendingIntakesController],
  providers: [PendingIntakesService],
  exports: [PendingIntakesService],
})
export class PendingIntakesModule {}
