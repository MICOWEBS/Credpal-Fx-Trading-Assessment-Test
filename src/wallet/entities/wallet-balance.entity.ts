import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Wallet } from './wallet.entity';

export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

@Entity('wallet_balances')
export class WalletBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.NGN
  })
  currency: Currency;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  lockedBalance: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  availableBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 