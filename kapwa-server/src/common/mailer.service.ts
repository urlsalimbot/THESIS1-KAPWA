import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Sends email through SMTP.
 *
 * Configuration comes from the environment: EMAIL_HOST, EMAIL_PORT, EMAIL_USER,
 * EMAIL_PASS, EMAIL_FROM. When any is missing the service does not throw — it logs
 * the message and reports success, because "logged only" is the designed degraded
 * mode (see the EMAIL_HOST warning in main.ts) and a local environment without
 * SMTP must still be able to exercise every flow that sends mail. When SMTP *is*
 * configured a delivery failure returns false so the caller can report it.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('EMAIL_HOST');
    const user = config.get<string>('EMAIL_USER');
    const pass = config.get<string>('EMAIL_PASS');
    this.from = config.get<string>('EMAIL_FROM') ?? 'MSWDO Norzagaray <noreply@kapwa.software>';

    if (host && user && pass) {
      const port = Number(config.get<string>('EMAIL_PORT') ?? 587);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP is not configured — outgoing email is logged, not sent.');
    }
  }

  /**
   * Send a plain-text email. Returns true when the mail was accepted — either
   * delivered by SMTP or, with no SMTP configured, logged for the degraded mode.
   * Returns only false when SMTP is configured and the send failed, so a caller
   * can surface a real failure without crashing the request.
   */
  async sendMail(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[email:logged] to=${to} subject="${subject}"\n${text}`);
      return true;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
