import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Position } from '../../positions/entities/position.entity';
import { UserPreference } from '../../preferences/entities/user-preference.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  walletAddress: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Position, position => position.user)
  positions: Position[];

  @OneToMany(() => UserPreference, preference => preference.user)
  preferences: UserPreference[];
}
