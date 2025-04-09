import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RateLimitFilter } from '../filters/rate-limit.filter';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // Default TTL in seconds
      max: 100, // Maximum number of items in cache
    }),
  ],
  providers: [RateLimitGuard, RateLimitFilter],
  exports: [RateLimitGuard, RateLimitFilter],
})
export class RateLimitModule {} 