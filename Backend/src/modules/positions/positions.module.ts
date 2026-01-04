import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { Pool } from '../pools/entities/pool.entity';
import { User } from '../users/entities/user.entity';
import { Position } from './entities/position.entity';
import { PositionsController } from './positions.controller';
import { PositionSyncService } from './position-sync.service';
import { PositionEventsService } from './position-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([Position, Pool, User]), BlockchainModule],
  controllers: [PositionsController],
  providers: [PositionSyncService, PositionEventsService],
  exports: [TypeOrmModule],
})
export class PositionsModule {}

