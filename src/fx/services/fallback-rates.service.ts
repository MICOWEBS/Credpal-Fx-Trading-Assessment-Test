import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  FallbackRates, 
  FallbackRate, 
  BASE_FALLBACK_RATES, 
  initializeFallbackRates,
  areRatesStale 
} from '../config/fallback-rates.config';
import { Currency } from '../../wallet/entities/wallet-balance.entity';
import { withRetry } from '../utils/retry.util';
import { RateSource } from '../interfaces/rate-source.interface';
import { ExchangeRatesApiSource } from './rate-sources/exchange-rates-api.source';
import { FixerApiSource } from './rate-sources/fixer-api.source';

@Injectable()
export class FallbackRatesService {
  private fallbackRates: FallbackRates;
  private readonly logger = new Logger(FallbackRatesService.name);
  private readonly rateSources: RateSource[];
  private readonly SIGNIFICANT_RATE_CHANGE_PERCENT = 5; // For monitoring purposes only

  constructor(
    private readonly exchangeRatesApiSource: ExchangeRatesApiSource,
    private readonly fixerApiSource: FixerApiSource,
  ) {
    this.fallbackRates = initializeFallbackRates();
    this.rateSources = [
      exchangeRatesApiSource,
      fixerApiSource,
    ];
  }

  /**
   * Get the current fallback rate for a currency pair
   */
  getRate(fromCurrency: Currency, toCurrency: Currency): number {
    const rate = this.fallbackRates[fromCurrency]?.[toCurrency];
    if (!rate) {
      this.logger.warn(`No fallback rate found for ${fromCurrency} to ${toCurrency}`);
      return BASE_FALLBACK_RATES[fromCurrency]?.[toCurrency] ?? 1;
    }
    return rate.rate;
  }

  /**
   * Update a specific currency pair rate
   */
  updateRate(fromCurrency: Currency, toCurrency: Currency, newRate: number): void {
    if (!this.isValidRate(newRate)) {
      this.logger.warn(`Invalid rate value: ${newRate} for ${fromCurrency} to ${toCurrency}`);
      return;
    }

    // Monitor significant rate changes but don't reject them
    const currentRate = this.fallbackRates[fromCurrency]?.[toCurrency]?.rate;
    if (currentRate) {
      const changePercent = this.calculateChangePercent(currentRate, newRate);
      if (Math.abs(changePercent) > this.SIGNIFICANT_RATE_CHANGE_PERCENT) {
        this.logger.warn(
          `Significant market rate change detected for ${fromCurrency}/${toCurrency}: ` +
          `${currentRate} -> ${newRate} (${changePercent.toFixed(2)}% change)`
        );
      }
    }

    if (!this.fallbackRates[fromCurrency]) {
      this.fallbackRates[fromCurrency] = {};
    }
    
    this.fallbackRates[fromCurrency][toCurrency] = {
      rate: newRate,
      lastUpdated: new Date(),
    };

    // Update inverse rate
    const inverseRate = 1 / newRate;
    if (!this.fallbackRates[toCurrency]) {
      this.fallbackRates[toCurrency] = {};
    }
    
    this.fallbackRates[toCurrency][fromCurrency] = {
      rate: inverseRate,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if rates need updating
   */
  private shouldUpdateRates(): boolean {
    for (const fromCurrency of Object.keys(this.fallbackRates)) {
      for (const toCurrency of Object.keys(this.fallbackRates[fromCurrency])) {
        const rate = this.fallbackRates[fromCurrency][toCurrency];
        if (areRatesStale(rate.lastUpdated)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Validate a rate value
   */
  private isValidRate(rate: number): boolean {
    return (
      typeof rate === 'number' &&
      !isNaN(rate) &&
      isFinite(rate) &&
      rate > 0 &&
      rate < 1000000 // Reasonable upper limit
    );
  }

  /**
   * Calculate the percentage change between two rates
   */
  private calculateChangePercent(oldRate: number, newRate: number): number {
    return ((newRate - oldRate) / oldRate) * 100;
  }

  /**
   * Attempt to fetch latest rates from available sources
   */
  private async fetchLatestRates(): Promise<void> {
    let success = false;
    let lastError: Error | null = null;

    // Try each rate source in order
    for (const source of this.rateSources) {
      try {
        // Check if source is available
        const isAvailable = await source.isAvailable();
        if (!isAvailable) {
          this.logger.warn(`${source.name} is not available, trying next source`);
          continue;
        }

        // Fetch rates from source
        const rates = await source.getRates();
        
        // Validate and update rates
        for (const rate of rates) {
          if (this.isValidRate(rate.rate)) {
            this.updateRate(rate.fromCurrency, rate.toCurrency, rate.rate);
            this.logger.debug(
              `Updated rate for ${rate.fromCurrency}/${rate.toCurrency} from ${source.name}: ${rate.rate}`
            );
          } else {
            this.logger.warn(
              `Invalid rate from ${source.name} for ${rate.fromCurrency}/${rate.toCurrency}: ${rate.rate}`
            );
          }
        }

        success = true;
        this.logger.log(`Successfully updated rates from ${source.name}`);
        break; // Exit loop if successful
      } catch (error) {
        lastError = error;
        this.logger.error(`Failed to fetch rates from ${source.name}: ${error.message}`);
        // Continue to next source
      }
    }

    if (!success) {
      this.logger.error('All rate sources failed', lastError);
      throw lastError || new Error('All rate sources failed');
    }
  }

  /**
   * Update rates every hour if they're stale
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateRatesIfNeeded(): Promise<void> {
    if (this.shouldUpdateRates()) {
      await withRetry(
        () => this.fetchLatestRates(),
        this.logger,
        'Updating fallback rates'
      );
    }
  }
} 