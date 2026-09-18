import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CacheService } from './cache.service';
import { OrgService } from './org.service';

@Global()
@Module({
  providers: [CircuitBreakerService, CacheService, OrgService],
  exports: [CircuitBreakerService, CacheService, OrgService],
})
export class CommonModule {}
