import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardService } from './access-card-service.entity';
import { AuthModule } from '../auth/auth.module';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccessCardService, ConsentLedger]), AuthModule],
  controllers: [AccessCardsController],
  providers: [AccessCardsService],
  exports: [AccessCardsService],
})
export class AccessCardsModule {}
