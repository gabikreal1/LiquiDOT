/**
 * Stop-Loss Service
 * 
 * Continuously monitors active LP positions on Moonbeam and automatically
 * triggers liquidation when positions move outside the user's configured price range.
 * 
 * Key decisions (from STOP_LOSS_WORKER.md):
 * - Monitoring frequency: Configurable via env (default 30s)
 * - Gas payment: Protocol pays, deduct from return
 * - Settlement flow: Polling + XCM tracking
 * - Failed liquidation: Alert for manual intervention
 * - Take-profit: Upper bound of LP range
 * - Coordination: DB lock (mark as LIQUIDATING)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Position, PositionStatus } from '../positions/entities/position.entity';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';
import {
  PositionCheckResult,
  LiquidationResult,
  StopLossConfig,
  MonitoredPositionStatus
} from './types/stop-loss.types';

/** Cached pool state for batch tick lookups */
interface PoolStateCache {
  currentTick: number;
  cachedAt: number;
}

@Injectable()
export class StopLossService implements OnModuleInit {
  private readonly logger = new Logger(StopLossService.name);
  private readonly config: StopLossConfig;
  private isProcessing = false;
  private readonly enabled: boolean;
  private readonly poolStateCache = new Map<string, PoolStateCache>();
  private readonly POOL_CACHE_TTL_MS = 15_000; // 15 seconds

  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private moonbeamService: MoonbeamService,
    private assetHubService: AssetHubService,
    private xcmBuilderService: XcmBuilderService,
    private configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('ENABLE_STOP_LOSS_WORKER', true);
    this.config = {
      checkIntervalMs: this.configService.get<number>('STOP_LOSS_CHECK_INTERVAL_MS', 30000),
      batchSize: this.configService.get<number>('STOP_LOSS_BATCH_SIZE', 50),
      slippageBps: this.configService.get<number>('LIQUIDATION_SLIPPAGE_BPS', 100),
      maxRetries: this.configService.get<number>('STOP_LOSS_MAX_RETRIES', 3),
      alertOnFailure: this.configService.get<boolean>('STOP_LOSS_ALERT_ON_FAILURE', true),
    };
  }

  async onModuleInit() {
    this.logger.log(`StopLossService initialized (enabled: ${this.enabled})`);
    this.logger.log(`Check interval: ${this.config.checkIntervalMs}ms, batch size: ${this.config.batchSize}`);
  }

  /**
   * Main monitoring loop - called at configured interval
   * Default: every 30 seconds
   */
  @Interval(30000) // Will be overridden by dynamic scheduling
  async monitorPositions(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (this.isProcessing) {
      this.logger.debug('Previous stop-loss check still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      await this.checkActivePositions();
    } catch (error) {
      this.logger.error('Error in stop-loss monitoring:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check all active positions for stop-loss/take-profit conditions.
   * Also picks up positions that are ACTIVE with retryCount > 0 (scheduled for retry),
   * applying exponential backoff before re-attempting liquidation.
   */
  private async checkActivePositions(): Promise<void> {
    // Get active positions that are not already being liquidated
    const positions = await this.positionRepository.find({
      where: {
        status: In([PositionStatus.ACTIVE])
      },
      take: this.config.batchSize,
      relations: ['pool', 'user'],
    });

    if (positions.length === 0) {
      this.logger.debug('No active positions to monitor');
      return;
    }

    this.logger.debug(`Checking ${positions.length} active positions`);

    // Batch: group positions by pool and pre-fetch pool state
    const poolIds = [...new Set(positions.map((p) => p.pool?.poolAddress).filter(Boolean))];
    await this.prefetchPoolStates(poolIds as string[]);

    for (const position of positions) {
      try {
        // Exponential backoff: skip if too soon since last failure
        if (position.retryCount > 0 && position.lastFailedAt) {
          const backoffMs = Math.pow(2, position.retryCount) * this.config.checkIntervalMs;
          const nextRetryAt = new Date(position.lastFailedAt.getTime() + backoffMs);
          if (new Date() < nextRetryAt) {
            this.logger.debug(
              `Skipping position ${position.id} (retry ${position.retryCount}, next attempt at ${nextRetryAt.toISOString()})`,
            );
            continue;
          }
        }

        // Try local tick comparison first using cached pool state
        if (position.lowerTick != null && position.upperTick != null && position.pool?.poolAddress) {
          const cachedState = this.poolStateCache.get(position.pool.poolAddress);
          if (cachedState) {
            const outOfRange = cachedState.currentTick < position.lowerTick || cachedState.currentTick >= position.upperTick;
            if (!outOfRange) {
              // Position is in range, skip expensive RPC call
              continue;
            }
            // Out of range locally — fall through to full check for liquidation
          }
        }

        await this.checkPosition(position);
      } catch (error) {
        this.logger.error(`Error checking position ${position.id}:`, error);
      }
    }
  }

  /**
   * Pre-fetch pool states for batch processing.
   * Uses a 15s TTL cache to avoid redundant RPC calls.
   */
  private async prefetchPoolStates(poolAddresses: string[]): Promise<void> {
    const now = Date.now();
    const toFetch = poolAddresses.filter((addr) => {
      const cached = this.poolStateCache.get(addr);
      return !cached || (now - cached.cachedAt > this.POOL_CACHE_TTL_MS);
    });

    for (const addr of toFetch) {
      try {
        const state = await this.moonbeamService.getPoolState(addr);
        if (state) {
          this.poolStateCache.set(addr, {
            currentTick: state.currentTick,
            cachedAt: now,
          });
        }
      } catch (error) {
        this.logger.debug(`Could not fetch pool state for ${addr}: ${error.message}`);
      }
    }
  }

  /**
   * Check a single position for stop-loss/take-profit triggers
   */
  private async checkPosition(position: Position): Promise<PositionCheckResult> {
    const result: PositionCheckResult = {
      positionId: position.id,
      poolId: position.poolId,
      userId: position.userId,
      status: MonitoredPositionStatus.ACTIVE,
      currentPrice: '0',
      lowerBoundPrice: '0',
      upperBoundPrice: '0',
      isOutOfRange: false,
      isAtUpperBound: false,
      isAtLowerBound: false,
      checkedAt: new Date(),
    };

    // Skip if no Moonbeam position ID (not yet executed)
    if (!position.moonbeamPositionId) {
      this.logger.debug(`Position ${position.id} has no Moonbeam position ID, skipping`);
      return result;
    }

    try {
      // Call Moonbeam to check if position is out of range
      const rangeCheck = await this.moonbeamService.isPositionOutOfRange(
        parseInt(position.moonbeamPositionId)
      );

      result.currentPrice = rangeCheck.currentPrice.toString();
      result.isOutOfRange = rangeCheck.outOfRange;

      // Determine if it's upper or lower bound
      // Upper bound = take-profit, Lower bound = stop-loss
      if (rangeCheck.outOfRange) {
        // Get position details to determine direction
        const moonbeamPos = await this.moonbeamService.getPosition(
          parseInt(position.moonbeamPositionId)
        );

        if (moonbeamPos) {
          // Compare current price with entry to determine if upper or lower
          const currentPriceBn = rangeCheck.currentPrice;
          const entryPriceBn = moonbeamPos.entryPrice;

          if (currentPriceBn > entryPriceBn) {
            // Price went up - at upper bound (take-profit)
            result.isAtUpperBound = true;
            result.status = MonitoredPositionStatus.OUT_OF_RANGE;
            this.logger.log(`Position ${position.id} hit TAKE-PROFIT (upper bound)`);
          } else {
            // Price went down - at lower bound (stop-loss)
            result.isAtLowerBound = true;
            result.status = MonitoredPositionStatus.OUT_OF_RANGE;
            this.logger.log(`Position ${position.id} hit STOP-LOSS (lower bound)`);
          }
        }

        // Trigger liquidation
        await this.triggerLiquidation(position, result);
      }
    } catch (error) {
      this.logger.error(`Error checking range for position ${position.id}:`, error);
    }

    return result;
  }

  /**
   * Trigger liquidation for a position that is out of range
   * Uses DB lock to prevent double-liquidation
   */
  private async triggerLiquidation(position: Position, checkResult: PositionCheckResult): Promise<LiquidationResult> {
    const result: LiquidationResult = {
      success: false,
      positionId: position.id,
      executedAt: new Date(),
    };

    try {
      // Step 1: Acquire DB lock by setting status to OUT_OF_RANGE
      // This prevents race conditions with other liquidation sources
      const lockResult = await this.positionRepository.update(
        { 
          id: position.id, 
          status: PositionStatus.ACTIVE  // Only update if still ACTIVE
        },
        { status: PositionStatus.OUT_OF_RANGE }
      );

      if (lockResult.affected === 0) {
        this.logger.warn(`Position ${position.id} already being processed, skipping`);
        return result;
      }

      this.logger.log(`Initiating liquidation for position ${position.id}`);

      // Step 2: Beneficiary address for XCM return (contract handles EE-padding)
      const beneficiary = position.user?.walletAddress || '';

      // Step 3: Calculate slippage-adjusted minimum amounts
      // Use configurable slippage (default 100 bps = 1%) applied by the contract
      // We pass 0 here to let the contract's defaultSlippageBps handle it,
      // which is safer than pre-calculating without oracle prices
      const liquidateParams = {
        positionId: parseInt(position.moonbeamPositionId!),
        baseAsset: position.baseAsset,
        beneficiary,
        minAmountOut0: 0n, // Contract applies defaultSlippageBps
        minAmountOut1: 0n,
        limitSqrtPrice: 0n,
        assetHubPositionId: position.assetHubPositionId,
      };

      await this.moonbeamService.liquidateSwapAndReturn(liquidateParams);

      // Step 4: Update position status to LIQUIDATED
      await this.positionRepository.update(
        { id: position.id },
        { 
          status: PositionStatus.LIQUIDATED,
          liquidatedAt: new Date(),
        }
      );

      result.success = true;
      this.logger.log(`Successfully liquidated position ${position.id}`);

    } catch (error) {
      this.logger.error(`Failed to liquidate position ${position.id}:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown error';

      const newRetryCount = (position.retryCount || 0) + 1;

      if (newRetryCount < this.config.maxRetries) {
        // Retry: set back to ACTIVE with incremented retryCount
        await this.positionRepository.update(
          { id: position.id },
          {
            status: PositionStatus.ACTIVE,
            retryCount: newRetryCount,
            lastFailedAt: new Date(),
          },
        );
        this.logger.warn(
          `Position ${position.id} liquidation failed (attempt ${newRetryCount}/${this.config.maxRetries}), will retry`,
        );
      } else {
        // Retries exhausted: mark as FAILED and alert
        await this.positionRepository.update(
          { id: position.id },
          {
            status: PositionStatus.FAILED,
            retryCount: newRetryCount,
            lastFailedAt: new Date(),
          },
        );

        if (this.config.alertOnFailure) {
          await this.sendAlert(position, error);
        }
      }
    }

    return result;
  }

  /**
   * Get beneficiary address for XCM return to AssetHub.
   * The XCMProxy contract handles XCM routing internally via IPalletXcm.
   * @deprecated Pass beneficiary address directly to liquidateSwapAndReturn
   */
  private getBeneficiary(userAddress: string): string {
    return userAddress;
  }

  /**
   * Send alert for failed liquidation
   * Decision: Alert for manual intervention (no auto-retry)
   */
  private async sendAlert(position: Position, error: any): Promise<void> {
    this.logger.error(`🚨 ALERT: Failed liquidation requires manual intervention`);
    this.logger.error(`Position ID: ${position.id}`);
    this.logger.error(`User: ${position.userId}`);
    this.logger.error(`Pool: ${position.poolId}`);
    this.logger.error(`Error: ${error?.message || error}`);

    // TODO: Integrate with actual alerting system (Slack, PagerDuty, etc.)
    // For now, just log prominently
  }

  /**
   * Manual trigger for liquidation (for testing or admin use)
   */
  async manualLiquidate(positionId: string): Promise<LiquidationResult> {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
      relations: ['pool', 'user'],
    });

    if (!position) {
      return {
        success: false,
        positionId,
        error: 'Position not found',
        executedAt: new Date(),
      };
    }

    if (position.status !== PositionStatus.ACTIVE) {
      return {
        success: false,
        positionId,
        error: `Position is not ACTIVE (current: ${position.status})`,
        executedAt: new Date(),
      };
    }

    const checkResult: PositionCheckResult = {
      positionId: position.id,
      poolId: position.poolId,
      userId: position.userId,
      status: MonitoredPositionStatus.OUT_OF_RANGE,
      currentPrice: '0',
      lowerBoundPrice: '0',
      upperBoundPrice: '0',
      isOutOfRange: true,
      isAtUpperBound: false,
      isAtLowerBound: true, // Assume stop-loss for manual
      checkedAt: new Date(),
    };

    return this.triggerLiquidation(position, checkResult);
  }

  /**
   * Get all positions that need attention (OUT_OF_RANGE or FAILED)
   */
  async getPositionsNeedingAttention(): Promise<Position[]> {
    return this.positionRepository.find({
      where: {
        status: In([PositionStatus.OUT_OF_RANGE, PositionStatus.FAILED])
      },
      relations: ['pool', 'user'],
    });
  }
}
