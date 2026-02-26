/**
 * Positions Service
 * 
 * CRUD operations for Position entity.
 * Syncs position status with on-chain state.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Position, PositionStatus } from './entities/position.entity';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import * as TokenMath from '../../common/token-math';

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
   * Liquidate position: remove LP, swap to base asset, return to Asset Hub.
   * Orchestrates moonbeamService calls.
   */
  async liquidate(
    positionId: string,
    opts?: { baseAsset?: string },
  ): Promise<Position> {
    const position = await this.findOne(positionId);

    const liquidatable = [PositionStatus.ACTIVE, PositionStatus.OUT_OF_RANGE];
    if (!liquidatable.includes(position.status)) {
      throw new BadRequestException(
        `Position ${positionId} is ${position.status}, must be ACTIVE or OUT_OF_RANGE`,
      );
    }

    if (!position.moonbeamPositionId) {
      throw new BadRequestException(`Position ${positionId} has no Moonbeam ID`);
    }

    // Determine base asset: caller override > position's stored baseAsset
    const baseAsset = opts?.baseAsset || position.baseAsset;
    if (!baseAsset) {
      throw new BadRequestException('No base asset specified');
    }

    // Beneficiary address for XCM return (contract handles EE-padding for AccountId32)
    // Always use position owner's wallet — never accept caller-supplied address (C-1 fix)
    const beneficiary = position.user?.walletAddress || position.userId;

    // Lock status to prevent double-liquidation
    const result = await this.positionRepository.update(
      { id: positionId, status: In(liquidatable) },
      { status: PositionStatus.LIQUIDATION_PENDING },
    );
    if (result.affected === 0) {
      throw new BadRequestException('Position status changed concurrently');
    }

    try {
      this.logger.log(
        `Liquidating position ${positionId} (moonbeam #${position.moonbeamPositionId})`,
      );

      await this.moonbeamService.liquidateSwapAndReturn({
        positionId: parseInt(position.moonbeamPositionId),
        baseAsset,
        beneficiary,
        minAmountOut0: 0n,
        minAmountOut1: 0n,
        limitSqrtPrice: 0n,
        assetHubPositionId: position.assetHubPositionId,
      });

      await this.positionRepository.update(positionId, {
        status: PositionStatus.LIQUIDATED,
        liquidatedAt: new Date(),
      });

      this.logger.log(`Position ${positionId} liquidated successfully`);
      return this.findOne(positionId);
    } catch (error) {
      this.logger.error(`Liquidation failed for ${positionId}: ${error.message}`);
      // Revert to previous status so operator can retry
      await this.positionRepository.update(positionId, {
        status: PositionStatus.OUT_OF_RANGE,
      });
      throw error;
    }
  }

  /**
   * Calculate P&L for a position
   */
  async calculatePnL(position: Position): Promise<PositionPnL> {
    const entryAmount = TokenMath.planckToDot(position.amount);
    let currentValue = entryAmount;
    let feesEarned = 0;

    // If position is still active, fetch current value from Moonbeam
    if (position.moonbeamPositionId && position.status === PositionStatus.ACTIVE) {
      try {
        const fees = await this.moonbeamService.collectFees(
          parseInt(position.moonbeamPositionId)
        );
        // Fees are in pool token units — use DOT decimals as approximation
        // TODO: Convert each fee token separately when multi-token pricing is available
        feesEarned = TokenMath.smallestUnitToDecimal(fees.amount0 + fees.amount1, TokenMath.DOT_DECIMALS);
      } catch (error) {
        this.logger.warn(`Could not fetch fees for position ${position.id}`);
      }
    }

    // If liquidated, use returned amount
    if (position.status === PositionStatus.LIQUIDATED && position.returnedAmount) {
      currentValue = TokenMath.planckToDot(position.returnedAmount);
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
