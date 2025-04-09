import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { WalletBalance } from './entities/wallet-balance.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FxService } from '../fx/fx.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepository: Repository<Wallet>;
  let walletBalanceRepository: Repository<WalletBalance>;
  let transactionRepository: Repository<Transaction>;
  let fxService: FxService;
  let mockWalletRepository: any;
  let mockWalletBalanceRepository: any;
  let mockTransactionRepository: any;
  let mockDataSource: any;
  let mockEntityManager: any;
  let mockQueryRunner: any;

  const mockWallet = {
    id: '1',
    userId: 'user1',
    balances: [],
  };

  const mockWalletBalance = {
    id: '1',
    walletId: '1',
    currency: 'NGN',
    balance: 1000,
  };

  const mockFxService = {
    getExchangeRate: jest.fn(),
    convertCurrency: jest.fn(),
  };

  beforeEach(async () => {
    // Mock EntityManager with typed Jest mocks
    mockEntityManager = {
      findOne: jest.fn() as jest.MockedFunction<typeof EntityManager.prototype.findOne>,
      create: jest.fn() as jest.MockedFunction<typeof EntityManager.prototype.create>,
      save: jest.fn() as jest.MockedFunction<typeof EntityManager.prototype.save>,
    };

    // Mock QueryRunner
    mockQueryRunner = {
      manager: mockEntityManager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as unknown as QueryRunner;

    // Mock DataSource
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    // Mock Repositories
    mockWalletRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockWalletBalanceRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockTransactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: getRepositoryToken(WalletBalance),
          useValue: mockWalletBalanceRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: FxService,
          useValue: mockFxService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    walletBalanceRepository = module.get<Repository<WalletBalance>>(
      getRepositoryToken(WalletBalance),
    );
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    fxService = module.get<FxService>(FxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fundWallet', () => {
    const fundWalletDto = {
      userId: mockWallet.userId,
      amount: 100,
      currency: Currency.USD,
    };

    it('should successfully fund wallet with new currency', async () => {
      // Setup mocks
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockImplementation((entityType: any, data: any) => data);
      mockEntityManager.save.mockImplementation(async (entityType: any, entity: any) => entity);

      const result = await service.fundWallet(
        fundWalletDto.userId,
        fundWalletDto.amount,
        fundWalletDto.currency,
        'Test funding',
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        WalletBalance,
        expect.objectContaining({
          walletId: mockWallet.id,
          currency: fundWalletDto.currency,
          balance: fundWalletDto.amount,
        }),
      );
    });

    it('should successfully fund existing wallet balance', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne.mockResolvedValue(mockWalletBalance);
      mockEntityManager.save.mockImplementation(async (entityType: any, entity: any) => entity);

      const result = await service.fundWallet(
        fundWalletDto.userId,
        fundWalletDto.amount,
        fundWalletDto.currency,
        'Test funding',
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        WalletBalance,
        expect.objectContaining({
          balance: mockWalletBalance.balance + fundWalletDto.amount,
        }),
      );
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.fundWallet(
          fundWalletDto.userId,
          fundWalletDto.amount,
          fundWalletDto.currency,
          'Test funding',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback transaction on error', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.fundWallet(
          fundWalletDto.userId,
          fundWalletDto.amount,
          fundWalletDto.currency,
          'Test funding',
        ),
      ).rejects.toThrow('Failed to fund wallet');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('transferFunds', () => {
    const transferDto = {
      senderId: mockWallet.userId,
      recipientId: 'user2',
      amount: 100,
      currency: Currency.USD,
    };

    const mockRecipientWallet = {
      id: 'wallet-2',
      userId: transferDto.recipientId,
      walletId: 'WALLET456',
      totalBalance: 500,
      isActive: true,
    };

    const mockSenderBalance = {
      ...mockWalletBalance,
      balance: 1000,
    };

    const mockRecipientBalance = {
      id: 'balance-2',
      walletId: mockRecipientWallet.id,
      currency: Currency.USD,
      balance: 500,
      lockedBalance: 0,
    };

    it('should successfully transfer funds between wallets', async () => {
      // Setup mocks
      mockWalletRepository.findOne
        .mockResolvedValueOnce(mockWallet) // Sender wallet
        .mockResolvedValueOnce(mockRecipientWallet); // Recipient wallet
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce(mockSenderBalance) // Sender balance
        .mockResolvedValueOnce(mockRecipientBalance); // Recipient balance
      mockEntityManager.save.mockImplementation(async (entityType: any, entity: any) => entity);

      const result = await service.transferFunds(
        transferDto.senderId,
        transferDto.recipientId,
        transferDto.amount,
        transferDto.currency,
        'Test transfer',
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledTimes(4); // Two balances and two transactions
    });

    it('should throw NotFoundException if sender wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.transferFunds(
          transferDto.senderId,
          transferDto.recipientId,
          transferDto.amount,
          transferDto.currency,
          'Test transfer',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if insufficient funds', async () => {
      mockWalletRepository.findOne
        .mockResolvedValueOnce(mockWallet)
        .mockResolvedValueOnce(mockRecipientWallet);
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce({ ...mockSenderBalance, balance: 50 })
        .mockResolvedValueOnce(mockRecipientBalance);

      await expect(
        service.transferFunds(
          transferDto.senderId,
          transferDto.recipientId,
          transferDto.amount,
          transferDto.currency,
          'Test transfer',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback transaction on error', async () => {
      mockWalletRepository.findOne
        .mockResolvedValueOnce(mockWallet)
        .mockResolvedValueOnce(mockRecipientWallet);
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce(mockSenderBalance)
        .mockRejectedValue(new Error('DB error'));

      await expect(
        service.transferFunds(
          transferDto.senderId,
          transferDto.recipientId,
          transferDto.amount,
          transferDto.currency,
          'Test transfer',
        ),
      ).rejects.toThrow('Failed to transfer funds');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('executeTrade', () => {
    const tradeDto = {
      userId: mockWallet.userId,
      fromCurrency: Currency.USD,
      toCurrency: Currency.EUR,
      amount: 100,
    };

    const mockFromBalance = {
      ...mockWalletBalance,
      currency: Currency.USD,
      balance: 1000,
    };

    const mockToBalance = {
      id: 'balance-2',
      walletId: mockWallet.id,
      currency: Currency.EUR,
      balance: 0,
      lockedBalance: 0,
    };

    it('should successfully execute currency trade', async () => {
      // Setup mocks
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce(mockFromBalance)
        .mockResolvedValueOnce(mockToBalance);
      mockFxService.getExchangeRate.mockResolvedValue(0.85);
      mockEntityManager.save.mockImplementation(async (entityType: any, entity: any) => entity);

      const result = await service.executeTrade(
        tradeDto.userId,
        tradeDto.fromCurrency,
        tradeDto.toCurrency,
        tradeDto.amount,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledTimes(4); // Two balances and two transactions
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.executeTrade(
          tradeDto.userId,
          tradeDto.fromCurrency,
          tradeDto.toCurrency,
          tradeDto.amount,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if insufficient funds', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce({ ...mockFromBalance, balance: 50 })
        .mockResolvedValueOnce(mockToBalance);

      await expect(
        service.executeTrade(
          tradeDto.userId,
          tradeDto.fromCurrency,
          tradeDto.toCurrency,
          tradeDto.amount,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback transaction on error', async () => {
      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletBalanceRepository.findOne
        .mockResolvedValueOnce(mockFromBalance)
        .mockRejectedValue(new Error('DB error'));

      await expect(
        service.executeTrade(
          tradeDto.userId,
          tradeDto.fromCurrency,
          tradeDto.toCurrency,
          tradeDto.amount,
        ),
      ).rejects.toThrow('Failed to execute trade');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
}); 