import { MailerService, maskEmail } from './mailer.service';
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

  it('never writes the message body to the log in degraded mode', async () => {
    // The body carries reset/setup links, i.e. working single-use tokens.
    const service = makeService();
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    const body = 'Reset your password: https://app.example/reset?token=SUPER-SECRET-TOKEN';

    await service.sendMail('juan.delacruz@example.com', 'Reset', body);

    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(logged).not.toContain('SUPER-SECRET-TOKEN');
    expect(logged).not.toContain(body);
    expect(logged).not.toContain('juan.delacruz@example.com');
    expect(logged).toContain('j***@example.com');
    // The shape is still traceable.
    expect(logged).toContain(`${body.length} chars`);
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

  it('masks addresses down to one character of the local part', () => {
    expect(maskEmail('juan.delacruz@example.com')).toBe('j***@example.com');
    expect(maskEmail('@example.com')).toBe('***@example.com');
    expect(maskEmail('not-an-address')).toBe('***');
  });
});