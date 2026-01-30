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
import { 
  PositionCheckResult, 
  LiquidationResult, 
  StopLossConfig,
  MonitoredPositionStatus 
} from './types/stop-loss.types';

@Injectable()
export class StopLossService implements OnModuleInit {
  private readonly logger = new Logger(StopLossService.name);
  private readonly config: StopLossConfig;
  private isProcessing = false;
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private moonbeamService: MoonbeamService,
    private assetHubService: AssetHubService,
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
   * Check all active positions for stop-loss/take-profit conditions
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

    for (const position of positions) {
      try {
        await this.checkPosition(position);
      } catch (error) {
        this.logger.error(`Error checking position ${position.id}:`, error);
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

      // Step 2: Build XCM destination for AssetHub
      const xcmDestination = await this.buildXcmDestination(position.user?.walletAddress || '');

      // Step 3: Call Moonbeam to liquidate
      const liquidateParams = {
        positionId: parseInt(position.moonbeamPositionId!),
        baseAsset: position.baseAsset,
        destination: xcmDestination,
        minAmountOut0: BigInt(0), // TODO: Calculate with slippage
        minAmountOut1: BigInt(0),
        limitSqrtPrice: BigInt(0),
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

      // Mark as FAILED and alert
      await this.positionRepository.update(
        { id: position.id },
        { status: PositionStatus.FAILED }
      );

      // Alert for manual intervention
      if (this.config.alertOnFailure) {
        await this.sendAlert(position, error);
      }
    }

    return result;
  }

  /**
   * Build XCM destination bytes for AssetHub
   */
  private async buildXcmDestination(userAddress: string): Promise<Uint8Array> {
    // This would build the proper XCM MultiLocation bytes
    // For now, return empty - actual implementation would depend on Polkadot.js
    return new Uint8Array();
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
