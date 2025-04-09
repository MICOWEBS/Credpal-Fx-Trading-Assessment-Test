import { IsNotEmpty, IsNumber, IsPositive, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../entities/wallet-balance.entity';

export class TradeCurrencyDto {
  @ApiProperty({ description: 'Currency to trade from', enum: Currency, example: Currency.NGN })
  @IsNotEmpty()
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({ description: 'Currency to trade to', enum: Currency, example: Currency.USD })
  @IsNotEmpty()
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({ description: 'Amount of fromCurrency to trade', example: 10000 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;
} 