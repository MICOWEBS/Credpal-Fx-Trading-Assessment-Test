import { Injectable, NotFoundException, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletBalance, Currency } from './entities/wallet-balance.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { FxService } from '../fx/fx.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletBalance)
    private readonly walletBalanceRepository: Repository<WalletBalance>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly fxService: FxService,
  ) {}

  private async getOrCreateBalance(
    manager: EntityManager,
    walletId: string,
    currency: Currency,
  ): Promise<WalletBalance> {
    let balance = await manager.findOne(WalletBalance, {
      where: { walletId, currency },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) {
      balance = manager.create(WalletBalance, {
        walletId,
        currency,
        balance: 0,
        lockedBalance: 0,
        availableBalance: 0,
      });
      balance = await manager.save(WalletBalance, balance);
    }
    return balance;
  }

  private async checkUserVerified(userId: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.isEmailVerified) {
      throw new HttpException('User not verified or not found', HttpStatus.FORBIDDEN);
    }
  }

  async getWalletBalances(userId: string): Promise<WalletBalance[]> {
    await this.checkUserVerified(userId);

    const wallet = await this.walletRepository.findOne({
      where: { userId },
      relations: ['balances'],
    });

    if (!wallet) {
      throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
    }

    if (!wallet.balances || wallet.balances.length === 0) {
       const queryRunner = this.dataSource.createQueryRunner();
       await queryRunner.connect();
       await queryRunner.startTransaction();
       try {
          const ngnBalance = await this.getOrCreateBalance(queryRunner.manager, wallet.id, Currency.NGN);
          await queryRunner.commitTransaction();
          return [ngnBalance];
       } catch (err: any) {
           await queryRunner.rollbackTransaction();
           this.logger.error(`Failed to ensure NGN balance for wallet ${wallet.id}: ${err.message}`);
           throw new HttpException('Failed to retrieve wallet balances', HttpStatus.INTERNAL_SERVER_ERROR);
       } finally {
           await queryRunner.release();
       }
    }

    return wallet.balances;
  }

  async fundWallet(
    userId: string,
    amount: number,
    currency: Currency,
    reference: string,
  ): Promise<Transaction> {
    await this.checkUserVerified(userId);

    if (amount <= 0) {
       throw new HttpException('Funding amount must be positive', HttpStatus.BAD_REQUEST);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
      }

      const balance = await this.getOrCreateBalance(queryRunner.manager, wallet.id, currency);

      balance.balance = Number(balance.balance) + amount;
      balance.availableBalance = Number(balance.availableBalance) + amount;

      await queryRunner.manager.save(WalletBalance, balance);

      const transactionData = {
        userId,
        walletId: wallet.id,
        type: TransactionType.FUNDING,
        status: TransactionStatus.COMPLETED,
        amount,
        fromCurrency: currency,
        toCurrency: currency,
        rate: 1,
        convertedAmount: amount,
        reference,
        description: `Wallet funded with ${amount} ${currency}`,
      };
      const transaction = queryRunner.manager.create(Transaction, transactionData);

      const savedTransaction = await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();
      return savedTransaction;

    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to fund wallet for user ${userId}: ${err.message}`);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Wallet funding failed', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }
  }

  async transferFunds(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: Currency,
    description: string,
  ): Promise<Transaction> {
    await this.checkUserVerified(fromUserId);

    if (fromUserId === toUserId) {
        throw new HttpException('Cannot transfer funds to the same user', HttpStatus.BAD_REQUEST);
    }
     if (amount <= 0) {
       throw new HttpException('Transfer amount must be positive', HttpStatus.BAD_REQUEST);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const fromWallet = await queryRunner.manager.findOne(Wallet, { where: { userId: fromUserId }, lock: { mode: 'pessimistic_write' } });
        const toWallet = await queryRunner.manager.findOne(Wallet, { where: { userId: toUserId }, lock: { mode: 'pessimistic_write' } });

        if (!fromWallet || !toWallet) {
            throw new HttpException('Sender or receiver wallet not found', HttpStatus.NOT_FOUND);
        }

        const fromBalance = await this.getOrCreateBalance(queryRunner.manager, fromWallet.id, currency);
        const toBalance = await this.getOrCreateBalance(queryRunner.manager, toWallet.id, currency);

        if (Number(fromBalance.availableBalance) < amount) {
            throw new HttpException('Insufficient available balance', HttpStatus.BAD_REQUEST);
        }

        fromBalance.balance = Number(fromBalance.balance) - amount;
        fromBalance.availableBalance = Number(fromBalance.availableBalance) - amount;
        toBalance.balance = Number(toBalance.balance) + amount;
        toBalance.availableBalance = Number(toBalance.availableBalance) + amount;

        await queryRunner.manager.save(WalletBalance, [fromBalance, toBalance]);

        const transactionData = {
            userId: fromUserId,
            walletId: fromWallet.id,
            type: TransactionType.TRANSFER,
            status: TransactionStatus.COMPLETED,
            amount,
            fromCurrency: currency,
            toCurrency: currency,
            rate: 1,
            convertedAmount: amount,
            description: description || `Transfer to user ${toUserId}`,
        };
        const transaction = queryRunner.manager.create(Transaction, transactionData);

        const savedTransaction = await queryRunner.manager.save(Transaction, transaction);

        await queryRunner.commitTransaction();
        return savedTransaction;

    } catch (err: any) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Failed to transfer funds from ${fromUserId} to ${toUserId}: ${err.message}`);
        if (err instanceof HttpException) throw err;
        throw new HttpException('Fund transfer failed', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
        await queryRunner.release();
    }
  }

  async executeTrade(
    userId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: number
  ): Promise<Transaction> {
     await this.checkUserVerified(userId);

     if (fromCurrency === toCurrency) {
        throw new HttpException('Cannot trade the same currency', HttpStatus.BAD_REQUEST);
     }
     if (amount <= 0) {
       throw new HttpException('Trade amount must be positive', HttpStatus.BAD_REQUEST);
    }

     const queryRunner = this.dataSource.createQueryRunner();
     await queryRunner.connect();
     await queryRunner.startTransaction();

     try {
        const wallet = await queryRunner.manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
        if (!wallet) {
             throw new HttpException('Wallet not found', HttpStatus.NOT_FOUND);
        }

        const ratesData = await this.fxService.getRates(fromCurrency);
        const rate = ratesData.rates[toCurrency];
        if (!rate) {
            throw new HttpException(`Exchange rate not available for ${fromCurrency} to ${toCurrency}`, HttpStatus.SERVICE_UNAVAILABLE);
        }
        const convertedAmount = amount * rate;

        const fromBalance = await this.getOrCreateBalance(queryRunner.manager, wallet.id, fromCurrency);
        const toBalance = await this.getOrCreateBalance(queryRunner.manager, wallet.id, toCurrency);

        if (Number(fromBalance.availableBalance) < amount) {
             throw new HttpException(`Insufficient ${fromCurrency} balance`, HttpStatus.BAD_REQUEST);
        }

        fromBalance.balance = Number(fromBalance.balance) - amount;
        fromBalance.availableBalance = Number(fromBalance.availableBalance) - amount;
        toBalance.balance = Number(toBalance.balance) + convertedAmount;
        toBalance.availableBalance = Number(toBalance.availableBalance) + convertedAmount;

        await queryRunner.manager.save(WalletBalance, [fromBalance, toBalance]);

        const transactionData = {
             userId,
             walletId: wallet.id,
             type: TransactionType.TRADE,
             status: TransactionStatus.COMPLETED,
             amount,
             fromCurrency,
             toCurrency,
             rate,
             convertedAmount,
             description: `Trade ${amount} ${fromCurrency} for ${convertedAmount.toFixed(8)} ${toCurrency} at rate ${rate}`,
         };
        const transaction = queryRunner.manager.create(Transaction, transactionData);

        const savedTransaction = await queryRunner.manager.save(Transaction, transaction);

        await queryRunner.commitTransaction();
        return savedTransaction;

     } catch (err: any) {
         await queryRunner.rollbackTransaction();
         this.logger.error(`Trade failed for user ${userId} (${amount} ${fromCurrency} to ${toCurrency}): ${err.message}`);
         if (err instanceof HttpException) throw err;
         throw new HttpException('Trade execution failed', HttpStatus.INTERNAL_SERVER_ERROR);
     } finally {
         await queryRunner.release();
     }
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    await this.checkUserVerified(userId);
    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
} 