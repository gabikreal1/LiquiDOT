/**
 * Pools Controller
 * 
 * REST API endpoints for pool data.
 */

import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PoolsService, PoolFilterDto } from './pools.service';
import { Pool } from './entities/pool.entity';

@Controller('pools')
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  /**
   * List pools with filters
   * GET /pools?minTvl=1000000&minApr=5&limit=20
   */
  @Get()
  async findAll(
    @Query('minTvl') minTvl?: string,
    @Query('minApr') minApr?: string,
    @Query('minVolume') minVolume?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Pool[]> {
    const filter: PoolFilterDto = {
      minTvl: minTvl ? parseFloat(minTvl) : undefined,
      minApr: minApr ? parseFloat(minApr) : undefined,
      minVolume: minVolume ? parseFloat(minVolume) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };
    return this.poolsService.findAll(filter);
  }

  /**
   * Get top pools by APR
   * GET /pools/top?limit=10
   */
  @Get('top')
  async getTopPools(@Query('limit') limit?: string): Promise<Pool[]> {
    return this.poolsService.findAll({
      minTvl: 1000000, // $1M minimum
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * Search pools by token
   * GET /pools/search?token=USDC
   */
  @Get('search')
  async searchByToken(@Query('token') token: string): Promise<Pool[]> {
    // This would need to be implemented in PoolsService
    // For now, return all and filter client-side
    const pools = await this.poolsService.findAll({});
    return pools.filter(p => 
      p.token0Symbol.toUpperCase().includes(token.toUpperCase()) ||
      p.token1Symbol.toUpperCase().includes(token.toUpperCase())
    );
  }

  /**
   * Get pool details
   * GET /pools/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Pool> {
    return this.poolsService.findOne(id);
  }
}
