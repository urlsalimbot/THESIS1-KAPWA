import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreakerPolicy,
  CountBreaker,
  circuitBreaker,
  handleAll,
  retry,
  ExponentialBackoff,
} from 'cockatiel';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreakerPolicy>();
  private readonly retriers = new Map<string, ReturnType<typeof retry>>();

  getBreaker(name: string): CircuitBreakerPolicy {
    if (!this.breakers.has(name)) {
      const breaker = new CountBreaker({ threshold: 0.5, size: 10 });
      const policy = circuitBreaker(handleAll, {
        halfOpenAfter: 10_000,
        breaker,
      });

      policy.onHalfOpen(() => this.logger.log(`[${name}] circuit half-open`));
      (policy as any).onBreak(() => this.logger.warn(`[${name}] circuit opened`));
      (policy as any).onReset(() => this.logger.log(`[${name}] circuit closed`));

      this.breakers.set(name, policy);
      this.retriers.set(
        name,
        retry(handleAll, {
          maxAttempts: 3,
          backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 5_000 }),
        }),
      );
    }
    return this.breakers.get(name)!;
  }

  async call<T>(service: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getBreaker(service);
    const retrier = this.retriers.get(service)!;
    return retrier.execute(() => breaker.execute(fn));
  }
}
