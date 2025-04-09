import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.cacheManager.set('health-check', 'ok', 1000);
      await this.cacheManager.get('health-check');
      return {
        [key]: {
          status: 'up',
        },
      };
    } catch (error) {
      throw new HealthCheckError('Redis check failed', {
        [key]: {
          status: 'down',
          error: error.message,
        },
      });
    }
  }
} 