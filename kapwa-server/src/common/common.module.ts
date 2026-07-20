import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CircuitBreakerService, CacheService],
  exports: [CircuitBreakerService, CacheService],
})
export class CommonModule {}
