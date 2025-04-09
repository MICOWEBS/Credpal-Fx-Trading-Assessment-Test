import { Currency } from '../../wallet/entities/wallet-balance.entity';

export interface RateSourceResponse {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface RateSource {
  name: string;
  getRates(): Promise<RateSourceResponse[]>;
  isAvailable(): Promise<boolean>;
} 