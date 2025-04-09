import { IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../entities/wallet-balance.entity';

export class ConvertCurrencyDto {
  @ApiProperty({
    enum: Currency,
    example: Currency.NGN,
    description: 'Source currency to convert from',
  })
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Target currency to convert to',
  })
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({
    example: 1000,
    description: 'Amount to convert (minimum 1)',
  })
  @IsNumber()
  @Min(1)
  amount: number;
} 