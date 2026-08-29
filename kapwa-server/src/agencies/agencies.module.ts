import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { Agency } from './agency.entity';
import { AgencyContact } from './agency-contact.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Agency, AgencyContact]), AuthModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
