import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BlockchainModule } from '../blockchain/blockchain.module';
import { Pool } from '../pools/entities/pool.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { Position } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { InvestmentDecisionService } from './investment-decision.service';
import { InvestmentDecisionController } from './investment-decision.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pool, UserPreference, Position, User]),
    BlockchainModule,
  ],
  controllers: [InvestmentDecisionController],
  providers: [InvestmentDecisionService],
  exports: [InvestmentDecisionService],
})
export class InvestmentDecisionModule {}
