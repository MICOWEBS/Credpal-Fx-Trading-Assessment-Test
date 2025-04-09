import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Wallet } from '../../wallet/entities/wallet.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ nullable: true })
  verificationToken: string;

  @Column({ nullable: true })
  verificationTokenExpires: Date;

  @Column({ default: false })
  isEmailVerified: boolean;

  @OneToMany(() => Wallet, wallet => wallet.user)
  wallets: Wallet[];

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions: Transaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 