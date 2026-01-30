import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Token risk tiers for Impermanent Loss calculation
 * From defi_investment_bot_spec.md Section 8.4
 */
export enum TokenRiskTier {
  STABLE = 'STABLE',       // IL factor 0.00 (USDC, USDT, DAI)
  BLUECHIP = 'BLUECHIP',   // IL factor 0.08 (ETH, WETH, WBTC)
  MIDCAP = 'MIDCAP',       // IL factor 0.18 (AAVE, UNI, etc.)
  HIGH_RISK = 'HIGH_RISK', // IL factor 0.30 (all others)
}

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  // === Investment Strategy Parameters (from defi_investment_bot_spec.md) ===

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 8.0 })
  minApy: string; // Minimum acceptable APY (e.g., 8%)

  @Column({ type: 'int', default: 6 })
  maxPositions: number; // Maximum concurrent positions (e.g., 6)

  @Column({ type: 'decimal', precision: 30, scale: 2, default: '25000' })
  maxAllocPerPositionUsd: string; // Maximum allocation per position in USD

  @Column({ type: 'int', default: 8 })
  dailyRebalanceLimit: number; // Maximum rebalances per day

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '1.00' })
  expectedGasUsd: string; // Expected gas cost in USD (default $1)

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.5' })
  lambdaRiskAversion: string; // Risk aversion parameter λ (0.0 = risk neutral, 1.0 = risk averse)

  @Column({ type: 'decimal', precision: 5, scale: 4, default: '0.0' })
  thetaMinBenefit: string; // Minimum net benefit threshold θ

  @Column({ type: 'int', default: 7 })
  planningHorizonDays: number; // Planning horizon in days for rebalancing decisions

  // === Pool Filtering Parameters ===

  @Column({ type: 'decimal', precision: 30, scale: 2, default: '1000000' })
  minTvlUsd: string; // Minimum TVL in USD (default $1M)

  @Column({ type: 'int', default: 14 })
  minPoolAgeDays: number; // Minimum pool age in days

  @Column({ type: 'json', nullable: true })
  allowedTokens: string[]; // Array of allowed token symbols (e.g., ["USDC", "USDT", "WETH"])

  @Column({ type: 'json', nullable: true })
  preferredDexes: string[]; // Array of preferred DEX names

  // === Position Range Parameters ===

  @Column({ type: 'int', default: -5 })
  defaultLowerRangePercent: number; // Default -5%

  @Column({ type: 'int', default: 10 })
  defaultUpperRangePercent: number; // Default +10%

  // === Safety Parameters ===

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '6.0' })
  maxIlLossPercent: string; // Max IL loss before postponing exit (default 6%)

  @Column({ type: 'decimal', precision: 30, scale: 2, default: '3000' })
  minPositionSizeUsd: string; // Minimum position size (not worth gas below this)

  // === Automation ===

  @Column({ type: 'boolean', default: true })
  autoInvestEnabled: boolean;

  @Column({ type: 'int', default: 14400 })
  investmentCheckIntervalSeconds: number; // How often to check (default 4 hours = 14400s)

  // === Legacy fields (kept for backward compatibility) ===

  @Column({ type: 'int', nullable: true })
  minApr: number; // Deprecated: use minApy instead

  @Column({ type: 'decimal', precision: 30, scale: 2, nullable: true })
  minTvl: string; // Deprecated: use minTvlUsd instead

  @Column({ type: 'json', nullable: true })
  preferredTokens: string[]; // Deprecated: use allowedTokens instead

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.preferences)
  @JoinColumn({ name: 'userId' })
  user: User;
}
