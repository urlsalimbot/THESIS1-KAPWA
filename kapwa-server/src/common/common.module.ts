import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service.js';
import { CacheService } from './cache.service.js';
import { OrgService } from './org.service.js';
import { MailerService } from './mailer.service.js';

@Global()
@Module({
  providers: [CircuitBreakerService, CacheService, OrgService, MailerService],
  exports: [CircuitBreakerService, CacheService, OrgService, MailerService],
})
export class CommonModule {}
