import { IsNotEmpty, IsNumber, IsPositive, IsEnum, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../entities/wallet-balance.entity';

export class TransferFundsDto {
  // Assuming the sender's ID comes from the authenticated user (req.user.id)
  // We only need the recipient's ID in the body.

  @ApiProperty({ description: 'Recipient User ID', example: 'b2c3d4e5-...' })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({ description: 'Amount to transfer', example: 50.00 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Currency for transfer', enum: Currency, example: Currency.USD })
  @IsNotEmpty()
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ description: 'Optional description for the transfer', example: 'Payment for services', required: false })
  @IsString()
  @ValidateIf((o) => o.description !== undefined) // Validate only if present
  description?: string; // Make optional
} 