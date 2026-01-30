/**
 * Positions Service
 * 
 * CRUD operations for Position entity.
 * Syncs position status with on-chain state.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Position, PositionStatus } from './entities/position.entity';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';

export interface CreatePositionDto {
  userId: string;
  poolId: string;
  assetHubPositionId: string;
  baseAsset: string;
  amount: string;
  lowerRangePercent: number;
  upperRangePercent: number;
  chainId?: number;
}

export interface UpdatePositionDto {
  moonbeamPositionId?: string;
  liquidity?: string;
  lowerTick?: number;
  upperTick?: number;
  entryPrice?: string;
  status?: PositionStatus;
  returnedAmount?: string;
  executedAt?: Date;
  liquidatedAt?: Date;
}

export interface PositionFilterDto {
  userId?: string;
  poolId?: string;
  status?: PositionStatus | PositionStatus[];
  limit?: number;
  offset?: number;
}

export interface PositionPnL {
  positionId: string;
  entryAmountUsd: number;
  currentValueUsd: number;
  feesEarnedUsd: number;
  ilLossUsd: number;
  netPnLUsd: number;
  netPnLPercent: number;
}

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private moonbeamService: MoonbeamService,
  ) {}

  /**
   * Create a new position record
   */
  async create(data: CreatePositionDto): Promise<Position> {
    const position = this.positionRepository.create({
      ...data,
      status: PositionStatus.PENDING_EXECUTION,
      chainId: data.chainId || 2004, // Default to Moonbeam
    });

    const saved = await this.positionRepository.save(position);
    this.logger.log(`Created position ${saved.id} for user ${data.userId}`);
    return saved;
  }

  /**
   * Find all positions with optional filters
   */
  async findAll(filter: PositionFilterDto): Promise<Position[]> {
    const query = this.positionRepository.createQueryBuilder('position')
      .leftJoinAndSelect('position.pool', 'pool')
      .leftJoinAndSelect('pool.dex', 'dex');

    if (filter.userId) {
      query.andWhere('position.userId = :userId', { userId: filter.userId });
    }

    if (filter.poolId) {
      query.andWhere('position.poolId = :poolId', { poolId: filter.poolId });
    }

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        query.andWhere('position.status IN (:...statuses)', { statuses: filter.status });
      } else {
        query.andWhere('position.status = :status', { status: filter.status });
      }
    }

    query.orderBy('position.createdAt', 'DESC');

    if (filter.limit) {
      query.take(filter.limit);
    }

    if (filter.offset) {
      query.skip(filter.offset);
    }

    return query.getMany();
  }

  /**
   * Find a single position by ID
   */
  async findOne(id: string): Promise<Position> {
    const position = await this.positionRepository.findOne({
      where: { id },
      relations: ['pool', 'pool.dex', 'user'],
    });

    if (!position) {
      throw new NotFoundException(`Position ${id} not found`);
    }

    return position;
  }

  /**
   * Find all positions for a user
   */
  async findByUser(userId: string): Promise<Position[]> {
    return this.findAll({ userId });
  }

  /**
   * Find positions by status
   */
  async findByStatus(status: PositionStatus | PositionStatus[]): Promise<Position[]> {
    return this.findAll({ status });
  }

  /**
   * Update a position
   */
  async update(id: string, data: UpdatePositionDto): Promise<Position> {
    await this.positionRepository.update(id, data);
    return this.findOne(id);
  }

  /**
   * Sync position with on-chain state from Moonbeam
   */
  async syncWithOnChain(positionId: string): Promise<Position> {
    const position = await this.findOne(positionId);

    if (!position.moonbeamPositionId) {
      this.logger.warn(`Position ${positionId} has no Moonbeam ID, cannot sync`);
      return position;
    }

    try {
      const moonbeamPos = await this.moonbeamService.getPosition(
        parseInt(position.moonbeamPositionId)
      );

      if (moonbeamPos) {
        await this.positionRepository.update(positionId, {
          liquidity: moonbeamPos.liquidity.toString(),
          lowerTick: moonbeamPos.bottomTick,
          upperTick: moonbeamPos.topTick,
          entryPrice: moonbeamPos.entryPrice.toString(),
        });
      }

      // Check if out of range
      const rangeCheck = await this.moonbeamService.isPositionOutOfRange(
        parseInt(position.moonbeamPositionId)
      );

      if (rangeCheck.outOfRange && position.status === PositionStatus.ACTIVE) {
        await this.positionRepository.update(positionId, {
          status: PositionStatus.OUT_OF_RANGE,
        });
      }

      return this.findOne(positionId);
    } catch (error) {
      this.logger.error(`Error syncing position ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * Mark position as executed (after XCM completes on Moonbeam)
   */
  async markAsExecuted(
    id: string, 
    moonbeamPositionId: string, 
    liquidity: string,
    entryPrice?: string
  ): Promise<Position> {
    await this.positionRepository.update(id, {
      moonbeamPositionId,
      liquidity,
      entryPrice,
      status: PositionStatus.ACTIVE,
      executedAt: new Date(),
    });

    this.logger.log(`Position ${id} marked as ACTIVE with Moonbeam ID ${moonbeamPositionId}`);
    return this.findOne(id);
  }

  /**
   * Mark position as liquidated
   */
  async markAsLiquidated(id: string, returnedAmount: string): Promise<Position> {
    await this.positionRepository.update(id, {
      returnedAmount,
      status: PositionStatus.LIQUIDATED,
      liquidatedAt: new Date(),
    });

    this.logger.log(`Position ${id} marked as LIQUIDATED, returned: ${returnedAmount}`);
    return this.findOne(id);
  }

  /**
   * Calculate P&L for a position
   */
  async calculatePnL(position: Position): Promise<PositionPnL> {
    const entryAmount = parseFloat(position.amount) / 1e18;
    let currentValue = entryAmount;
    let feesEarned = 0;

    // If position is still active, fetch current value from Moonbeam
    if (position.moonbeamPositionId && position.status === PositionStatus.ACTIVE) {
      try {
        const fees = await this.moonbeamService.collectFees(
          parseInt(position.moonbeamPositionId)
        );
        feesEarned = Number(fees.amount0 + fees.amount1) / 1e18;
        // TODO: Calculate current position value based on liquidity
      } catch (error) {
        this.logger.warn(`Could not fetch fees for position ${position.id}`);
      }
    }

    // If liquidated, use returned amount
    if (position.status === PositionStatus.LIQUIDATED && position.returnedAmount) {
      currentValue = parseFloat(position.returnedAmount) / 1e18;
    }

    // Simplified IL calculation (would need actual price data)
    const ilLoss = 0; // TODO: Calculate based on entry price vs current price

    const netPnL = currentValue + feesEarned - entryAmount - ilLoss;
    const netPnLPercent = entryAmount > 0 ? (netPnL / entryAmount) * 100 : 0;

    return {
      positionId: position.id,
      entryAmountUsd: entryAmount,
      currentValueUsd: currentValue,
      feesEarnedUsd: feesEarned,
      ilLossUsd: ilLoss,
      netPnLUsd: netPnL,
      netPnLPercent,
    };
  }

  /**
   * Get all active positions
   */
  async getActivePositions(): Promise<Position[]> {
    return this.findByStatus(PositionStatus.ACTIVE);
  }

  /**
   * Get user's active positions
   */
  async getUserActivePositions(userId: string): Promise<Position[]> {
    return this.findAll({
      userId,
      status: [PositionStatus.ACTIVE, PositionStatus.PENDING_EXECUTION],
    });
  }

  /**
   * Get positions by pool
   */
  async getPositionsByPool(poolId: string): Promise<Position[]> {
    return this.findAll({ poolId });
  }

  /**
   * Count user's active positions
   */
  async countUserActivePositions(userId: string): Promise<number> {
    return this.positionRepository.count({
      where: {
        userId,
        status: In([PositionStatus.ACTIVE, PositionStatus.PENDING_EXECUTION]),
      },
    });
  }
}
