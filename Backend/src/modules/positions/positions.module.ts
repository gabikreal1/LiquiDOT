import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './entities/position.entity';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position]),
    BlockchainModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [TypeOrmModule, PositionsService],
})
export class PositionsModule {}
