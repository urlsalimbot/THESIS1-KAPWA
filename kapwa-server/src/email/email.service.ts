import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

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
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('EMAIL_PORT', 587),
        secure: this.config.get<number>('EMAIL_PORT', 587) === 465,
        auth: {
          user,
          pass: this.config.get<string>('EMAIL_PASS', ''),
        },
      });
      this.logger.log('Email transporter initialized');
    } else {
      this.logger.warn('EMAIL_HOST/EMAIL_USER not set — emails will be logged only');
    }
  }

  private from(): string {
    return this.config.get<string>('EMAIL_FROM', 'KAPWA MSWDO <noreply@mswdo.gov>');
  }

  private appUrl(): string {
    return this.config.get<string>('APP_URL', 'http://localhost:5173');
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl()}/verify-email?token=${token}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Welcome to KAPWA</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    await this.sendWithBreaker(to, 'Verify your KAPWA account', html);
  }

  async sendForgotPasswordEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl()}/reset-password?token=${token}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Reset Your Password</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
    await this.sendWithBreaker(to, 'Reset your KAPWA password', html);
  }

  async sendEmailChangeVerification(to: string, token: string): Promise<void> {
    const link = `${this.appUrl()}/verify-email?token=${token}&change=true`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">Confirm Email Change</h2>
        <p>Click the link below to confirm your new email address:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Confirm Email</a>
        <p style="margin-top:24px;font-size:13px;color:#666">Or paste this link in your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
    await this.sendWithBreaker(to, 'Confirm your new email for KAPWA', html);
  }

  async sendNotificationEmail(to: string, subject: string, body: string): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e3a5f">${subject}</h2>
        <p>${body}</p>
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#999">MSWDO Norzagaray &middot; KAPWA Social Welfare System</p>
      </div>`;
    await this.sendWithBreaker(to, subject, html);
  }

  private async sendWithBreaker(to: string, subject: string, html: string): Promise<void> {
    const send = async () => {
      if (this.transporter) {
        try {
          await this.transporter.sendMail({
            from: this.from(),
            to,
            subject,
            html,
          });
          this.logger.log(`Email sent to ${to}: ${subject}`);
        } catch (err) {
          this.logger.error(`Failed to send email to ${to}:`, err);
        }
      } else {
        this.logger.log(`[EMAIL LOG] To: ${to} | Subject: ${subject} | Body: ${html}`);
      }
    };
    if (this.cb) return this.cb.call('email', send);
    return send();
  }
}
