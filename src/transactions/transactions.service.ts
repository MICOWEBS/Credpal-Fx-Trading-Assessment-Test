import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from './entities/transaction.entity';
import { Currency } from '../wallet/entities/wallet-balance.entity';

interface CreateTransactionParams {
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
  rate: number;
  convertedAmount: number;
  reference?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async createTransaction(params: CreateTransactionParams) {
    const transaction = this.transactionRepository.create({
      userId: params.userId,
      type: params.type,
      status: params.status,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      amount: params.amount,
      rate: params.rate,
      convertedAmount: params.convertedAmount,
      reference: params.reference,
      description: params.metadata ? JSON.stringify(params.metadata) : undefined,
    });

    return this.transactionRepository.save(transaction);
  }

  async getUserTransactions(userId: string, page = 1, limit = 10) {
    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionsByType(userId: string, type: TransactionType) {
    return this.transactionRepository.find({
      where: { userId, type },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionStats(userId: string) {
    const stats = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(transaction.amount)', 'totalAmount')
      .where('transaction.userId = :userId', { userId })
      .groupBy('transaction.type')
      .getRawMany();

    return stats.reduce((acc, stat) => {
      acc[stat.type] = {
        count: parseInt(stat.count),
        totalAmount: parseFloat(stat.totalAmount),
      };
      return acc;
    }, {});
  }
} 