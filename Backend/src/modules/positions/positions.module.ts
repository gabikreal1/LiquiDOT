import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './entities/position.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Position])],
  providers: [],
  exports: [TypeOrmModule],
})
export class PositionsModule {}
