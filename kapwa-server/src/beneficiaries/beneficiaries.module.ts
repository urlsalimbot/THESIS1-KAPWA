import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';
import { Beneficiary } from './beneficiary.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { FamilyMember } from './family-member.entity';
import { ConsentGuard } from '../auth/guards/consent.guard';
import { PiiMaskingInterceptor } from './pii.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary, ConsentLedger, FamilyMember])],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, ConsentGuard, PiiMaskingInterceptor],
  exports: [BeneficiariesService, PiiMaskingInterceptor, TypeOrmModule.forFeature([ConsentLedger])],
})
export class BeneficiariesModule {}
