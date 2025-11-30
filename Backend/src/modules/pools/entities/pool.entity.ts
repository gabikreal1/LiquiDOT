import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Dex } from './dex.entity';
import { Position } from '../../positions/entities/position.entity';

@Entity('pools')
export class Pool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 42 })
  poolAddress: string; // Pool contract address on Moonbeam

  @Column()
  dexId: string;

  @Column({ type: 'varchar', length: 42 })
  token0Address: string;

  @Column({ type: 'varchar', length: 42 })
  token1Address: string;

  @Column({ type: 'varchar', length: 10 })
  token0Symbol: string;

  @Column({ type: 'varchar', length: 10 })
  token1Symbol: string;

  @Column({ type: 'int' })
  fee: number; // e.g., 3000 for 0.3%

  @Column({ type: 'decimal', precision: 78, scale: 0 })
  liquidity: string; // Total pool liquidity

  @Column({ type: 'decimal', precision: 78, scale: 0 })
  sqrtPriceX96: string; // Current pool price

  @Column({ type: 'int' })
  tick: number; // Current tick

  @Column({ type: 'decimal', precision: 30, scale: 2 })
  volume24h: string; // 24h trading volume in USD

  @Column({ type: 'decimal', precision: 30, scale: 2 })
  tvl: string; // Total Value Locked in USD

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  apr: string; // Annual Percentage Rate

  // --- Internal Tracking Fields for Subgraph/Scanner ---
  @Column({ type: 'varchar', nullable: true })
  lastFeeGrowth0: string;

  @Column({ type: 'varchar', nullable: true })
  lastFeeGrowth1: string;

  @Column({ type: 'int', default: 2004 })
  chainId: number; // Moonbeam

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp' })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Dex, dex => dex.pools)
  @JoinColumn({ name: 'dexId' })
  dex: Dex;

  @OneToMany(() => Position, position => position.pool)
  positions: Position[];
}
