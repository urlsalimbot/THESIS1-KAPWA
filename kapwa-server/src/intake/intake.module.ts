import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { FamilyMember } from '../beneficiaries/family-member.entity';
import { Case } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Beneficiary, Household, FamilyMember, Case, ConsentLedger]),
    CasesModule,
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
