import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../auth/user.entity';
import { UserToken } from '../auth/user-token.entity';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
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

const SETUP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// A password nobody knows: the account is only usable after the one-time
// set-password link is consumed. Never sent to the user.
function unusablePassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserToken) private tokenRepo: Repository<UserToken>,
    @InjectRepository(Person) private personRepo: Repository<Person>,
    @InjectRepository(Beneficiary) private beneficiaryRepo: Repository<Beneficiary>,
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
      // only confirm the new enrollment — never resend setup credentials.
      if (!existing.personId) {
        existing.personId = input.claimantPersonId;
        await this.userRepo.save(existing);
      }
      await this.linkBeneficiary(input.beneficiaryId, existing.id);
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

    const user = this.userRepo.create({
      email: email || `claimant-${phone}@claimant.kapwa.local`,
      password: await bcrypt.hash(unusablePassword(), BCRYPT_SALT_ROUNDS),
      role: UserRole.CLAIMANT,
      firstName: person?.firstName,
      middleName: person?.middleName,
      lastName: person?.surname,
      phone,
      personId: input.claimantPersonId,
      isActive: true,
      emailVerified: true,
    });
    const saved = await this.userRepo.save(user);

    await this.linkBeneficiary(input.beneficiaryId, saved.id);

    const delivered = await this.deliverSetupLink({
      userId: saved.id,
      email: saved.email,
      phone,
      fullName,
      role: UserRole.CLAIMANT,
      beneficiaryName: input.beneficiaryName,
      controlNo: input.controlNo,
      actorId: input.actorId,
      syntheticEmail: !email,
    });

    if (!delivered.emailDelivered && !delivered.smsDelivered) {
      await this.flagStaff(input, `Claimant account ${saved.email} created but the setup link could not be delivered.`, saved.id);
    }

    await this.auditLog?.log('claimant.account_created', input.beneficiaryId, input.actorId, {
      userId: saved.id,
      controlNo: input.controlNo,
      emailDelivered: delivered.emailDelivered,
      smsDelivered: delivered.smsDelivered,
    });

    return { created: true, userId: saved.id, ...delivered };
  }

  // Shared delivery for staff/admin-provisioned accounts (no person or
  // beneficiary context): email + SMS a one-time set-password link.
  async deliverAccountCredentials(opts: {
    userId: string;
    email: string;
    phone?: string;
    fullName?: string;
    role: string;
    actorId?: string;
  }): Promise<{ emailDelivered: boolean; smsDelivered: boolean }> {
    const delivered = await this.deliverSetupLink({
      userId: opts.userId,
      email: opts.email,
      phone: opts.phone,
      fullName: opts.fullName,
      role: opts.role,
      actorId: opts.actorId,
      syntheticEmail: false,
    });

    if (!delivered.emailDelivered && !delivered.smsDelivered) {
      await this.flagAdmins(`Account ${opts.email} created but the setup link could not be delivered.`, opts.userId);
    }

    return delivered;
  }

  // Issues a single-use password_reset token (consumed by POST
  // /auth/reset-password) and delivers the link over email and/or SMS.
  private async deliverSetupLink(opts: {
    userId: string;
    email: string;
    phone?: string;
    fullName?: string;
    role: string;
    beneficiaryName?: string;
    controlNo?: string;
    actorId?: string;
    syntheticEmail: boolean;
  }): Promise<{ emailDelivered: boolean; smsDelivered: boolean }> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: opts.userId,
        purpose: 'password_reset',
        token,
        expiresAt: new Date(Date.now() + SETUP_LINK_TTL_MS),
      }),
    );
    const link = `${this.emailService.getAppBaseUrl()}/reset-password?token=${token}`;

    const emailDelivered = opts.syntheticEmail
      ? false
      : await this.emailService
          .sendAccountSetupEmail(opts.email, { link, fullName: opts.fullName, role: opts.role, beneficiaryName: opts.beneficiaryName, controlNo: opts.controlNo })
          .catch(() => false);

    let smsDelivered = false;
    if (opts.phone) {
      const sms = await this.smsGateway
        .sendSms(opts.phone, `KAPWA: set up your account. Choose your password here (valid 7 days): ${link}`)
        .catch(() => ({ success: false }));
      smsDelivered = Boolean((sms as { success?: boolean })?.success);
    }

    await this.auditLog?.log('account.setup_link_issued', opts.userId, opts.actorId, {
      role: opts.role,
      emailDelivered,
      smsDelivered,
    });

    return { emailDelivered, smsDelivered };
  }

  // beneficiaries.user_id is how the claimant /me/* lookups resolve their
  // record. Stamp only the first beneficiary a claimant is linked to, so a
  // claimant representing a 2nd beneficiary does not hijack the lookup; the
  // resolver in BeneficiariesService falls back to beneficiary_claimants.
  private async linkBeneficiary(beneficiaryId: string, userId: string): Promise<void> {
    const already = await this.beneficiaryRepo.findOne({ where: { userId } });
    if (already) return;
    await this.beneficiaryRepo.update({ id: beneficiaryId }, { userId });
  }

  private async findExistingUser(email?: string, phone?: string): Promise<User | null> {    if (email) {
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
