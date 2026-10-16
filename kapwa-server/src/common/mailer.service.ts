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
      // Degraded mode (no SMTP). The body is deliberately NOT logged: reset and
      // account-setup links carry single-use tokens, so a logged body would put
      // working credentials into whatever collects these logs. Log the shape
      // only — and at error level in production, so a mail misconfiguration is
      // alarmable instead of silent.
      const summary =
        `[email:not-sent] SMTP is not configured — dropped for ${maskEmail(to)} ` +
        `(subject="${subject}", ${text.length} chars of body). ` +
        'Set EMAIL_HOST/EMAIL_USER/EMAIL_PASS/EMAIL_FROM to deliver mail.';
      if (process.env.NODE_ENV === 'production') this.logger.error(summary);
      else this.logger.warn(summary);
      return true;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${maskEmail(to)}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}

/**
 * `juan.dela.cruz@example.com` → `j***@example.com`.
 * Enough to trace a delivery in the log, not enough to harvest an address.
 */
export function maskEmail(address: string): string {
  const [local = '', domain] = String(address ?? '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
