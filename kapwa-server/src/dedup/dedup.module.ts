import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark } from './dedup.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';
import { DedupService, DEDUP_ADAPTER, DEDUP_OUTPUT_WRITER } from './dedup.service';
import { DedupController } from './dedup.controller';
import { RemarksController } from './remarks.controller';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service';
import { PgTrgmAdapter } from './dedup-adapter';
import { DedupOutputService } from './dedup-output.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark,
      Person, Beneficiary, PersonAddress,
    ]),
  ],
  controllers: [DedupController, RemarksController],
  providers: [
    DedupService,
    BeneficiaryRemarksService,
    {
      provide: DEDUP_ADAPTER,
      useFactory: (dataSource: DataSource) => new PgTrgmAdapter(dataSource),
      inject: [DataSource],
    },
    { provide: DEDUP_OUTPUT_WRITER, useClass: DedupOutputService },
  ],
  exports: [DedupService, BeneficiaryRemarksService],
})
export class DedupModule {}
