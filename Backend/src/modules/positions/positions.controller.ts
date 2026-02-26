/**
 * Positions Controller
 *
 * REST API endpoints for position management.
 * All endpoints require JWT authentication.
 * IDOR checks ensure users can only access their own positions.
 */

import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService, PositionFilterDto, PositionPnL } from './positions.service';
import { Position, PositionStatus } from './entities/position.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('positions')
@ApiBearerAuth()
@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /**
   * List authenticated user's positions with optional filters
   * GET /positions?status=ACTIVE&limit=20&offset=0 — AUTH
   */
  @Get()
  async findAll(
    @CurrentUser() currentUser: User,
    @Query('poolId') poolId?: string,
    @Query('status') status?: PositionStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Position[]> {
    const filter: PositionFilterDto = {
      userId: currentUser.id,
      poolId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };
    return this.positionsService.findAll(filter);
  }

  /**
   * Get authenticated user's active positions
   * GET /positions/active — AUTH
   */
  @Get('active')
  async getActivePositions(@CurrentUser() currentUser: User): Promise<Position[]> {
    return this.positionsService.getUserActivePositions(currentUser.id);
  }

  /**
   * Get user's positions
   * GET /positions/user/:userId — AUTH + IDOR
   */
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<Position[]> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.positionsService.findByUser(userId);
  }

  /**
   * Get user's active positions
   * GET /positions/user/:userId/active — AUTH + IDOR
   */
  @Get('user/:userId/active')
  async getUserActivePositions(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<Position[]> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.positionsService.getUserActivePositions(userId);
  }

  /**
   * Get single position
   * GET /positions/:id — AUTH + IDOR
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<Position> {
    const position = await this.positionsService.findOne(id);
    if (position.userId !== currentUser.id) throw new ForbiddenException();
    return position;
  }

  /**
   * Get position P&L
   * GET /positions/:id/pnl — AUTH + IDOR
   */
  @Get(':id/pnl')
  async getPositionPnL(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<PositionPnL> {
    const position = await this.positionsService.findOne(id);
    if (position.userId !== currentUser.id) throw new ForbiddenException();
    return this.positionsService.calculatePnL(position);
  }

  /**
   * Liquidate a position: remove LP, swap to base asset, return to Asset Hub.
   * Beneficiary is always the position owner (no recipientAddress override).
   * POST /positions/:id/liquidate — AUTH + IDOR
   */
  @ApiOperation({ summary: 'Liquidate position and return assets to Asset Hub' })
  @Post(':id/liquidate')
  @HttpCode(HttpStatus.OK)
  async liquidatePosition(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Body() body?: { baseAsset?: string },
  ): Promise<Position> {
    const position = await this.positionsService.findOne(id);
    if (position.userId !== currentUser.id) throw new ForbiddenException();
    return this.positionsService.liquidate(id, body);
  }

  /**
   * Sync position with on-chain state
   * POST /positions/:id/sync — AUTH + IDOR
   */
  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  async syncPosition(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<Position> {
    const position = await this.positionsService.findOne(id);
    if (position.userId !== currentUser.id) throw new ForbiddenException();
    return this.positionsService.syncWithOnChain(id);
  }

  /**
   * Get authenticated user's positions in a specific pool
   * GET /positions/pool/:poolId — AUTH
   */
  @Get('pool/:poolId')
  async getPositionsByPool(@Param('poolId') poolId: string, @CurrentUser() currentUser: User): Promise<Position[]> {
    return this.positionsService.findAll({ poolId, userId: currentUser.id });
  }
}
