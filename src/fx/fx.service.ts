import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { retry } from '../common/utils/retry.util';
import { RETRY_CONFIG } from './config/retry.config';

// Export the interface
export interface ExchangeRateResponse {
  rates: Record<string, number>;
  base: string;
  timestamp: number;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');
    const baseUrl = this.configService.get<string>('EXCHANGE_RATE_API_URL');

    if (!apiKey || !baseUrl) {
      this.logger.error('Missing required environment variables for FX service: EXCHANGE_RATE_API_KEY or EXCHANGE_RATE_API_URL');
      throw new Error('Missing required environment variables for FX service');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getRates(baseCurrency: string = 'NGN'): Promise<ExchangeRateResponse> {
    const cacheKey = `rates:${baseCurrency}`;
    const cachedRates = await this.cacheManager.get<ExchangeRateResponse>(cacheKey);
    
    if (cachedRates) {
      this.logger.debug(`Cache hit for rates: ${baseCurrency}`);
      return cachedRates;
    }
    this.logger.debug(`Cache miss for rates: ${baseCurrency}. Fetching from API using HttpService...`);

    try {
      const observable = this.httpService.get<ExchangeRateResponse>(`${this.baseUrl}/latest/${baseCurrency}`, {
           headers: { 'X-Api-Key': this.apiKey },
      });
      
      const response = await retry<AxiosResponse<ExchangeRateResponse>>(
         () => firstValueFrom(observable),
         RETRY_CONFIG
      );

      const rates = response.data; 
      if (!rates || !rates.rates || typeof rates.rates !== 'object') {
        throw new Error('Invalid response data received from FX API in getRates');
      }
      await this.cacheManager.set(cacheKey, rates);
      this.logger.debug(`Successfully fetched and cached rates for ${baseCurrency}`);
      return rates;
    } catch (error: any) {
      this.logger.error(`Failed to fetch rates for ${baseCurrency}: ${error.message}`, error.stack);
      
      if (error && error.response) {
          const status = error.response.status || HttpStatus.SERVICE_UNAVAILABLE;
          const message = error.response.data?.message || error.response.statusText || 'FX API Error';
          this.logger.error(`FX API Error: Status ${status}, Data: ${JSON.stringify(error.response.data)}`);
          throw new HttpException(message, status);
      } else if (error && error.request) {
          this.logger.error('FX API Error: No response received from server');
          throw new HttpException('Failed to reach FX service', HttpStatus.SERVICE_UNAVAILABLE);
      } else if (error instanceof Error && error.message.includes('maxAttempts')) {
           this.logger.error(`Retry attempts failed for fetching rates for ${baseCurrency}: ${error.message}`);
            throw new HttpException('Failed to fetch exchange rates after multiple attempts', HttpStatus.SERVICE_UNAVAILABLE);
      }
      
      throw new HttpException(
        error.message || 'Failed to fetch exchange rates',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async convertCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
  ): Promise<{ amount: number; rate: number; convertedAmount: number }> {
    const ratesData = await this.getRates(fromCurrency);
    if (!ratesData || !ratesData.rates) {
        this.logger.error('Rates data is missing or invalid in convertCurrency');
        throw new HttpException('Failed to retrieve rates for conversion', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const rate = ratesData.rates[toCurrency];

    if (rate === undefined || rate === null) {
      this.logger.warn(`Exchange rate not found for ${fromCurrency} -> ${toCurrency}`);
      throw new HttpException(
        `Exchange rate not available for ${toCurrency}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const convertedAmount = amount * rate;

    return {
      amount,
      rate,
      convertedAmount,
    };
  }

  // Remove the placeholder executeTrade method from FxService
  /*
  async executeTrade(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    userId: string,
  ): Promise<any> {
    // ... placeholder code ...
  }
  */
} 