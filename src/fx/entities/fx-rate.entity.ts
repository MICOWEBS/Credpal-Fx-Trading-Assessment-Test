import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { Currency } from '../../wallet/entities/wallet-balance.entity';

@Entity('fx_rates')
export class FXRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: Currency,
  })
  fromCurrency: Currency;

  @Column({
    type: 'enum',
    enum: Currency,
  })
  toCurrency: Currency;

  @Column('decimal', { precision: 20, scale: 6 })
  rate: number;

  @Column('decimal', { precision: 20, scale: 6, nullable: true })
  bid: number;

  @Column('decimal', { precision: 20, scale: 6, nullable: true })
  ask: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;
} 