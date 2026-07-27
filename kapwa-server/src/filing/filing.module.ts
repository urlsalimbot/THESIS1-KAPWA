import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilingService } from './filing.service';
import { FilingController } from './filing.controller';
import { DocumentVault } from './filing.entity';
import { Case } from '../cases/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentVault, Case])],
  controllers: [FilingController],
  providers: [FilingService],
  exports: [FilingService],
})
export class FilingModule {}
