import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private config: ConfigService,
    @Optional() private cb?: CircuitBreakerService,
  ) {
    const host = this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('EMAIL_USER');
    if (host && user) {
      const port = parseInt(this.config.get<string>('EMAIL_PORT', '587'), 10) || 587;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass: this.config.get<string>('EMAIL_PASS', ''),
        },
      });
      // Verify SMTP connectivity at boot so a misconfiguration surfaces
      // immediately instead of silently failing every send later.
      this.transporter
        .verify()
        .then(() => this.logger.log('SMTP transporter verified — email delivery enabled'))
        .catch((err) =>
          this.logger.error(`SMTP transporter verification FAILED — emails will fail to deliver: ${err?.message ?? err}`),
        );
    } else {
      this.logger.warn('EMAIL_HOST/EMAIL_USER not set — emails will be logged only (NOT delivered)');
    }
  }

  private from(): string {
    return this.config.get<string>('EMAIL_FROM', 'KAPWA MSWDO <noreply@mswdo.gov>');
  }

  private appUrl(): string {
    return this.config.get<string>('APP_URL', 'http://localhost:5173');
  }

  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/verify-email?token=${token}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Welcome to KAPWA</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, 'Verify your KAPWA account', html);
  }

  async sendForgotPasswordEmail(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/reset-password?token=${token}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Reset Your Password</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
    return this.sendWithBreaker(to, 'Reset your KAPWA password', html);
  }

  async sendEmailChangeVerification(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/verify-email?token=${token}&change=true`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Confirm Email Change</h2>
        <p>Click the link below to confirm your new email address:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Confirm Email</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
    return this.sendWithBreaker(to, 'Confirm your new email for KAPWA', html);
  }

  async sendNotificationEmail(to: string, subject: string, body: string): Promise<boolean> {
    const safeSubject = escapeHtml(subject);
    const safeBody = escapeHtml(body);
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">${safeSubject}</h2>
        <p>${safeBody}</p>
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, safeSubject, html);
  }

  // Claimant account provisioned by staff on intake: temporary password plus
  // first-login instructions. The account is flagged must_change_password, so
  // the client forces a change before any other route is reachable.
  async sendClaimantWelcomeEmail(
    to: string,
    opts: { tempPassword: string; beneficiaryName: string; controlNo: string },
  ): Promise<boolean> {
    const loginUrl = `${this.appUrl()}/login`;
    const safePassword = escapeHtml(opts.tempPassword);
    const safeName = escapeHtml(opts.beneficiaryName);
    const safeControl = escapeHtml(opts.controlNo);
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Your KAPWA claimant account</h2>
        <p>An account was created for you as the claimant of <strong>${safeName}</strong> (Case ${safeControl}).</p>
        <p><strong>Email:</strong> ${escapeHtml(to)}<br/><strong>Temporary password:</strong> <code>${safePassword}</code></p>
        <p>Sign in and change this password immediately — the system will require it before you can use any other page.</p>
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Sign in to KAPWA</a>
        <p style="margin-top:24px;font-size:13px;color:#666">If you did not expect this account, contact MSWDO Norzagaray.</p>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, 'Your KAPWA claimant account', html);
  }

  // Existing claimant account linked to a newly enrolled beneficiary: no
  // credentials, just confirmation that the enrollment succeeded.
  async sendClaimantEnrollmentEmail(
    to: string,
    opts: { beneficiaryName: string; controlNo: string },
  ): Promise<boolean> {
    const safeName = escapeHtml(opts.beneficiaryName);
    const safeControl = escapeHtml(opts.controlNo);
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Enrollment confirmed</h2>
        <p><strong>${safeName}</strong> has been successfully enrolled (Case ${safeControl}) and linked to your KAPWA claimant account.</p>
        <p>Sign in to view the case status and access card.</p>
        <a href="${this.appUrl()}/login" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Sign in to KAPWA</a>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, 'KAPWA enrollment confirmed', html);
  }

  // Staff/admin-provisioned account: temporary password + forced reset note.
  async sendAccountWelcomeEmail(
    to: string,
    opts: { tempPassword: string; fullName?: string; role: string },
  ): Promise<boolean> {
    const loginUrl = `${this.appUrl()}/login`;
    const safePassword = escapeHtml(opts.tempPassword);
    const safeName = escapeHtml(opts.fullName || to);
    const safeRole = escapeHtml(opts.role.replace(/_/g, ' '));
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Your KAPWA account</h2>
        <p>An account was created for <strong>${safeName}</strong> with the role <strong>${safeRole}</strong>.</p>
        <p><strong>Email:</strong> ${escapeHtml(to)}<br/><strong>Temporary password:</strong> <code>${safePassword}</code></p>
        <p>Sign in and change this password immediately — the system will require it before you can use any other page.</p>
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Sign in to KAPWA</a>
        <p style="margin-top:24px;font-size:13px;color:#666">If you did not expect this account, contact MSWDO Norzagaray.</p>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, 'Your KAPWA account', html);
  }

  async sendOtpEmail(to: string, code: string): Promise<boolean> {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Verify Your Account</h2>
        <p>Use the code below to link your account:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f5f7fa;border-radius:8px;margin:16px 0">${escapeHtml(code)}</div>
        <p style="font-size:13px;color:#666">This code expires in 5 minutes.</p>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    return this.sendWithBreaker(to, 'Your KAPWA verification code', html);
  }

  // Returns true when the email was handed to an SMTP transporter, false when
  // the send failed, and true (log-only) when no transporter is configured —
  // callers can then surface delivery status to the user without breaking the
  // dev log-only flow.
  private async sendWithBreaker(to: string, subject: string, html: string): Promise<boolean> {
    const send = async (): Promise<boolean> => {
      if (this.transporter) {
        try {
          await this.transporter.sendMail({
            from: this.from(),
            to,
            subject,
            html,
          });
          this.logger.log(`Email sent to ${to}: ${subject}`);
          return true;
        } catch (err) {
          this.logger.error(`Failed to send email to ${to}:`, err);
          return false;
        }
      }
      this.logger.log(`[EMAIL LOG] To: ${to} | Subject: ${subject} | Body: ${html}`);
      return true;
    };
    if (this.cb) return this.cb.call('email', send);
    return send();
  }
}