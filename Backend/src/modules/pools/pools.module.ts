import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pool } from './entities/pool.entity';
import { Dex } from './entities/dex.entity';
import { PoolScannerService } from './pool-scanner.service';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pool, Dex])],
  controllers: [PoolsController],
  providers: [PoolScannerService, PoolsService],
  exports: [TypeOrmModule, PoolScannerService, PoolsService],
})
export class PoolsModule {}
