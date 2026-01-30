/**
 * Positions Controller
 * 
 * REST API endpoints for position management.
 */

import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PositionsService, PositionFilterDto, PositionPnL } from './positions.service';
import { Position, PositionStatus } from './entities/position.entity';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /**
   * List all positions with optional filters
   * GET /positions?userId=xxx&status=ACTIVE&limit=20&offset=0
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('poolId') poolId?: string,
    @Query('status') status?: PositionStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Position[]> {
    const filter: PositionFilterDto = {
      userId,
      poolId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };
    return this.positionsService.findAll(filter);
  }

  /**
   * Get all active positions
   * GET /positions/active
   */
  @Get('active')
  async getActivePositions(): Promise<Position[]> {
    return this.positionsService.getActivePositions();
  }

  /**
   * Get user's positions
   * GET /positions/user/:userId
   */
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string): Promise<Position[]> {
    return this.positionsService.findByUser(userId);
  }

  /**
   * Get user's active positions
   * GET /positions/user/:userId/active
   */
  @Get('user/:userId/active')
  async getUserActivePositions(@Param('userId') userId: string): Promise<Position[]> {
    return this.positionsService.getUserActivePositions(userId);
  }

  /**
   * Get single position
   * GET /positions/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Position> {
    return this.positionsService.findOne(id);
  }

  /**
   * Get position P&L
   * GET /positions/:id/pnl
   */
  @Get(':id/pnl')
  async getPositionPnL(@Param('id') id: string): Promise<PositionPnL> {
    const position = await this.positionsService.findOne(id);
    return this.positionsService.calculatePnL(position);
  }

  /**
   * Sync position with on-chain state
   * POST /positions/:id/sync
   */
  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  async syncPosition(@Param('id') id: string): Promise<Position> {
    return this.positionsService.syncWithOnChain(id);
  }

  /**
   * Get positions by pool
   * GET /positions/pool/:poolId
   */
  @Get('pool/:poolId')
  async getPositionsByPool(@Param('poolId') poolId: string): Promise<Position[]> {
    return this.positionsService.getPositionsByPool(poolId);
  }
}
