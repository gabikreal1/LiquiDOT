import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pool } from './entities/pool.entity';
import { Dex } from './entities/dex.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pool, Dex])],
  providers: [],
  exports: [TypeOrmModule],
})
export class PoolsModule {}
