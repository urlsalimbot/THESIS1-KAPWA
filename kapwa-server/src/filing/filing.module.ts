import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilingService } from './filing.service';
import { FilingController } from './filing.controller';
import { DocumentVault } from './filing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentVault])],
  controllers: [FilingController],
  providers: [FilingService],
  exports: [FilingService],
})
export class FilingModule {}
