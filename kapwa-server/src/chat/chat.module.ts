import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatMessage } from './chat.entity.js';
import { User } from '../auth/user.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { Case } from '../cases/case.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, User, Beneficiary, Case]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
