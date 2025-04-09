import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { httpIntegration, expressIntegration } from '@sentry/node';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor } from './sentry.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: 'SENTRY_OPTIONS',
      useFactory: (configService: ConfigService) => ({
        dsn: configService.get('SENTRY_DSN'),
        environment: configService.get('NODE_ENV') || 'development',
        tracesSampleRate: 1.0,
        integrations: [
          httpIntegration(),
          expressIntegration(),
        ],
      }),
      inject: [ConfigService],
    },
  ],
})
export class SentryModule {
  constructor(configService: ConfigService) {
    const options = {
      dsn: configService.get('SENTRY_DSN'),
      environment: configService.get('NODE_ENV') || 'development',
      tracesSampleRate: 1.0,
      integrations: [
        httpIntegration(),
        expressIntegration(),
      ],
    };

    Sentry.init(options);
  }
} 