import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClientImportOperation, ClientImportRow, ClientImportMatch, BeneficiaryRemark } from './dedup.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { PersonAddress } from '../beneficiaries/person-address.entity.js';
import { DedupService, DEDUP_ADAPTER, DEDUP_OUTPUT_WRITER } from './dedup.service.js';
import { DedupController } from './dedup.controller.js';
import { RemarksController } from './remarks.controller.js';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service.js';
import { PgTrgmAdapter } from './dedup-adapter.js';
import { DedupOutputService } from './dedup-output.service.js';
import { DedupFinalizeWorker } from './dedup-finalize.worker.js';

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
    DedupFinalizeWorker,
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
