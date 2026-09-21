import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountProvisioningService } from './account-provisioning.service';
import { User } from '../auth/user.entity';
import { UserToken } from '../auth/user-token.entity';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { EmailModule } from '../email/email.module';
import { OtpModule } from '../otp/otp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserToken, Person, BeneficiaryClaimant]),
    EmailModule,
    OtpModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [AccountProvisioningService],
  exports: [AccountProvisioningService],
})
export class AccountsModule {}
