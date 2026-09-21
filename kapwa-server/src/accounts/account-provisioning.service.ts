import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../auth/user.entity';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { EmailService } from '../email/email.service';
import { SmsGatewayService } from '../otp/sms-gateway.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { BCRYPT_SALT_ROUNDS } from '../common/constants';

export interface ProvisionClaimantInput {
  claimantPersonId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  controlNo: string;
  email?: string;
  phone?: string;
  actorId?: string;
}

export interface ProvisionClaimantResult {
  created: boolean;
  userId?: string;
  emailDelivered: boolean;
  smsDelivered: boolean;
}

// Generates a readable temporary password (no ambiguous 0/O/1/l/I).
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Person) private personRepo: Repository<Person>,
    @InjectRepository(BeneficiaryClaimant) private claimantRepo: Repository<BeneficiaryClaimant>,
    private emailService: EmailService,
    private smsGateway: SmsGatewayService,
    private notifications: NotificationsService,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  // Best-effort: callers must not fail a committed intake on a delivery error.
  async provision(input: ProvisionClaimantInput): Promise<ProvisionClaimantResult> {
    const email = input.email?.trim().toLowerCase() || undefined;
    const phone = input.phone?.trim() || undefined;

    const person = await this.personRepo.findOne({ where: { id: input.claimantPersonId } });
    const fullName = person ? `${person.firstName ?? ''} ${person.surname ?? ''}`.trim() : '';

    const existing = await this.findExistingUser(email, phone);
    if (existing) {
      // A claimant may represent up to 2 beneficiaries: reuse the account and
      // only confirm the new enrollment — never resend credentials.
      if (!existing.personId) {
        existing.personId = input.claimantPersonId;
        await this.userRepo.save(existing);
      }
      const delivered = await this.deliverEnrollment(existing, input);
      await this.auditLog?.log('claimant.enrollment_notified', input.beneficiaryId, input.actorId, {
        userId: existing.id,
        controlNo: input.controlNo,
        emailDelivered: delivered.emailDelivered,
        smsDelivered: delivered.smsDelivered,
      });
      return { created: false, userId: existing.id, ...delivered };
    }

    // No login identity at all — cannot create an account.
    if (!email && !phone) {
      await this.flagStaff(input, 'Claimant has no email or phone; account not created.');
      return { created: false, emailDelivered: false, smsDelivered: false };
    }

    const tempPassword = generateTempPassword();
    const user = this.userRepo.create({
      email: email || `claimant-${phone}@claimant.kapwa.local`,
      password: await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS),
      role: UserRole.CLAIMANT,
      firstName: person?.firstName,
      middleName: person?.middleName,
      lastName: person?.surname,
      phone,
      personId: input.claimantPersonId,
      isActive: true,
      emailVerified: true,
      mustChangePassword: true,
    });
    const saved = await this.userRepo.save(user);

    const delivered = { emailDelivered: false, smsDelivered: false };
    if (email) {
      delivered.emailDelivered = await this.emailService
        .sendClaimantWelcomeEmail(email, { tempPassword, beneficiaryName: input.beneficiaryName, controlNo: input.controlNo })
        .catch(() => false);
    }
    if (phone) {
      const sms = await this.smsGateway
        .sendSms(
          phone,
          `KAPWA: account for ${input.beneficiaryName} (Case ${input.controlNo}) created. Email ${saved.email}. Temp password: ${tempPassword}. Change it after signing in.`,
        )
        .catch(() => ({ success: false }));
      delivered.smsDelivered = Boolean((sms as { success?: boolean })?.success);
    }

    if (!delivered.emailDelivered && !delivered.smsDelivered) {
      await this.flagStaff(input, `Claimant account ${saved.email} created but credentials could not be delivered.`, saved.id);
    }

    await this.auditLog?.log('claimant.account_created', input.beneficiaryId, input.actorId, {
      userId: saved.id,
      controlNo: input.controlNo,
      emailDelivered: delivered.emailDelivered,
      smsDelivered: delivered.smsDelivered,
    });

    return { created: true, userId: saved.id, ...delivered };
  }

  private async findExistingUser(email?: string, phone?: string): Promise<User | null> {
    if (email) {
      const byEmail = await this.userRepo.findOne({ where: { email } });
      if (byEmail) return byEmail;
    }
    if (phone) {
      const byPhone = await this.userRepo.findOne({ where: { phone } });
      if (byPhone) return byPhone;
    }
    return null;
  }

  private async deliverEnrollment(user: User, input: ProvisionClaimantInput) {
    const emailDelivered = user.email && !user.email.endsWith('@claimant.kapwa.local')
      ? await this.emailService
          .sendClaimantEnrollmentEmail(user.email, { beneficiaryName: input.beneficiaryName, controlNo: input.controlNo })
          .catch(() => false)
      : false;
    const smsDelivered = user.phone
      ? Boolean(
          (await this.smsGateway
            .sendSms(user.phone, `KAPWA: ${input.beneficiaryName} (Case ${input.controlNo}) enrolled and linked to your account.`)
            .catch(() => ({ success: false })) as { success?: boolean })?.success,
        )
      : false;
    return { emailDelivered, smsDelivered };
  }

  private async flagStaff(input: ProvisionClaimantInput, message: string, userId?: string) {
    await this.flagAdmins(`${message} Beneficiary: ${input.beneficiaryName} (Case ${input.controlNo}).`, userId);
  }

  // Delivery for staff/admin-provisioned accounts (no person or beneficiary
  // context): email + SMS the temporary password and force a reset.
  async deliverAccountCredentials(opts: {
    userId: string;
    email: string;
    phone?: string;
    fullName?: string;
    role: string;
    tempPassword: string;
    actorId?: string;
  }): Promise<{ emailDelivered: boolean; smsDelivered: boolean }> {
    const emailDelivered = await this.emailService
      .sendAccountWelcomeEmail(opts.email, { tempPassword: opts.tempPassword, fullName: opts.fullName, role: opts.role })
      .catch(() => false);

    let smsDelivered = false;
    if (opts.phone) {
      const sms = await this.smsGateway
        .sendSms(
          opts.phone,
          `KAPWA: your ${opts.role.replace(/_/g, ' ')} account is ready. Email ${opts.email}. Temp password: ${opts.tempPassword}. Change it after signing in.`,
        )
        .catch(() => ({ success: false }));
      smsDelivered = Boolean((sms as { success?: boolean })?.success);
    }

    if (!emailDelivered && !smsDelivered) {
      await this.flagAdmins(`Account ${opts.email} created but credentials could not be delivered.`, opts.userId);
    }

    await this.auditLog?.log('account.credentials_delivered', opts.userId, opts.actorId, {
      role: opts.role,
      emailDelivered,
      smsDelivered,
    });

    return { emailDelivered, smsDelivered };
  }

  private async flagAdmins(message: string, referenceId?: string) {
    const admins: Array<{ id: string }> = await this.userRepo.query(
      `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`,
    );
    if (!admins.length) {
      this.logger.warn(message);
      return;
    }
    await this.notifications.createMany(
      admins.map((a) => ({
        recipientId: a.id,
        title: 'Account needs attention',
        message,
        category: NotificationCategory.SYSTEM,
        channel: NotificationType.IN_APP,
        referenceId,
      })),
    );
  }
}
