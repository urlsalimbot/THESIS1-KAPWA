import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingIntake } from './pending-intake.entity';
import { PendingIntakesService } from './pending-intakes.service';
import { PendingIntakesController } from './pending-intakes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PendingIntake])],
  controllers: [PendingIntakesController],
  providers: [PendingIntakesService],
  exports: [PendingIntakesService],
})
export class PendingIntakesModule {}
