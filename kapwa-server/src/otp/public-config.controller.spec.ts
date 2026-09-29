import { Test } from '@nestjs/testing';
import { SmsGatewayService } from './sms-gateway.service';
import { PublicConfigController } from './public-config.controller';

const envKeys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] as const;

describe('PublicConfigController', () => {
  afterEach(() => {
    envKeys.forEach((k) => delete process.env[k]);
  });

  it('exposes smsEnabled=false when Twilio env is absent', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicConfigController],
      providers: [SmsGatewayService],
    }).compile();
    const controller = moduleRef.get(PublicConfigController);
    expect(controller.getPublicConfig()).toEqual({ smsEnabled: false });
  });

  it('exposes smsEnabled=true when SID, token and sender number are set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_PHONE_NUMBER = '+15550000000';
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicConfigController],
      providers: [SmsGatewayService],
    }).compile();
    const controller = moduleRef.get(PublicConfigController);
    expect(controller.getPublicConfig()).toEqual({ smsEnabled: true });
  });

  it('SmsGatewayService.isConfigured requires all three variables', () => {
    const svc = new SmsGatewayService();
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    expect(svc.isConfigured()).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    expect(svc.isConfigured()).toBe(false);
    process.env.TWILIO_PHONE_NUMBER = '+15550000000';
    expect(svc.isConfigured()).toBe(true);
  });
});