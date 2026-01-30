import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StopLossService } from './stop-loss.service';
import { Position } from '../positions/entities/position.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position]),
    ScheduleModule.forRoot(),
    BlockchainModule,
  ],
  providers: [StopLossService],
  exports: [StopLossService],
})
export class StopLossWorkerModule {}
