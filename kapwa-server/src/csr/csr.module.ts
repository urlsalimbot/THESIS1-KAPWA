import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsrController } from './csr.controller';
import { CsrService } from './csr.service';
import { CsrRecord } from './csr.entity';
import { Intervention } from '../interventions/intervention.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CsrRecord, Intervention])],
  controllers: [CsrController],
  providers: [CsrService],
  exports: [CsrService],
})
export class CsrModule {}
