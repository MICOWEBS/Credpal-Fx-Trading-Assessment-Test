import { IsNotEmpty, IsNumber, IsPositive, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../wallet/entities/wallet-balance.entity'; // Adjust path if needed

export class ConvertCurrencyDto {
  @ApiProperty({ description: 'Currency to convert from', enum: Currency, example: Currency.NGN })
  @IsNotEmpty()
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({ description: 'Currency to convert to', enum: Currency, example: Currency.USD })
  @IsNotEmpty()
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({ description: 'Amount of fromCurrency to convert', example: 1000 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;
} 