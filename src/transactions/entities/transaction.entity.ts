import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';

export enum TransactionType {
  FUNDING = 'FUNDING',
  CONVERSION = 'CONVERSION',
  TRADE = 'TRADE',
  TRANSFER = 'TRANSFER'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  fromCurrency: string;

  @Column({ type: 'varchar', length: 3 })
  toCurrency: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  rate: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  convertedAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 