import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { User } from './user.entity.js';
import { UserToken } from './user-token.entity.js';
import { UserBarangayAssignment } from './user-barangay-assignment.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { AbacService } from './services/abac.service.js';
import { OtpModule } from '../otp/otp.module.js';
import { EmailModule } from '../email/email.module.js';
import { PendingIntakesModule } from '../pending-intakes/pending-intakes.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserToken, UserBarangayAssignment, Person, Beneficiary]),
    PassportModule,
    OtpModule,
    EmailModule,
    PendingIntakesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AbacService],
  exports: [AuthService, AbacService],
})
export class AuthModule {}
