import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

// ---------------------------------------------------------------------------
// KAPWA brand tokens (mirrors the client theme in kapwa-client/src/index.css)
// ---------------------------------------------------------------------------
const BRAND = {
  primary: '#1B3A5C', // deep navy
  secondary: '#3D5A80', // slate blue
  accent: '#C8553D', // terracotta
  bg: '#F8F7F4', // warm off-white
  card: '#FFFFFF',
  fg: '#0D1B2A',
  muted: '#E5E2DD',
  mutedFg: '#5C5A56',
  border: '#D8D4CE',
  font: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mailParagraph(text: string): string {
  return `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.65;color:${BRAND.fg};">${text}</p>`;
}

function mailNote(text: string): string {
  return `<p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;color:${BRAND.mutedFg};">${text}</p>`;
}

function mailHeading(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:${BRAND.primary};font-weight:bold;">${text}</h1>`;
}

function mailDivider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.muted};margin:20px 0;" />`;
}

function mailButton(text: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${BRAND.primary};">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${BRAND.font};font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;letter-spacing:0.4px;">${escapeHtml(text)}</a>
      </td>
    </tr>
  </table>`;
}

function mailFallbackLink(label: string, href: string): string {
  const safe = escapeHtml(href);
  return mailDivider() +
    `<p style="margin:0 0 6px 0;font-size:12px;color:${BRAND.mutedFg};">Or paste this link in your browser:</p>` +
    `<p style="margin:0 0 12px 0;font-size:12px;word-break:break-all;color:${BRAND.secondary};">${safe}</p>` +
    (label ? mailNote(label) : '');
}

function mailCodeBlock(code: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px 0;">
    <tr>
      <td bgcolor="${BRAND.bg}" style="background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:20px;text-align:center;">
        <div style="font-size:32px;font-weight:bold;color:${BRAND.primary};letter-spacing:12px;font-family:${BRAND.font};">${escapeHtml(code)}</div>
      </td>
    </tr>
  </table>`;
}

