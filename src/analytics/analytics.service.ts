import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { Currency } from '../wallet/entities/wallet-balance.entity';
import { User } from '../auth/entities/user.entity';
import { WalletBalance } from '../wallet/entities/wallet-balance.entity';
import { format, subDays } from 'date-fns';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WalletBalance)
    private readonly walletBalanceRepository: Repository<WalletBalance>,
  ) {}

  async getTradeAnalytics(userId: string, days: number = 30) {
    const startDate = subDays(new Date(), days);
    
    const [trades, walletBalances, user] = await Promise.all([
      this.transactionRepository.find({
        where: {
          userId,
          type: TransactionType.TRADE,
          createdAt: Between(startDate, new Date())
        },
        order: { createdAt: 'DESC' },
      }),
      this.walletBalanceRepository.find({
        where: { wallet: { user: { id: userId } } }
      }),
      this.userRepository.findOne({ where: { id: userId } })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const ngnTrades = trades.filter(
      trade => trade.fromCurrency === 'NGN' || trade.toCurrency === 'NGN'
    );

    const analytics = {
      userVerification: {
        isVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        verificationStatus: user.isEmailVerified ? 'verified' : 'pending',
        lastActivity: user.updatedAt,
        tradingAccess: user.isEmailVerified ? 'granted' : 'restricted'
      },
      walletStatus: {
        initialBalance: this.getInitialBalance(walletBalances),
        currentBalances: this.analyzeWalletBalances(walletBalances),
        fundingHistory: this.analyzeFundingHistory(trades),
        currencySupport: this.getSupportedCurrencies(walletBalances)
      },
      fxMetrics: {
        rateUsage: this.analyzeFxRateUsage(trades),
        rateAccuracy: this.analyzeRateAccuracy(trades),
        cachePerformance: this.analyzeCachePerformance(trades),
        realTimeRates: this.analyzeRealTimeRates(trades)
      },
      conversionMetrics: {
        ngnConversions: this.analyzeNgnConversions(ngnTrades),
        foreignConversions: this.analyzeForeignConversions(trades),
        rateEffectiveness: this.analyzeRateEffectiveness(trades)
      },
      transactionHistory: this.analyzeTransactionHistory(trades)
    };

    return analytics;
  }

  async getUserActivity(userId: string) {
    const [activities, user, walletBalances] = await Promise.all([
      this.transactionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.userRepository.findOne({ where: { id: userId } }),
      this.walletBalanceRepository.find({
        where: { wallet: { user: { id: userId } } }
      })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const verificationStatus = {
      isVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return {
      totalTransactions: activities.length,
      transactionTypes: this.analyzeTransactionTypes(activities),
      activityTimeline: this.analyzeActivityTimeline(activities),
      currencyDistribution: this.analyzeCurrencyDistribution(activities),
      walletMetrics: this.calculateWalletMetrics(activities),
      verificationStatus,
      walletBalances: this.analyzeWalletBalances(walletBalances),
      recentActivity: activities.slice(0, 5).map(activity => ({
        type: activity.type,
        amount: activity.amount,
        currency: activity.fromCurrency,
        targetCurrency: activity.toCurrency,
        rate: activity.rate,
        timestamp: activity.createdAt,
        status: activity.status,
        convertedAmount: activity.convertedAmount
      }))
    };
  }

  async getFxTrends(days: number = 7) {
    const startDate = subDays(new Date(), days);
    
    const trades = await this.transactionRepository.find({
      where: {
        type: TransactionType.TRADE,
        createdAt: Between(startDate, new Date())
      },
      order: { createdAt: 'DESC' },
    });

    return {
      popularPairs: this.analyzePopularPairs(trades),
      volumeTrends: this.analyzeVolumeTrends(trades),
      conversionRates: this.analyzeConversionRates(trades),
      marketActivity: {
        totalVolume: trades.reduce((sum, trade) => sum + trade.amount, 0),
        uniqueUsers: new Set(trades.map(trade => trade.userId)).size,
        averageTradeSize: trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.amount, 0) / trades.length : 0,
      },
      currencyTrends: this.analyzeCurrencyTrends(trades)
    };
  }

  private analyzeCurrencyPairs(trades: Transaction[]) {
    const pairs = new Map<string, {
      count: number,
      volume: number,
      averageRate: number
    }>();
    
    trades.forEach(trade => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      const existing = pairs.get(pair) || { count: 0, volume: 0, averageRate: 0 };
      pairs.set(pair, {
        count: existing.count + 1,
        volume: existing.volume + trade.amount,
        averageRate: (existing.averageRate * existing.count + trade.rate) / (existing.count + 1)
      });
    });
    
    return Object.fromEntries(pairs);
  }

  private calculateProfitLossMetrics(trades: Transaction[]) {
    return trades.reduce((metrics, trade) => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!metrics[pair]) {
        metrics[pair] = {
          totalVolume: 0,
          averageRate: 0,
          highestRate: 0,
          lowestRate: Infinity
        };
      }
      
      metrics[pair].totalVolume += trade.amount;
      metrics[pair].averageRate = (metrics[pair].averageRate + trade.rate) / 2;
      metrics[pair].highestRate = Math.max(metrics[pair].highestRate, trade.rate);
      metrics[pair].lowestRate = Math.min(metrics[pair].lowestRate, trade.rate);
      
      return metrics;
    }, {} as Record<string, {
      totalVolume: number;
      averageRate: number;
      highestRate: number;
      lowestRate: number;
    }>);
  }

  private analyzeMostTradedCurrencies(trades: Transaction[]) {
    const currencies = new Map<string, number>();
    
    trades.forEach(trade => {
      currencies.set(trade.fromCurrency, (currencies.get(trade.fromCurrency) || 0) + trade.amount);
      currencies.set(trade.toCurrency, (currencies.get(trade.toCurrency) || 0) + trade.convertedAmount);
    });
    
    return Array.from(currencies.entries())
      .sort(([, a], [, b]) => b - a)
      .reduce((obj, [currency, volume]) => ({
        ...obj,
        [currency]: volume
      }), {});
  }

  private calculateWalletMetrics(activities: Transaction[]) {
    const metrics = {
      totalFunding: 0,
      totalTrading: 0,
      successRate: 0,
      currencyExposure: {} as Record<string, number>
    };

    const successfulTrades = activities.filter(a => a.type === TransactionType.TRADE).length;
    const totalTrades = activities.filter(a => a.type === TransactionType.TRADE).length;

    activities.forEach(activity => {
      if (activity.type === TransactionType.FUNDING) {
        metrics.totalFunding += activity.amount;
      } else if (activity.type === TransactionType.TRADE) {
        metrics.totalTrading += activity.amount;
      }

      // Track currency exposure
      metrics.currencyExposure[activity.fromCurrency] = 
        (metrics.currencyExposure[activity.fromCurrency] || 0) + activity.amount;
    });

    metrics.successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    return metrics;
  }

  private analyzeCurrencyTrends(trades: Transaction[]) {
    const trends = new Map<string, {
      inflow: number;
      outflow: number;
      netFlow: number;
      tradeCount: number;
    }>();

    trades.forEach(trade => {
      // Handle source currency (outflow)
      if (!trends.has(trade.fromCurrency)) {
        trends.set(trade.fromCurrency, {
          inflow: 0,
          outflow: 0,
          netFlow: 0,
          tradeCount: 0
        });
      }
      const fromCurrency = trends.get(trade.fromCurrency)!;
      fromCurrency.outflow += trade.amount;
      fromCurrency.netFlow -= trade.amount;
      fromCurrency.tradeCount++;

      // Handle target currency (inflow)
      if (!trends.has(trade.toCurrency)) {
        trends.set(trade.toCurrency, {
          inflow: 0,
          outflow: 0,
          netFlow: 0,
          tradeCount: 0
        });
      }
      const toCurrency = trends.get(trade.toCurrency)!;
      toCurrency.inflow += trade.convertedAmount;
      toCurrency.netFlow += trade.convertedAmount;
      toCurrency.tradeCount++;
    });

    return Object.fromEntries(trends);
  }

  private analyzeDailyVolume(trades: Transaction[]) {
    const dailyVolume = new Map<string, number>();
    trades.forEach(trade => {
      const date = trade.createdAt.toISOString().split('T')[0];
      dailyVolume.set(date, (dailyVolume.get(date) || 0) + trade.amount);
    });
    return Object.fromEntries(dailyVolume);
  }

  private calculateConversionMetrics(trades: Transaction[]) {
    const conversionMetrics = {
      totalConversions: trades.length,
      averageConversionRate: 0,
      totalSourceAmount: 0,
      totalTargetAmount: 0,
      currencyPairs: {} as Record<string, {
        conversions: number;
        totalSourceAmount: number;
        totalTargetAmount: number;
        averageRate: number;
      }>,
    };

    trades.forEach(trade => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!conversionMetrics.currencyPairs[pair]) {
        conversionMetrics.currencyPairs[pair] = {
          conversions: 0,
          totalSourceAmount: 0,
          totalTargetAmount: 0,
          averageRate: 0,
        };
      }

      const pairMetrics = conversionMetrics.currencyPairs[pair];
      pairMetrics.conversions++;
      pairMetrics.totalSourceAmount += trade.amount;
      pairMetrics.totalTargetAmount += trade.convertedAmount;
      pairMetrics.averageRate = pairMetrics.totalTargetAmount / pairMetrics.totalSourceAmount;

      conversionMetrics.totalSourceAmount += trade.amount;
      conversionMetrics.totalTargetAmount += trade.convertedAmount;
    });

    conversionMetrics.averageConversionRate = conversionMetrics.totalTargetAmount / conversionMetrics.totalSourceAmount;

    return conversionMetrics;
  }

  private analyzeTransactionTypes(activities: Transaction[]) {
    const types = new Map<string, number>();
    activities.forEach(activity => {
      types.set(activity.type, (types.get(activity.type) || 0) + 1);
    });
    return Object.fromEntries(types);
  }

  private analyzeActivityTimeline(activities: Transaction[]) {
    const timeline = new Map<string, number>();
    activities.forEach(activity => {
      const date = activity.createdAt.toISOString().split('T')[0];
      timeline.set(date, (timeline.get(date) || 0) + 1);
    });
    return Object.fromEntries(timeline);
  }

  private analyzeCurrencyDistribution(activities: Transaction[]) {
    const currencies = new Map<string, number>();
    activities.forEach(activity => {
      const currency = activity.fromCurrency;
      currencies.set(currency, (currencies.get(currency) || 0) + activity.amount);
    });
    return Object.fromEntries(currencies);
  }

  private analyzePopularPairs(trades: Transaction[]) {
    const pairs = new Map<string, number>();
    trades.forEach(trade => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      pairs.set(pair, (pairs.get(pair) || 0) + 1);
    });
    return Object.fromEntries(pairs);
  }

  private analyzeVolumeTrends(trades: Transaction[]) {
    const trends = new Map<string, number>();
    trades.forEach(trade => {
      const date = trade.createdAt.toISOString().split('T')[0];
      trends.set(date, (trends.get(date) || 0) + trade.amount);
    });
    return Object.fromEntries(trends);
  }

  private analyzeConversionRates(trades: Transaction[]) {
    const rates = new Map<string, number[]>();
    trades.forEach(trade => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!rates.has(pair)) {
        rates.set(pair, []);
      }
      rates.get(pair)?.push(trade.rate || 0);
    });

    const averages = new Map<string, number>();
    rates.forEach((values, pair) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      averages.set(pair, avg);
    });

    return Object.fromEntries(averages);
  }

  private analyzeNgnPairs(trades: Transaction[]) {
    const pairs = new Map<string, {
      count: number;
      volume: number;
      averageRate: number;
      lastRate: number;
      lastTradeTime: Date;
    }>();

    trades.forEach(trade => {
      const pair = trade.fromCurrency === 'NGN' 
        ? `NGN-${trade.toCurrency}` 
        : `${trade.fromCurrency}-NGN`;

      const existing = pairs.get(pair) || {
        count: 0,
        volume: 0,
        averageRate: 0,
        lastRate: 0,
        lastTradeTime: trade.createdAt
      };

      const volume = trade.fromCurrency === 'NGN' ? trade.amount : trade.convertedAmount;

      pairs.set(pair, {
        count: existing.count + 1,
        volume: existing.volume + volume,
        averageRate: (existing.averageRate * existing.count + trade.rate) / (existing.count + 1),
        lastRate: trade.rate,
        lastTradeTime: trade.createdAt
      });
    });

    return Object.fromEntries(pairs);
  }

  private analyzeWalletBalances(balances: WalletBalance[]) {
    return balances.reduce((acc, balance) => {
      acc[balance.currency] = {
        currentBalance: Number(balance.balance),
        availableBalance: Number(balance.availableBalance),
        lockedBalance: Number(balance.lockedBalance),
        lastUpdated: balance.updatedAt
      };
      return acc;
    }, {} as Record<string, {
      currentBalance: number;
      availableBalance: number;
      lockedBalance: number;
      lastUpdated: Date;
    }>);
  }

  private analyzeFxRateUsage(trades: Transaction[]) {
    const rateAnalysis = new Map<string, {
      count: number;
      averageRate: number;
      highestRate: number;
      lowestRate: number;
      lastRate: number;
      lastUpdated: Date;
    }>();

    trades.forEach(trade => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      const existing = rateAnalysis.get(pair) || {
        count: 0,
        averageRate: 0,
        highestRate: 0,
        lowestRate: Infinity,
        lastRate: 0,
        lastUpdated: trade.createdAt
      };

      rateAnalysis.set(pair, {
        count: existing.count + 1,
        averageRate: (existing.averageRate * existing.count + trade.rate) / (existing.count + 1),
        highestRate: Math.max(existing.highestRate, trade.rate),
        lowestRate: Math.min(existing.lowestRate, trade.rate),
        lastRate: trade.rate,
        lastUpdated: trade.createdAt
      });
    });

    return Object.fromEntries(rateAnalysis);
  }

  private analyzeNgnConversionRates(trades: Transaction[]) {
    const rates = new Map<string, {
      count: number;
      totalVolume: number;
      averageRate: number;
      highestRate: number;
      lowestRate: number;
      lastRate: number;
      lastTradeTime: Date;
    }>();

    trades.forEach(trade => {
      const pair = trade.fromCurrency === 'NGN' 
        ? `NGN-${trade.toCurrency}` 
        : `${trade.fromCurrency}-NGN`;

      const existing = rates.get(pair) || {
        count: 0,
        totalVolume: 0,
        averageRate: 0,
        highestRate: 0,
        lowestRate: Infinity,
        lastRate: 0,
        lastTradeTime: trade.createdAt
      };

      const volume = trade.fromCurrency === 'NGN' ? trade.amount : trade.convertedAmount;

      rates.set(pair, {
        count: existing.count + 1,
        totalVolume: existing.totalVolume + volume,
        averageRate: (existing.averageRate * existing.count + trade.rate) / (existing.count + 1),
        highestRate: Math.max(existing.highestRate, trade.rate),
        lowestRate: Math.min(existing.lowestRate, trade.rate),
        lastRate: trade.rate,
        lastTradeTime: trade.createdAt
      });
    });

    return Object.fromEntries(rates);
  }

  private analyzeNgnTradeDistribution(trades: Transaction[]) {
    const distribution = {
      byCurrency: new Map<string, {
        count: number;
        volume: number;
        averageRate: number;
      }>(),
      byTime: new Map<string, number>(),
      byAmount: {
        small: 0,    // < 1000 NGN
        medium: 0,   // 1000-10000 NGN
        large: 0     // > 10000 NGN
      }
    };

    trades.forEach(trade => {
      const currency = trade.fromCurrency === 'NGN' ? trade.toCurrency : trade.fromCurrency;
      const amount = trade.fromCurrency === 'NGN' ? trade.amount : trade.convertedAmount;
      const time = format(trade.createdAt, 'yyyy-MM-dd');

      // Update currency distribution
      const currencyStats = distribution.byCurrency.get(currency) || {
        count: 0,
        volume: 0,
        averageRate: 0
      };
      currencyStats.count++;
      currencyStats.volume += amount;
      currencyStats.averageRate = (currencyStats.averageRate * (currencyStats.count - 1) + trade.rate) / currencyStats.count;
      distribution.byCurrency.set(currency, currencyStats);

      // Update time distribution
      distribution.byTime.set(time, (distribution.byTime.get(time) || 0) + 1);

      // Update amount distribution
      if (amount < 1000) {
        distribution.byAmount.small++;
      } else if (amount <= 10000) {
        distribution.byAmount.medium++;
      } else {
        distribution.byAmount.large++;
      }
    });

    return {
      byCurrency: Object.fromEntries(distribution.byCurrency),
      byTime: Object.fromEntries(distribution.byTime),
      byAmount: distribution.byAmount
    };
  }

  private analyzeTransactionHistory(trades: Transaction[]) {
    return trades.map(trade => ({
      id: trade.id,
      type: trade.type,
      fromCurrency: trade.fromCurrency,
      toCurrency: trade.toCurrency,
      amount: trade.amount,
      convertedAmount: trade.convertedAmount,
      rate: trade.rate,
      timestamp: trade.createdAt,
      status: trade.status,
      reference: trade.reference,
      metadata: {
        isNgnTrade: trade.fromCurrency === 'NGN' || trade.toCurrency === 'NGN',
        direction: trade.fromCurrency === 'NGN' ? 'outbound' : 'inbound',
        rateAccuracy: this.calculateRateAccuracy(trade),
        amountCategory: this.getAmountCategory(trade),
        timeOfDay: format(trade.createdAt, 'HH:mm'),
        dayOfWeek: format(trade.createdAt, 'EEEE')
      }
    }));
  }

  private getAmountCategory(trade: Transaction) {
    const amount = trade.fromCurrency === 'NGN' ? trade.amount : trade.convertedAmount;
    if (amount < 1000) return 'small';
    if (amount <= 10000) return 'medium';
    return 'large';
  }

  private calculateRateAccuracy(trade: Transaction) {
    // This would typically compare the used rate with historical rates
    // For now, we'll return a placeholder
    return {
      isWithinRange: true,
      deviation: 0,
      marketRate: trade.rate,
      timestamp: trade.createdAt
    };
  }

  private async getUserVerificationStatus(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    return {
      isVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      verificationStatus: user.isEmailVerified ? 'verified' : 'pending',
      lastActivity: user.updatedAt
    };
  }

  private getInitialBalance(balances: WalletBalance[]) {
    return balances.reduce((acc, balance) => {
      acc[balance.currency] = {
        initialBalance: Number(balance.balance),
        firstTransaction: balance.createdAt
      };
      return acc;
    }, {} as Record<string, { initialBalance: number; firstTransaction: Date }>);
  }

  private analyzeFundingHistory(trades: Transaction[]) {
    const funding = trades.filter(t => t.type === TransactionType.FUNDING);
    return {
      totalFunding: funding.length,
      totalAmount: funding.reduce((sum, t) => sum + t.amount, 0),
      byCurrency: this.groupByCurrency(funding),
      timeline: this.analyzeTimeline(funding)
    };
  }

  private getSupportedCurrencies(balances: WalletBalance[]) {
    return balances.map(b => b.currency);
  }

  private analyzeRateAccuracy(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!acc[pair]) {
        acc[pair] = {
          totalTrades: 0,
          accurateRates: 0,
          deviation: 0
        };
      }
      acc[pair].totalTrades++;
      // This would compare with market rates in a real implementation
      acc[pair].accurateRates++;
      return acc;
    }, {} as Record<string, { totalTrades: number; accurateRates: number; deviation: number }>);
  }

  private analyzeCachePerformance(trades: Transaction[]) {
    // This would track cache hits/misses in a real implementation
    return {
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0
    };
  }

  private analyzeRealTimeRates(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!acc[pair]) {
        acc[pair] = {
          lastRate: trade.rate,
          lastUpdate: trade.createdAt,
          updateFrequency: 0
        };
      }
      acc[pair].updateFrequency++;
      return acc;
    }, {} as Record<string, { lastRate: number; lastUpdate: Date; updateFrequency: number }>);
  }

  private analyzeNgnConversions(trades: Transaction[]) {
    return {
      totalConversions: trades.length,
      ngnToForeign: trades.filter(t => t.fromCurrency === 'NGN').length,
      foreignToNgn: trades.filter(t => t.toCurrency === 'NGN').length,
      volume: trades.reduce((sum, t) => 
        t.fromCurrency === 'NGN' ? sum + t.amount : sum + t.convertedAmount, 0
      ),
      averageRate: trades.reduce((sum, t) => sum + t.rate, 0) / trades.length
    };
  }

  private analyzeForeignConversions(trades: Transaction[]) {
    const foreignTrades = trades.filter(t => t.fromCurrency !== 'NGN' && t.toCurrency !== 'NGN');
    return {
      totalConversions: foreignTrades.length,
      byPair: this.groupByCurrencyPair(foreignTrades),
      volume: foreignTrades.reduce((sum, t) => sum + t.amount, 0)
    };
  }

  private analyzeRateEffectiveness(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!acc[pair]) {
        acc[pair] = {
          totalTrades: 0,
          successfulTrades: 0,
          averageRate: 0
        };
      }
      acc[pair].totalTrades++;
      acc[pair].successfulTrades += trade.status === TransactionStatus.COMPLETED ? 1 : 0;
      acc[pair].averageRate = (acc[pair].averageRate * (acc[pair].totalTrades - 1) + trade.rate) / acc[pair].totalTrades;
      return acc;
    }, {} as Record<string, { totalTrades: number; successfulTrades: number; averageRate: number }>);
  }

  private groupByCurrency(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const currency = trade.fromCurrency;
      if (!acc[currency]) {
        acc[currency] = {
          count: 0,
          totalAmount: 0
        };
      }
      acc[currency].count++;
      acc[currency].totalAmount += trade.amount;
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number }>);
  }

  private groupByCurrencyPair(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const pair = `${trade.fromCurrency}-${trade.toCurrency}`;
      if (!acc[pair]) {
        acc[pair] = {
          count: 0,
          totalAmount: 0,
          averageRate: 0
        };
      }
      acc[pair].count++;
      acc[pair].totalAmount += trade.amount;
      acc[pair].averageRate = (acc[pair].averageRate * (acc[pair].count - 1) + trade.rate) / acc[pair].count;
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number; averageRate: number }>);
  }

  private analyzeTimeline(trades: Transaction[]) {
    return trades.reduce((acc, trade) => {
      const date = format(trade.createdAt, 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = {
          count: 0,
          totalAmount: 0
        };
      }
      acc[date].count++;
      acc[date].totalAmount += trade.amount;
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number }>);
  }
} 