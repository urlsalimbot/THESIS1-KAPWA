import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramsService } from './programs.service.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsPublicController } from './programs-public.controller.js';
import { Program } from './program.entity.js';
import { ProgramFundSource } from './program-fund-source.entity.js';
import { ProgramRequiredDocument } from './program-required-document.entity.js';
import { ProgramIntervention } from './program-intervention.entity.js';
import { FormVersionHistory } from './form-version-history.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Program, ProgramFundSource, ProgramRequiredDocument, ProgramIntervention, FormVersionHistory]),
  ],
  controllers: [ProgramsPublicController, ProgramsController],
  providers: [ProgramsService],
  exports: [TypeOrmModule],
})
export class ProgramsModule {}
