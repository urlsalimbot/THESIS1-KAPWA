import { SmsGatewayService } from './sms-gateway.service';

describe('SmsGatewayService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('reports unconfigured without valid Twilio credentials', () => {
    const service = new SmsGatewayService(undefined);
    expect(service.isConfigured()).toBe(false);
  });

  it('falls back to the log provider and reports success when Twilio is absent', async () => {
    const service = new SmsGatewayService(undefined);
    const out = await service.sendSms('+639000000000', 'code 123456');
    expect(out.success).toBe(true);
    expect(out.provider).toBe('log');
  });

  it('returns a real failure when Twilio rejects the message in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TWILIO_PHONE_NUMBER = '+15550000000';
    const service = new SmsGatewayService(undefined);
    // The client is injected by the constructor when credentials exist; here we
    // set the client directly so the failing branch is the one under test.
    (service as any).twilioClient = { messages: { create: jest.fn().mockRejectedValue(new Error('21610 unsubscribed')) } };

    const out = await service.sendSms('+639000000000', 'code 123456');

    expect(out).toEqual({ success: false, provider: 'twilio', messageId: '' });
  });
});