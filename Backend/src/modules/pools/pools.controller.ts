import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PoolsService } from './pools.service';
import { PoolsQueryDto } from './dto/pools-query.dto';
import { PoolScannerService } from './pool-scanner.service';

@Controller('pools')
export class PoolsController {
  constructor(
    private readonly poolsService: PoolsService,
    private readonly poolScannerService: PoolScannerService,
  ) {}

  @Get()
  async list(@Query() query: PoolsQueryDto) {
    return this.poolsService.findAll(query);
  }

  /**
   * Lightweight status for checking whether pool syncing is configured.
   */
  @Get('sync/status')
  async syncStatus() {
    return {
      configured: Boolean(process.env.ALGEBRA_SUBGRAPH_URL),
      subgraphUrl: process.env.ALGEBRA_SUBGRAPH_URL || null,
    };
  }

  /**
   * Manually triggers a subgraph sync.
   * Useful for ops/dev so you don't have to wait for the interval.
   */
  @Post('sync')
  async syncNow() {
    await this.poolScannerService.syncPools();
    return { ok: true };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.poolsService.findOne(id);
  }
}
