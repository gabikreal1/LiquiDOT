import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { typeOrmConfig } from './config/typeorm.config';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { PoolsModule } from './modules/pools/pools.module';
import { PositionsModule } from './modules/positions/positions.module';
import { InvestmentDecisionModule } from './modules/investment-decision/investment-decision.module';
import { StopLossWorkerModule } from './modules/stop-loss-worker/stop-loss-worker.module';
import { UsersModule } from './modules/users/users.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRoot(typeOrmConfig),

    // Schedule for cron jobs
    ScheduleModule.forRoot(),

    // HTTP client
    HttpModule,

    // Feature modules
    BlockchainModule,
    PoolsModule,
    PositionsModule,
    InvestmentDecisionModule,
    StopLossWorkerModule,
    UsersModule,
    PreferencesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
