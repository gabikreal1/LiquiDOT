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
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
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
    private investmentDecisionService: InvestmentDecisionService,
    private moonbeamService: MoonbeamService,
    private assetHubService: AssetHubService,
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
    const availableCapitalUsd = this.weiToUsd(balance);

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
      availableCapitalUsd = this.weiToUsd(balance);
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

    // 1. First withdraw positions that are no longer needed
    for (const action of decision.toWithdraw) {
      try {
        this.logger.log(`Withdrawing from pool ${action.poolId}, amount: $${Math.abs(action.differenceUsd).toFixed(2)}`);
        
        if (action.positionId) {
          // Call MoonbeamService to liquidate position
          // This would trigger XCM back to AssetHub
          // Note: positionId needs to be converted to number for the contract
          await this.moonbeamService.liquidateSwapAndReturn({
            positionId: parseInt(action.positionId),
            baseAsset: '', // Would need to be fetched from position
            destination: new Uint8Array(), // Would need XCM builder
            minAmountOut0: BigInt(0),
            minAmountOut1: BigInt(0),
            limitSqrtPrice: BigInt(0),
            assetHubPositionId: action.positionId,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to withdraw position ${action.positionId}:`, error);
        // Continue with other actions
      }
    }

    // 2. Add new positions
    for (const action of decision.toAdd) {
      try {
        this.logger.log(`Adding to pool ${action.poolId}, amount: $${action.differenceUsd.toFixed(2)}`);
        
        // This would need to:
        // 1. Call AssetHubVault.createPendingPosition()
        // 2. Wait for XCM to Moonbeam
        // 3. Position gets executed on Moonbeam
        
        // For now, we just log - actual implementation would integrate with blockchain services
        // await this.assetHubService.createPendingPosition({
        //   poolId: action.poolId,
        //   amount: this.usdToWei(action.differenceUsd),
        //   // ... other params
        // });
      } catch (error) {
        this.logger.error(`Failed to add position to pool ${action.poolId}:`, error);
      }
    }

    // 3. Increment rebalance counter
    this.investmentDecisionService.incrementRebalanceCount(userId);

    this.logger.log(`Rebalance execution completed for user ${userId}`);
  }

  /**
   * Convert wei to USD (simplified - would need actual price feeds)
   */
  private weiToUsd(weiAmount: bigint): number {
    // Simplified conversion - assumes 18 decimals and 1:1 with USD for stables
    // In production, this would use price feeds
    return Number(weiAmount / BigInt(10 ** 18));
  }

  /**
   * Convert USD to wei
   */
  private usdToWei(usdAmount: number): string {
    return (BigInt(Math.floor(usdAmount)) * BigInt(10 ** 18)).toString();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
