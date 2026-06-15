import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterventionsService } from './interventions.service';
import { InterventionsController } from './interventions.controller';
import { Intervention } from './intervention.entity';
import { Case } from '../cases/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Intervention, Case])],
  controllers: [InterventionsController],
  providers: [InterventionsService],
  exports: [InterventionsService]
})
export class InterventionsModule {}