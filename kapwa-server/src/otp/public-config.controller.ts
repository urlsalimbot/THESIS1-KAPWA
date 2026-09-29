import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SmsGatewayService } from './sms-gateway.service';

/**
 * `GET /config/public` — client-visible feature flags. Nothing private here:
 * the SPA needs to know which channels exist (e.g. hide the SMS preference
 * column when Twilio is not configured) without guessing from env.
 */
@Controller('config')
@ApiTags('Config (Public)')
export class PublicConfigController {
  constructor(private readonly sms: SmsGatewayService) {}

  @Get('public')
  @ApiOperation({ summary: 'Public feature flags for the SPA' })
  getPublicConfig(): { smsEnabled: boolean } {
    return { smsEnabled: this.sms.isConfigured() };
  }
}