function mailPanel(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
    <tr>
      <td bgcolor="${BRAND.bg}" style="background-color:${BRAND.bg};border-left:3px solid ${BRAND.accent};border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.6;color:${BRAND.fg};">${html}</td>
    </tr>
  </table>`;
}

/**
 * A single, email-client-safe shell for every KAPWA message. All styles are
 * inline and the layout is table-based so it degrades gracefully in Outlook
 * and Gmail. Text-only branding — no external images to block or expire.
 */
function mailShell(opts: { title: string; preheader?: string; content: string }): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:${BRAND.font};color:${BRAND.fg};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bg};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:26px 32px 18px 32px;border-bottom:3px solid ${BRAND.accent};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background-color:${BRAND.primary};border-radius:8px;padding:10px 16px;font-size:22px;font-weight:bold;line-height:1;color:#FFFFFF;">K</td>
                  <td style="padding-left:14px;vertical-align:middle;line-height:1.2;">
                    <div style="font-size:22px;font-weight:bold;color:${BRAND.primary};letter-spacing:1px;">KAPWA</div>
                    <div style="font-size:10px;color:${BRAND.mutedFg};text-transform:uppercase;letter-spacing:1.2px;margin-top:2px;">Kindred Assistance &amp; People's Welfare</div>
                  </td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 10px 32px;">${opts.content}</td>
      </tr>
      <tr>
        <td style="padding:22px 32px 28px 32px;border-top:1px solid ${BRAND.muted};text-align:center;">
          <div style="font-size:12px;line-height:1.7;color:${BRAND.mutedFg};">
            <strong style="color:${BRAND.primary};">KAPWA</strong> &middot; MSWDO Norzagaray<br />
            Office of the Municipal Social Welfare and Development<br />
            Norzagaray, Bulacan, Philippines
          </div>
          <div style="font-size:11px;color:${BRAND.mutedFg};margin-top:12px;">This is an automated message from the KAPWA system. Please do not reply to this email.</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
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

  // Public so provisioning can build the one-time set-password link.
  getAppBaseUrl(): string {
    return this.appUrl();
  }

  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/verify-email?token=${token}`;
    const content =
      mailHeading('Welcome to KAPWA') +
      mailParagraph('Thank you for registering with the KAPWA Social Welfare System. To activate your account, please confirm your email address by clicking the button below.') +
      mailButton('Verify email address', link) +
      mailFallbackLink('The link is valid for 24 hours. If you did not create a KAPWA account, you can safely ignore this email.', link);
    return this.sendWithBreaker(to, 'Verify your KAPWA account', mailShell({ title: 'Verify your KAPWA account', preheader: 'Confirm your email address to activate your KAPWA account', content }));
  }

  async sendForgotPasswordEmail(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/reset-password?token=${token}`;
    const content =
      mailHeading('Reset your password') +
      mailParagraph('You requested a password reset for your KAPWA account. Click the button below to choose a new password.') +
      mailButton('Reset password', link) +
      mailFallbackLink('This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.', link);
    return this.sendWithBreaker(to, 'Reset your KAPWA password', mailShell({ title: 'Reset your KAPWA password', preheader: 'Choose a new password — the link expires in 1 hour', content }));
  }

  async sendEmailChangeVerification(to: string, token: string): Promise<boolean> {
    const link = `${this.appUrl()}/verify-email?token=${token}&change=true`;
    const content =
      mailHeading('Confirm your new email') +
      mailParagraph('You requested to change the email address linked to your KAPWA account. Confirm your new address by clicking the button below.') +
      mailButton('Confirm new email', link) +
      mailFallbackLink('If you did not request this change, you can safely ignore this email.', link);
    return this.sendWithBreaker(to, 'Confirm your new email for KAPWA', mailShell({ title: 'Confirm your new email for KAPWA', preheader: 'Confirm your new email address', content }));
  }

  async sendNotificationEmail(to: string, subject: string, body: string): Promise<boolean> {
    const safeSubject = escapeHtml(subject);
    const safeBody = escapeHtml(body).replace(/\n/g, '<br/>');
    const content =
      mailHeading(safeSubject) +
      mailParagraph(safeBody) +
      mailDivider() +
      mailParagraph(`<a href="${escapeHtml(this.appUrl())}" style="color:${BRAND.secondary};">Sign in to KAPWA</a> to review the full details.`);
    return this.sendWithBreaker(to, safeSubject, mailShell({ title: safeSubject, preheader: safeSubject, content }));
  }

  // New account (claimant or staff): one-time set-password link, no password.
  async sendAccountSetupEmail(
    to: string,
    opts: { link: string; fullName?: string; role: string; beneficiaryName?: string; controlNo?: string },
  ): Promise<boolean> {
    const safeName = escapeHtml(opts.fullName || to);
    const safeRole = escapeHtml(opts.role.replace(/_/g, ' '));
    const context = opts.beneficiaryName
      ? mailPanel(`An account was created for you as the <strong>claimant</strong> of <strong>${escapeHtml(opts.beneficiaryName)}</strong>${opts.controlNo ? ` (Case ${escapeHtml(opts.controlNo)})` : ''}.`)
      : mailPanel(`An account was created for <strong>${safeName}</strong> with the role <strong>${safeRole}</strong>.`);
    const content =
      mailHeading('Set up your KAPWA account') +
      context +
      mailParagraph('Choose a password for your account using the one-time link below. It can be used once and expires in 7 days.') +
      mailButton('Set your password', opts.link) +
      mailFallbackLink('If you did not expect this account, please contact the MSWDO Norzagaray office.', opts.link);
    return this.sendWithBreaker(to, 'Set up your KAPWA account', mailShell({ title: 'Set up your KAPWA account', preheader: 'Choose your password with the one-time link', content }));
  }

  // Existing claimant account linked to a newly enrolled beneficiary: no
  // credentials, just confirmation that the enrollment succeeded.
  async sendClaimantEnrollmentEmail(
    to: string,
    opts: { beneficiaryName: string; controlNo: string },
  ): Promise<boolean> {
    const content =
      mailHeading('Enrollment confirmed') +
      mailPanel(`<strong>${escapeHtml(opts.beneficiaryName)}</strong> has been successfully enrolled (Case ${escapeHtml(opts.controlNo)}) and linked to your KAPWA claimant account.`) +
      mailParagraph('Sign in to view the status of your case and your access card.') +
      mailButton('Sign in to KAPWA', `${this.appUrl()}/login`) +
      mailNote('If you have questions about this enrollment, contact the MSWDO Norzagaray office.');
    return this.sendWithBreaker(to, 'KAPWA enrollment confirmed', mailShell({ title: 'KAPWA enrollment confirmed', preheader: 'Your enrollment was confirmed — sign in to view your case', content }));
  }

  async sendOtpEmail(to: string, code: string): Promise<boolean> {
    const content =
      mailHeading('Your verification code') +
      mailParagraph('Use the code below to complete your sign-in verification in the KAPWA system.') +
      mailCodeBlock(code) +
      mailNote(`This code expires in 5 minutes. If you did not request it, you can safely ignore this email.`);
    return this.sendWithBreaker(to, 'Your KAPWA verification code', mailShell({ title: 'Your KAPWA verification code', preheader: 'Enter this code to complete sign-in verification', content }));
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