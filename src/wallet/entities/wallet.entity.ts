import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { WalletBalance } from './wallet-balance.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 50, unique: true })
  walletId: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalBalance: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => WalletBalance, balance => balance.wallet)
  balances: WalletBalance[];

  @OneToMany(() => Transaction, transaction => transaction.wallet)
  transactions: Transaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 