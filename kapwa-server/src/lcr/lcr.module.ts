import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { LcrService } from './lcr.service.js';
import { LcrController } from './lcr.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary, Person])],
  controllers: [LcrController],
  providers: [LcrService],
  exports: [LcrService],
})
export class LcrModule {}
