import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  minApr: number; // Minimum APR in basis points (e.g., 500 = 5%)

  @Column({ type: 'decimal', precision: 30, scale: 2 })
  minTvl: string; // Minimum TVL in USD

  @Column({ type: 'int', default: -5 })
  defaultLowerRangePercent: number; // Default -5%

  @Column({ type: 'int', default: 10 })
  defaultUpperRangePercent: number; // Default +10%

  @Column({ type: 'int', default: 3600 })
  investmentCheckIntervalSeconds: number; // How often to check (1 hour)

  @Column({ type: 'json', nullable: true })
  preferredDexes: string[]; // Array of DEX names

  @Column({ type: 'json', nullable: true })
  preferredTokens: string[]; // Array of token addresses

  @Column({ type: 'boolean', default: true })
  autoInvestEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.preferences)
  @JoinColumn({ name: 'userId' })
  user: User;
}
