import { Controller, Get, Post, Body, UseGuards, Request, Query, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { TransferFundsDto } from './dto/transfer-funds.dto';
import { TradeCurrencyDto } from './dto/trade-currency.dto';
import { WalletBalance } from './entities/wallet-balance.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

// Define an interface for the expected user object in the request
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    // Add other JWT payload fields if needed
  };
}

@ApiTags('Wallet & Transactions')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get authenticated user wallet balances' })
  @ApiResponse({ status: 200, description: 'Returns wallet balances', type: [WalletBalance] })
  async getMyWalletBalances(@Request() req: AuthenticatedRequest): Promise<WalletBalance[]> {
    const userId = req.user.id;
    return this.walletService.getWalletBalances(userId);
  }

  @Post('wallet/fund')
  @ApiOperation({ summary: 'Fund authenticated user wallet' })
  @ApiBody({ type: FundWalletDto })
  @ApiResponse({ status: 201, description: 'Returns funding transaction details', type: Transaction })
  async fundMyWallet(
    @Request() req: AuthenticatedRequest,
    @Body() fundWalletDto: FundWalletDto
  ): Promise<Transaction> {
    const userId = req.user.id;
    return this.walletService.fundWallet(
      userId,
      fundWalletDto.amount,
      fundWalletDto.currency,
      fundWalletDto.reference
    );
  }

  @Post('wallet/transfer')
  @ApiOperation({ summary: 'Transfer funds from authenticated user to another user' })
  @ApiBody({ type: TransferFundsDto })
  @ApiResponse({ status: 201, description: 'Returns transfer transaction details', type: Transaction })
  async transferFunds(
    @Request() req: AuthenticatedRequest,
    @Body() transferFundsDto: TransferFundsDto
  ): Promise<Transaction> {
    const fromUserId = req.user.id;
    return this.walletService.transferFunds(
      fromUserId,
      transferFundsDto.toUserId,
      transferFundsDto.amount,
      transferFundsDto.currency,
      transferFundsDto.description || ''
    );
  }

  @Post('wallet/trade')
  @ApiOperation({ summary: 'Execute a currency trade for the authenticated user' })
  @ApiBody({ type: TradeCurrencyDto })
  @ApiResponse({ status: 201, description: 'Returns trade transaction details', type: Transaction })
  async executeTrade(
    @Request() req: AuthenticatedRequest,
    @Body() tradeCurrencyDto: TradeCurrencyDto
  ): Promise<Transaction> {
      const userId = req.user.id;
      return this.walletService.executeTrade(
          userId,
          tradeCurrencyDto.fromCurrency,
          tradeCurrencyDto.toCurrency,
          tradeCurrencyDto.amount
      );
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get authenticated user transaction history' })
  @ApiResponse({ status: 200, description: 'Returns transaction history', type: [Transaction] })
  async getMyTransactions(@Request() req: AuthenticatedRequest): Promise<Transaction[]> {
    const userId = req.user.id;
    return this.walletService.getTransactions(userId);
  }
} 