import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Pool } from './entities/pool.entity';

export interface PoolFilterDto {
  minTvl?: number;
  minApr?: number;
  minVolume?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
  ) {}

  async findAll(filter: PoolFilterDto): Promise<Pool[]> {
    const query = this.poolRepository.createQueryBuilder('pool')
      .leftJoinAndSelect('pool.dex', 'dex')
      .where('pool.isActive = :isActive', { isActive: true });

    if (filter.minTvl) {
      query.andWhere('pool.tvl >= :minTvl', { minTvl: filter.minTvl });
    }

    if (filter.minApr) {
      query.andWhere('pool.apr >= :minApr', { minApr: filter.minApr });
    }

    if (filter.minVolume) {
      query.andWhere('pool.volume24h >= :minVolume', { minVolume: filter.minVolume });
    }

    query.orderBy('pool.tvl', 'DESC');
    
    if (filter.limit) {
      query.take(filter.limit);
    }
    
    if (filter.offset) {
      query.skip(filter.offset);
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Pool> {
    return this.poolRepository.findOne({ where: { id }, relations: ['dex'] });
  }
}
