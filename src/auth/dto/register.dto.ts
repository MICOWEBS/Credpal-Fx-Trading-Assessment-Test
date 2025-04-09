import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'StrongP@ssw0rd',
    description: 'User password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;
} 