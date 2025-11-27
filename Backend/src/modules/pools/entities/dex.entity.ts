import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Pool } from './pool.entity';

@Entity('dexes')
export class Dex {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  name: string; // e.g., 'StellaSwap', 'BeamSwap'

  @Column({ type: 'varchar', length: 42 })
  factoryAddress: string; // UniswapV3Factory address on Moonbeam

  @Column({ type: 'varchar', length: 42 })
  routerAddress: string;

  @Column({ type: 'varchar', length: 42 })
  nonfungiblePositionManagerAddress: string; // For V3 positions

  @Column({ type: 'int', default: 2004 })
  chainId: number; // Moonbeam

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Pool, pool => pool.dex)
  pools: Pool[];
}
