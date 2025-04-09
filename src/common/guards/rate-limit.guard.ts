import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';

export const RATE_LIMIT_KEY = 'rate-limit';

export interface RateLimitOptions {
  points: number;
  duration: number;
  errorMessage?: string;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 100,
  duration: 60,
  errorMessage: 'Too many requests, please try again later.',
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly cacheManager: Cache,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler()) || DEFAULT_RATE_LIMIT;
    
    const key = this.generateKey(request);
    const now = Date.now();
    
    const record = await this.cacheManager.get<{ points: number; resetTime: number }>(key);
    
    if (!record) {
      await this.cacheManager.set(key, {
        points: options.points - 1,
        resetTime: now + options.duration * 1000,
      }, options.duration * 1000);
      return true;
    }
    
    if (now > record.resetTime) {
      await this.cacheManager.set(key, {
        points: options.points - 1,
        resetTime: now + options.duration * 1000,
      }, options.duration * 1000);
      return true;
    }
    
    if (record.points <= 0) {
      throw new HttpException(
        options.errorMessage ?? DEFAULT_RATE_LIMIT.errorMessage!,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    await this.cacheManager.set(
      key,
      {
        points: record.points - 1,
        resetTime: record.resetTime,
      },
      Math.ceil((record.resetTime - now) / 1000),
    );
    
    return true;
  }
  
  private generateKey(request: any): string {
    return `${request.ip}-${request.route.path}`;
  }
} 