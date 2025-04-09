import { Exclude } from 'class-transformer';

export class UserResponseDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
} 