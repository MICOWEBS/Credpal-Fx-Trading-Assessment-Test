import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../auth/entities/user.entity';
import { WalletBalance } from '../wallet/entities/wallet-balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, User, WalletBalance])
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {} 