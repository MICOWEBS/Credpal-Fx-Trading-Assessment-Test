import { Currency } from '../../wallet/entities/wallet-balance.entity';

export interface FallbackRate {
  rate: number;
  lastUpdated: Date;
}

export interface FallbackRates {
  [key: string]: {
    [key: string]: FallbackRate;
  };
}

// Base fallback rates - these will be updated periodically
export const BASE_FALLBACK_RATES: Record<string, Record<string, number>> = {
  [Currency.NGN]: {
    [Currency.USD]: 0.0021, // 1 NGN = 0.0021 USD
    [Currency.EUR]: 0.0019, // 1 NGN = 0.0019 EUR
    [Currency.GBP]: 0.0016, // 1 NGN = 0.0016 GBP
  },
  [Currency.USD]: {
    [Currency.NGN]: 476.19, // 1 USD = 476.19 NGN
    [Currency.EUR]: 0.92,   // 1 USD = 0.92 EUR
    [Currency.GBP]: 0.79,   // 1 USD = 0.79 GBP
  },
  [Currency.EUR]: {
    [Currency.NGN]: 517.60, // 1 EUR = 517.60 NGN
    [Currency.USD]: 1.09,   // 1 EUR = 1.09 USD
    [Currency.GBP]: 0.86,   // 1 EUR = 0.86 GBP
  },
  [Currency.GBP]: {
    [Currency.NGN]: 602.41, // 1 GBP = 602.41 NGN
    [Currency.USD]: 1.27,   // 1 GBP = 1.27 USD
    [Currency.EUR]: 1.16,   // 1 GBP = 1.16 EUR
  },
};

// Maximum age of fallback rates before they're considered stale (in hours)
export const MAX_FALLBACK_RATE_AGE = 1;

// Convert base rates to the dynamic format with timestamps
export function initializeFallbackRates(): FallbackRates {
  const now = new Date();
  const rates: FallbackRates = {};

  for (const [fromCurrency, toCurrencies] of Object.entries(BASE_FALLBACK_RATES)) {
    rates[fromCurrency] = {};
    for (const [toCurrency, rate] of Object.entries(toCurrencies)) {
      rates[fromCurrency][toCurrency] = {
        rate,
        lastUpdated: now,
      };
    }
  }

  return rates;
}

// Helper to check if rates are stale
export function areRatesStale(lastUpdated: Date): boolean {
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > MAX_FALLBACK_RATE_AGE;
} 