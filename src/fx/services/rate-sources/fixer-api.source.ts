import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RateSource, RateSourceResponse } from '../../interfaces/rate-source.interface';
import { Currency } from '../../../wallet/entities/wallet-balance.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FixerApiSource implements RateSource {
  public readonly name = 'Fixer API';
  private readonly logger = new Logger(FixerApiSource.name);
  private readonly apiKey?: string;
  private readonly baseUrl = 'http://data.fixer.io/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('FIXER_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('Fixer API key not found in configuration');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Simple health check
      await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/latest?access_key=${this.apiKey}&base=EUR`)
      );
      return true;
    } catch (error) {
      this.logger.error(`Fixer API is not available: ${error.message}`);
      return false;
    }
  }

  async getRates(): Promise<RateSourceResponse[]> {
    if (!this.apiKey) {
      throw new Error('Fixer API key not configured');
    }

    try {
      // Get rates with EUR as base (free tier limitation)
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/latest?access_key=${this.apiKey}&base=EUR`)
      );

      const { rates, timestamp } = response.data;
      const responses: RateSourceResponse[] = [];

      // Convert to our standard format
      for (const [currency, rate] of Object.entries(rates)) {
        if (this.isValidCurrency(currency)) {
          responses.push({
            fromCurrency: Currency.EUR,
            toCurrency: currency as Currency,
            rate: rate as number,
            timestamp: new Date(timestamp * 1000),
            source: this.name,
          });

          // Add inverse rate
          responses.push({
            fromCurrency: currency as Currency,
            toCurrency: Currency.EUR,
            rate: 1 / (rate as number),
            timestamp: new Date(timestamp * 1000),
            source: this.name,
          });
        }
      }

      return responses;
    } catch (error) {
      this.logger.error(`Failed to fetch rates from Fixer API: ${error.message}`);
      throw error;
    }
  }

  private isValidCurrency(currency: string): boolean {
    return Object.values(Currency).includes(currency as Currency);
  }
} 