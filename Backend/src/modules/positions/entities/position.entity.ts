import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pool } from '../../pools/entities/pool.entity';

export enum PositionStatus {
  PENDING_EXECUTION = 'PENDING_EXECUTION',
  ACTIVE = 'ACTIVE',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  LIQUIDATION_PENDING = 'LIQUIDATION_PENDING',
  LIQUIDATED = 'LIQUIDATED',
  FAILED = 'FAILED',
}

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 66, unique: true })
  assetHubPositionId: string; // bytes32 from contract

  @Column({ type: 'varchar', length: 66, nullable: true })
  moonbeamPositionId: string; // NFT token ID from Moonbeam

  @Column()
  userId: string;

  @Column()
  poolId: string;

  @Column({ type: 'varchar', length: 42 })
  baseAsset: string; // Token address user wants to receive back

  @Column({ type: 'decimal', precision: 78, scale: 0 })
  amount: string; // Initial investment amount in base asset (wei)

  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  liquidity: string; // Uniswap V3 liquidity amount

  @Column({ type: 'int' })
  lowerRangePercent: number; // e.g., -5 for -5%

  @Column({ type: 'int' })
  upperRangePercent: number; // e.g., +10 for +10%

  @Column({ type: 'int', nullable: true })
  lowerTick: number; // Uniswap V3 lower tick

  @Column({ type: 'int', nullable: true })
  upperTick: number; // Uniswap V3 upper tick

  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  entryPrice: string; // Price when position was opened

  @Column({ type: 'enum', enum: PositionStatus, default: PositionStatus.PENDING_EXECUTION })
  status: PositionStatus;

  /**
   * Idempotency key to avoid re-initiating liquidation for the same position
   * across retries of decision execution.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  lastWithdrawalPlanningKey?: string;

  @Column({ type: 'int' })
  chainId: number; // Destination chain (2004 for Moonbeam)

  @Column({ type: 'decimal', precision: 78, scale: 0, nullable: true })
  returnedAmount: string; // Amount returned after liquidation

  @Column({ type: 'timestamp', nullable: true })
  executedAt: Date; // When position became ACTIVE

  @Column({ type: 'timestamp', nullable: true })
  liquidatedAt: Date; // When position was closed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.positions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Pool, pool => pool.positions)
  @JoinColumn({ name: 'poolId' })
  pool: Pool;
}
