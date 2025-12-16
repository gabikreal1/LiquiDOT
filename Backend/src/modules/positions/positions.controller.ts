import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position, PositionStatus } from './entities/position.entity';

@Controller('users/:userId/positions')
export class PositionsController {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepo: Repository<Position>,
  ) {}

  @Get()
  async list(
    @Param('userId') userId: string,
    @Query('status') status?: PositionStatus,
  ) {
    const where: any = { userId };
    if (status) where.status = status;

    return this.positionRepo.find({
      where,
      relations: ['pool', 'pool.dex'],
      order: { createdAt: 'DESC' },
    });
  }
}
