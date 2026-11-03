import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountProvisioningService } from './account-provisioning.service.js';
import { User } from '../auth/user.entity.js';
import { UserToken } from '../auth/user-token.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity.js';
import { EmailModule } from '../email/email.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserToken, Person, Beneficiary, BeneficiaryClaimant]),
    EmailModule,
    OtpModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [AccountProvisioningService],
  exports: [AccountProvisioningService],
})
export class AccountsModule {}
