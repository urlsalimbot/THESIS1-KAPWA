import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';
import { Program } from './program.entity';
import { FormVersionHistory } from './form-version-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Program, FormVersionHistory]),
  ],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [TypeOrmModule],
})
export class ProgramsModule {}
