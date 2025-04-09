import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { TransactionType } from './entities/transaction.entity';
import { Request } from '@nestjs/common';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transactions' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated transactions',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getUserTransactions(
    @Request() req: { user: { id: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.transactionsService.getUserTransactions(req.user.id, page, limit);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get transactions by type' })
  @ApiParam({
    name: 'type',
    enum: TransactionType,
    example: TransactionType.FUNDING,
    description: 'Transaction type to filter by',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns transactions filtered by type',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transaction type',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getTransactionsByType(
    @Request() req: { user: { id: string } },
    @Param('type') type: TransactionType,
  ) {
    return this.transactionsService.getTransactionsByType(req.user.id, type);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns transaction statistics',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getTransactionStats(@Request() req: { user: { id: string } }) {
    return this.transactionsService.getTransactionStats(req.user.id);
  }
} 