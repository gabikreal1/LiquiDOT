import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Position } from '../positions/entities/position.entity';
import { Pool } from '../pools/entities/pool.entity';
import { ActivityLog } from '../activity-logs/entities/activity-log.entity';
import { UsersModule } from '../users/users.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, Pool, ActivityLog]),
    UsersModule,
    BlockchainModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
