import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { LcrService } from './lcr.service';
import { LcrController } from './lcr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary])],
  controllers: [LcrController],
  providers: [LcrService],
  exports: [LcrService],
})
export class LcrModule {}
