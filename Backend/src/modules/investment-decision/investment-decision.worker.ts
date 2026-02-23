/**
 * Investment Decision Worker
 * 
 * Scheduled worker that evaluates investment decisions for all active users.
 * Runs every 3-4 hours (configurable) and triggers rebalancing when conditions are met.
 * 
 * From defi_investment_bot_spec.md Section 4:
 * "Execution frequency: Every 3-4 hours or on trigger"
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InvestmentDecisionService } from './investment-decision.service';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { Pool } from '../pools/entities/pool.entity';
import { Position, PositionStatus } from '../positions/entities/position.entity';
import { ActivityLog, ActivityType, ActivityStatus } from '../activity-logs/entities/activity-log.entity';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';
import { XcmRetryService } from '../blockchain/services/xcm-retry.service';
import { PriceService } from '../blockchain/services/price.service';
import { TokenMathService } from '../blockchain/services/token-math.service';
import { RebalanceDecision } from './types/investment.types';

@Injectable()
export class InvestmentDecisionWorker implements OnModuleInit {
  private readonly logger = new Logger(InvestmentDecisionWorker.name);
  private isProcessing = false;
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreference)
    private preferenceRepository: Repository<UserPreference>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
    private investmentDecisionService: InvestmentDecisionService,
    private moonbeamService: MoonbeamService,
    private assetHubService: AssetHubService,
    private xcmBuilderService: XcmBuilderService,
    private xcmRetryService: XcmRetryService,
    private priceService: PriceService,
    private tokenMath: TokenMathService,
    private configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('ENABLE_INVESTMENT_WORKER', true);
  }

  async onModuleInit() {
    this.logger.log(`InvestmentDecisionWorker initialized (enabled: ${this.enabled})`);
  }

  /**
   * Main scheduled job - runs every 4 hours
   * Can be overridden with INVESTMENT_CHECK_CRON env var
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async runScheduledCheck(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Investment worker is disabled');
      return;
    }

    if (this.isProcessing) {
      this.logger.warn('Previous investment check still running, skipping this cycle');
      return;
    }

    try {
      this.isProcessing = true;
      this.logger.log('Starting scheduled investment decision evaluation');
      await this.processAllActiveUsers();
    } catch (error) {
      this.logger.error('Error in scheduled investment check', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual trigger for a specific user
   */
  async triggerForUser(userId: string): Promise<RebalanceDecision> {
    this.logger.log(`Manual trigger for user ${userId}`);
    
    // Get user's available capital from AssetHub
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const balance = await this.assetHubService.getUserBalance(user.walletAddress);
    const availableCapitalUsd = await this.tokenMath.dotPlanckToUsd(balance);

    // Evaluate decision
    const decision = await this.investmentDecisionService.evaluateInvestmentDecision(
      userId,
      availableCapitalUsd
    );

    // Execute if should rebalance
    if (decision.shouldRebalance) {
      await this.executeRebalance(userId, decision);
    }

    return decision;
  }

  /**
   * Process all active users with auto-invest enabled
   */
  private async processAllActiveUsers(): Promise<void> {
    // Find all users with auto-invest enabled
    const preferences = await this.preferenceRepository.find({
      where: { autoInvestEnabled: true },
      relations: ['user'],
    });

    this.logger.log(`Processing ${preferences.length} users with auto-invest enabled`);

    for (const pref of preferences) {
      if (!pref.user?.isActive) continue;

      try {
        await this.processUser(pref.userId, pref.user.walletAddress);
      } catch (error) {
        this.logger.error(`Error processing user ${pref.userId}:`, error);
        // Continue with next user
      }

      // Small delay between users to avoid overwhelming the system
      await this.sleep(1000);
    }

    this.logger.log('Completed processing all users');
  }

  /**
   * Process a single user
   */
  private async processUser(userId: string, walletAddress: string): Promise<void> {
    this.logger.debug(`Processing user ${userId}`);

    // Get user's available capital from AssetHub
    let availableCapitalUsd: number;
    try {
      const balance = await this.assetHubService.getUserBalance(walletAddress);
      availableCapitalUsd = await this.tokenMath.dotPlanckToUsd(balance);
    } catch (error) {
      this.logger.warn(`Could not fetch balance for user ${userId}, skipping`);
      return;
    }

    // Skip if no capital
    if (availableCapitalUsd < 100) { // Minimum $100 to consider
      this.logger.debug(`User ${userId} has insufficient capital ($${availableCapitalUsd})`);
      return;
    }

    // Evaluate investment decision
    const decision = await this.investmentDecisionService.evaluateInvestmentDecision(
      userId,
      availableCapitalUsd
    );

    // Log decision
    this.logger.log(
      `User ${userId}: shouldRebalance=${decision.shouldRebalance}, ` +
      `reason="${decision.reason}", APY improvement=${decision.apyImprovement.toFixed(2)}%`
    );

    // Execute if should rebalance
    if (decision.shouldRebalance) {
      await this.executeRebalance(userId, decision);
    }
  }

  /**
   * Execute the rebalancing operations
   */
  private async executeRebalance(userId: string, decision: RebalanceDecision): Promise<void> {
    this.logger.log(`Executing rebalance for user ${userId}`);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User ${userId} not found, cannot rebalance`);
      return;
    }

    const preferences = await this.preferenceRepository.findOne({ where: { userId } });

    // 1. First withdraw positions that are no longer needed
    for (const action of decision.toWithdraw) {
      try {
        this.logger.log(`Withdrawing from pool ${action.poolId}, amount: $${Math.abs(action.differenceUsd).toFixed(2)}`);

        if (action.positionId) {
          // Look up the Moonbeam position to get baseAsset and local ID
          const localId = await this.moonbeamService.getLocalPositionId(action.positionId);
          const moonbeamPos = await this.moonbeamService.getPosition(localId);

          if (!moonbeamPos) {
            this.logger.warn(`Moonbeam position for ${action.positionId} not found, skipping`);
            continue;
          }

          await this.moonbeamService.liquidateSwapAndReturn({
            positionId: localId,
            baseAsset: moonbeamPos.token0, // Return in token0 (base)
            beneficiary: user.walletAddress,
            minAmountOut0: 0n, // Contract applies default slippage
            minAmountOut1: 0n,
            limitSqrtPrice: 0n,
            assetHubPositionId: action.positionId,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to withdraw position ${action.positionId}:`, error);
      }
    }

    // 2. Add new positions — two-phase: XCM transfer (AH) + EVM call (Moonbeam)
    const chainId = this.configService.get<number>('MOONBEAM_EVM_CHAIN_ID', 1284);

    for (const action of decision.toAdd) {
      try {
        this.logger.log(`Adding to pool ${action.poolId}, amount: $${action.differenceUsd.toFixed(2)}`);

        // Resolve pool address from DB (action.poolId is a DB UUID, contract needs address)
        const pool = await this.poolRepository.findOne({ where: { id: action.poolId } });
        if (!pool) {
          this.logger.warn(`Pool not found for id=${action.poolId}, skipping investment`);
          continue;
        }

        // Convert USD to DOT planck
        const amount = await this.tokenMath.usdToDotPlanck(action.differenceUsd);
        const baseAsset = this.configService.get<string>('DEFAULT_BASE_ASSET', '');

        // Phase 1: XCM transfer — deposits xcDOT to XCMProxy on Moonbeam
        const { positionId, moonbeamCalldata } = await this.assetHubService.dispatchInvestmentWithXcm({
          user: user.walletAddress,
          chainId,
          poolId: pool.poolAddress,
          baseAsset,
          amount,
          lowerRangePercent: preferences?.defaultLowerRangePercent ?? -5,
          upperRangePercent: preferences?.defaultUpperRangePercent ?? 10,
        });

        this.logger.log(`Phase 1 done for pool ${action.poolId}, position: ${positionId}`);

        // Store assetHubTxHash immediately
        try {
          await this.positionRepository.update(
            { assetHubPositionId: positionId },
            { assetHubTxHash: positionId }, // positionId comes from the AH tx
          );
        } catch (dbErr) {
          this.logger.warn(`Could not persist assetHubTxHash for ${positionId}: ${dbErr}`);
        }

        // Poll for XCM arrival: check if pending position exists on Moonbeam
        let xcmArrived = false;
        for (let pollAttempt = 0; pollAttempt < 12; pollAttempt++) {
          await this.sleep(5000); // Poll every 5s, up to 60s
          try {
            const pending = await this.moonbeamService.getPendingPosition(positionId);
            if (pending && pending.amount > 0n) {
              xcmArrived = true;
              this.logger.log(`XCM arrived for ${positionId} after ${(pollAttempt + 1) * 5}s`);
              break;
            }
          } catch {
            // Not yet arrived, continue polling
          }
        }

        if (!xcmArrived) {
          this.logger.warn(`XCM not confirmed on Moonbeam after 60s for ${positionId}, attempting receiveAssets anyway`);
        }

        // Phase 2: Backend calls receiveAssets() on Moonbeam (with retry)
        const phase2Result = await this.xcmRetryService.executeWithRetry(
          () => this.moonbeamService.callReceiveAssets(moonbeamCalldata),
          { maxAttempts: 5, baseDelayMs: 3000 },
        );

        if (phase2Result.success) {
          this.logger.log(`Phase 2 done: receiveAssets() called for ${positionId} (${phase2Result.attempts} attempt(s))`);
        } else {
          this.logger.error(`Phase 2 failed for ${positionId} after ${phase2Result.attempts} attempts: ${phase2Result.error?.message}`);
          // Mark position as FAILED and create error ActivityLog
          try {
            await this.positionRepository.update(
              { assetHubPositionId: positionId },
              { status: PositionStatus.FAILED, lastFailedAt: new Date() },
            );
            const pos = await this.positionRepository.findOne({ where: { assetHubPositionId: positionId } });
            if (pos) {
              await this.activityLogRepository.save(this.activityLogRepository.create({
                userId: pos.userId,
                type: ActivityType.ERROR,
                status: ActivityStatus.FAILED,
                positionId,
                details: {
                  error: phase2Result.error?.message,
                  operation: 'receiveAssets_phase2',
                  attempts: phase2Result.attempts,
                  moonbeamCalldata,
                },
              }));
            }
          } catch (dbErr) {
            this.logger.error(`Failed to persist Phase 2 failure for ${positionId}: ${dbErr}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to add position to pool ${action.poolId}:`, error);
      }
    }

    // 3. Increment rebalance counter (persisted to DB)
    await this.investmentDecisionService.incrementRebalanceCount(userId);

    this.logger.log(`Rebalance execution completed for user ${userId}`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
