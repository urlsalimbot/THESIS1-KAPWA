import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CacheService } from './cache.service';
import { OrgService } from './org.service';
import { MailerService } from './mailer.service';

@Global()
@Module({
  providers: [CircuitBreakerService, CacheService, OrgService, MailerService],
  exports: [CircuitBreakerService, CacheService, OrgService, MailerService],
})
export class CommonModule {}
