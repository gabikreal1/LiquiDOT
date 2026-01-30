import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { InvestmentDecisionService } from './investment-decision.service';
import { InvestmentDecisionWorker } from './investment-decision.worker';
import { InvestmentDecisionController } from './investment-decision.controller';
import { Pool } from '../pools/entities/pool.entity';
import { Position } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pool, Position, User, UserPreference]),
    ScheduleModule.forRoot(),
    BlockchainModule,
  ],
  controllers: [InvestmentDecisionController],
  providers: [InvestmentDecisionService, InvestmentDecisionWorker],
  exports: [InvestmentDecisionService],
})
export class InvestmentDecisionModule {}
