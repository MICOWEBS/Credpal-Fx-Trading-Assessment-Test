import { Test, TestingModule } from '@nestjs/testing';
import { FxService } from './fx.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('FxService', () => {
  let service: FxService;
  let httpService: HttpService;
  let configService: ConfigService;
  let cacheManager: Cache;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<FxService>(FxService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRates', () => {
    it('should return cached rates if available', async () => {
      const baseCurrency = 'USD';
      const cachedRates = {
        rates: { EUR: 0.85, GBP: 0.75 },
        base: baseCurrency,
        timestamp: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedRates);

      const result = await service.getRates(baseCurrency);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`rates:${baseCurrency}`);
      expect(result).toBe(cachedRates);
    });

    it('should fetch and cache new rates if not in cache', async () => {
      const baseCurrency = 'USD';
      const newRates = {
        rates: { EUR: 0.85, GBP: 0.75 },
        base: baseCurrency,
        timestamp: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('API_KEY');
      mockHttpService.get.mockReturnValue(of({ data: newRates }));

      const result = await service.getRates(baseCurrency);

      expect(mockHttpService.get).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith(`rates:${baseCurrency}`, newRates);
      expect(result).toEqual(newRates);
    });

    it('should handle API errors gracefully', async () => {
      const baseCurrency = 'USD';

      mockCacheManager.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('API_KEY');
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));

      await expect(service.getRates(baseCurrency)).rejects.toThrow(HttpException);
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency using rates', async () => {
      const fromCurrency = 'USD';
      const toCurrency = 'EUR';
      const amount = 100;
      const rates = {
        rates: { EUR: 0.85 },
        base: fromCurrency,
        timestamp: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(rates);

      const result = await service.convertCurrency(fromCurrency, toCurrency, amount);

      expect(result).toEqual({
        amount,
        rate: 0.85,
        convertedAmount: 85,
      });
    });

    it('should throw error for invalid currency pair', async () => {
      const fromCurrency = 'USD';
      const toCurrency = 'INVALID';
      const amount = 100;
      const rates = {
        rates: { EUR: 0.85 },
        base: fromCurrency,
        timestamp: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(rates);

      await expect(service.convertCurrency(fromCurrency, toCurrency, amount)).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle zero amount', async () => {
      const fromCurrency = 'USD';
      const toCurrency = 'EUR';
      const amount = 0;
      const rates = {
        rates: { EUR: 0.85 },
        base: fromCurrency,
        timestamp: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(rates);

      const result = await service.convertCurrency(fromCurrency, toCurrency, amount);

      expect(result).toEqual({
        amount: 0,
        rate: 0.85,
        convertedAmount: 0,
      });
    });
  });
}); 