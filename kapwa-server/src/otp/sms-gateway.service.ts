import { Injectable, Logger, Optional } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

@Injectable()
export class SmsGatewayService {
  private readonly logger = new Logger(SmsGatewayService.name);
  private twilioClient: any = null;

  constructor(@Optional() private cb?: CircuitBreakerService) {
    const sid = process.env.TWILIO_ACCOUNT_SID || '';
    const token = process.env.TWILIO_AUTH_TOKEN || '';
    if (sid.startsWith('AC') && token) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(sid, token);
        this.logger.log('Twilio SDK initialized');
      } catch (e) {
        this.logger.error('Failed to initialize Twilio SDK:', e);
      }
    }
  }

  async sendSms(phone: string, message: string): Promise<{ success: boolean; provider: string; messageId: string }> {
    const send = async () => {
      if (this.twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
          const result = await this.twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
          });
          this.logger.log(`[TWILIO] Sent to ${phone}, SID: ${result.sid}`);
          return { success: true, provider: 'twilio', messageId: result.sid };
        } catch (e: any) {
          this.logger.error(`[TWILIO] Failed to send to ${phone}:`, e.message);
          if (process.env.NODE_ENV === 'production') {
            return { success: false, provider: 'twilio', messageId: '' };
          }
        }
      }
      this.logger.log(`[DEV SMS] To: ${phone} — ${message}`);
      return { success: true, provider: 'log', messageId: Date.now().toString() };
    };
    return this.cb ? this.cb.call('twilio', send) : send();
  }
}
