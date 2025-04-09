import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from './entities/wallet.entity';
import { WalletBalance } from './entities/wallet-balance.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../auth/entities/user.entity';
import { FxService } from '../fx/fx.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletBalance, Transaction, User]),
    HttpModule,
    ConfigModule,
    CacheModule.register(),
    RedisModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, FxService],
  exports: [WalletService],
})
export class WalletModule {} 