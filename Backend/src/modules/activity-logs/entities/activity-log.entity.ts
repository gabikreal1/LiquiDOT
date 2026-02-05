import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActivityType {
    INVESTMENT = 'INVESTMENT',
    WITHDRAWAL = 'WITHDRAWAL',
    LIQUIDATION = 'LIQUIDATION',
    AUTO_REBALANCE = 'AUTO_REBALANCE',
    ERROR = 'ERROR'
}

export enum ActivityStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
    CONFIRMED = 'CONFIRMED',
    FAILED = 'FAILED'
}

@Entity('activity_logs')
export class ActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ type: 'enum', enum: ActivityType })
    type: ActivityType;

    @Column({ type: 'enum', enum: ActivityStatus, default: ActivityStatus.PENDING })
    status: ActivityStatus;

    @Column({ nullable: true })
    txHash: string;

    @Column({ nullable: true })
    positionId: string;

    @Column({ type: 'json', nullable: true })
    details: any;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;
}
