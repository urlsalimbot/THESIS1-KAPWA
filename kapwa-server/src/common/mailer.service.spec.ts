import { MailerService } from './mailer.service';
import type { ConfigService } from '@nestjs/config';

function makeService(env: Record<string, string> = {}) {
  const config = { get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback) } as unknown as ConfigService;
  return new MailerService(config);
}

describe('MailerService', () => {
  it('logs and reports success when SMTP is not configured (degraded mode)', async () => {
    const service = makeService();
    // No transporter: the reply is written to the log and treated as accepted,
    // so a deployment without SMTP still functions.
    await expect(service.sendMail('a@b.com', 'Subject', 'Body')).resolves.toBe(true);
  });

  it('reports a real failure only when SMTP is configured and the send throws', async () => {
    const service = makeService({
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'u',
      EMAIL_PASS: 'p',
      EMAIL_PORT: '587',
    });
    // Swap the real transporter for a failing one — the contract under test is
    // "configured + failed ⇒ false", not nodemailer itself.
    (service as any).transporter = { sendMail: jest.fn().mockRejectedValue(new Error('connection refused')) };

    await expect(service.sendMail('a@b.com', 'Subject', 'Body')).resolves.toBe(false);
  });

  it('reports success when the configured transport accepts the mail', async () => {
    const service = makeService({ EMAIL_HOST: 'smtp.example.com', EMAIL_USER: 'u', EMAIL_PASS: 'p' });
    (service as any).transporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };

    await expect(service.sendMail('a@b.com', 'Subject', 'Body')).resolves.toBe(true);
  });
});