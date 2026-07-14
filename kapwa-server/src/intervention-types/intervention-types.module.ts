import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterventionTypeEntity } from './intervention-type.entity';
import { InterventionTypesService } from './intervention-types.service';
import { InterventionTypesController } from './intervention-types.controller';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([InterventionTypeEntity, ConsentLedger]), AuthModule],
  controllers: [InterventionTypesController],
  providers: [InterventionTypesService],
  exports: [InterventionTypesService],
})
export class InterventionTypesModule {}
