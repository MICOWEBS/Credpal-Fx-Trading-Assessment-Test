import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { FxModule } from './fx/fx.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { SentryModule } from './sentry/sentry.module';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
        password: configService.get('REDIS_PASSWORD'),
        ttl: 60 * 60 * 24, // 24 hours
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    WalletModule,
    FxModule,
    TransactionsModule,
    AnalyticsModule,
    RedisModule,
    HealthModule,
    SentryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {} 