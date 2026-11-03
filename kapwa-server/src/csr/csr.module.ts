import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsrController } from './csr.controller.js';
import { CsrService } from './csr.service.js';
import { CsrRecord } from './csr.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CsrRecord])],
  controllers: [CsrController],
  providers: [CsrService],
  exports: [CsrService],
})
export class CsrModule {}
