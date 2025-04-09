import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FallbackRatesService } from './services/fallback-rates.service';
import { ExchangeRatesApiSource } from './services/rate-sources/exchange-rates-api.source';
import { FixerApiSource } from './services/rate-sources/fixer-api.source';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    FallbackRatesService,
    ExchangeRatesApiSource,
    FixerApiSource,
  ],
  exports: [
    FallbackRatesService,
  ],
})
export class FxModule {} 