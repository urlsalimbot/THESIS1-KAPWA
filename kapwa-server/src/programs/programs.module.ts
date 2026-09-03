import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';
import { ProgramsPublicController } from './programs-public.controller';
import { Program } from './program.entity';
import { ProgramFundSource } from './program-fund-source.entity';
import { ProgramRequiredDocument } from './program-required-document.entity';
import { FormVersionHistory } from './form-version-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Program, ProgramFundSource, ProgramRequiredDocument, FormVersionHistory]),
  ],
  controllers: [ProgramsController, ProgramsPublicController],
  providers: [ProgramsService],
  exports: [TypeOrmModule],
})
export class ProgramsModule {}
