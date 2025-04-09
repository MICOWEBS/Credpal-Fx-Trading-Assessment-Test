import { IsNotEmpty, IsNumber, IsPositive, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../entities/wallet-balance.entity';

export class FundWalletDto {
  @ApiProperty({ description: 'User ID initiating the funding', example: 'a1b2c3d4-...' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Amount to fund', example: 1000.50 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Currency for funding', enum: Currency, example: Currency.NGN })
  @IsNotEmpty()
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Reference for the funding transaction', example: 'PAYSTACK_REF_123' })
  @IsNotEmpty()
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Idempotency key to prevent duplicate transactions', example: 'unique-idempotency-key' })
  @IsNotEmpty()
  @IsString()
  idempotencyKey: string;
} 