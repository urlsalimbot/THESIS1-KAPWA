import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrfController } from './irf.controller';
import { IrfService } from './irf.service';
import { IrfCase } from './irf-case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IrfCase])],
  controllers: [IrfController],
  providers: [IrfService],
  exports: [IrfService],
})
export class IrfModule {}
