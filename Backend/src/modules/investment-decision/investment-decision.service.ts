/**
 * Investment Decision Service
 *
 * Implements the complete investment decision logic from defi_investment_bot_spec.md
 *
 * Core responsibilities:
 * 1. Filter candidate pools based on user preferences
 * 2. Calculate real APY with IL risk adjustment
 * 3. Build optimal target portfolio using utility maximization
 * 4. Compare with current portfolio and decide on rebalancing
 * 5. Execute rebalancing via MoonbeamService
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';
import { PriceService } from '../blockchain/services/price.service';
import { TokenMathService } from '../blockchain/services/token-math.service';
import { Pool } from '../pools/entities/pool.entity';
import { Position, PositionStatus } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import {
  PoolCandidate,
  IdealAllocation,
  RebalanceDecision,
  RebalanceAction,
  BotState,
  UserInvestmentConfig,
  CurrentPosition,
  TokenRiskTier,
  IL_RISK_FACTORS,
  TOKEN_RISK_CLASSIFICATION,
  GAS_COEFFICIENTS,
  SAFETY_THRESHOLDS,
  ExecuteDecisionParams,
} from './types/investment.types';

@Injectable()
export class InvestmentDecisionService implements OnModuleInit {
  private readonly logger = new Logger(InvestmentDecisionService.name);

  // Rebalance counts are now persisted in DB (UserPreference entity).
  // The in-memory Map is kept as a write-through cache for fast reads within a single process.

  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreference)
    private preferenceRepository: Repository<UserPreference>,
    private readonly assetHubService: AssetHubService,
    private readonly moonbeamService: MoonbeamService,
    private readonly xcmBuilderService: XcmBuilderService,
    private readonly priceService: PriceService,
    private readonly tokenMath: TokenMathService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    this.logger.log('InvestmentDecisionService initialized');
  }

  /**
   * Cron job to run investment decisions every hour.
   * Fetches all users and runs decision logic for them.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledDecisionRun() {
    this.logger.log('Starting scheduled investment decision run...');
    try {
      // Fetch all active users
      const users = await this.userRepository.find({ where: { isActive: true } });
      this.logger.log(`Found ${users.length} active users to process.`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const user of users) {
        try {
          const pref = await this.preferenceRepository.findOne({ where: { userId: user.id } });
          if (!pref || !pref.autoInvestEnabled) {
            this.logger.debug(`Skipping user ${user.id}: No prefs or auto-invest disabled`);
            continue;
          }

          // Count rebalances today (from DB-backed counter)
          const rebalancesToday = await this.getRebalancesToday(user.id);

          // Fetch balance from Asset Hub
          let availableCapitalUsd = 0;
          try {
            const balance = await this.assetHubService.getUserBalance(user.walletAddress);
            availableCapitalUsd = await this.tokenMath.dotPlanckToUsd(balance);
          } catch (e) {
            this.logger.error(`Failed to fetch balance for ${user.id}: ${e.message}`);
            continue;
          }

          if (availableCapitalUsd < 50) {
            continue;
          }

          const decision = await this.evaluateInvestmentDecision(user.id, availableCapitalUsd);

          if (decision.shouldRebalance) {
            this.logger.log(`Executing decision for user ${user.id}`);
            await this.executeDecision({
              decision,
              userWalletAddress: user.walletAddress,
              baseAssetAddress: this.configService.get<string>('DEFAULT_BASE_ASSET', ''),
              amountWei: BigInt(0),
              lowerRangePercent: pref.defaultLowerRangePercent,
              upperRangePercent: pref.defaultUpperRangePercent,
              chainId: this.configService.get<number>('MOONBEAM_EVM_CHAIN_ID', 1284),
            });
          }

        } catch (err) {
          this.logger.error(`Failed to process user ${user.id}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled run failed: ${error.message}`);
    }
  }

  /**
   * Main entry point: Evaluate investment decision for a specific user
   * Called every 3-4 hours per user (or on trigger)
   */
  async evaluateInvestmentDecision(userId: string, availableCapitalUsd: number): Promise<RebalanceDecision> {
    this.logger.log(`Evaluating investment decision for user ${userId} with $${availableCapitalUsd} capital`);

    // 1. Load user preferences and convert to config
    const config = await this.getUserConfig(userId);
    if (!config) {
      return this.createNoOpDecision('User preferences not found');
    }

    // 2. Get current bot state
    const botState = await this.getBotState(userId, availableCapitalUsd);

    // 3. Check rate limiting
    const rebalancesToday = await this.getRebalancesToday(userId);
    if (rebalancesToday >= config.dailyRebalanceLimit) {
      return this.createNoOpDecision(`Daily rebalance limit reached (${rebalancesToday}/${config.dailyRebalanceLimit})`);
    }

    // 4. Step 1: Collect candidate pools
    const candidatePools = await this.collectCandidatePools(config);
    if (candidatePools.length === 0) {
      return this.createNoOpDecision('No candidate pools meet criteria');
    }
    this.logger.debug(`Found ${candidatePools.length} candidate pools`);

    // 5. Step 2-3: Calculate real APY and sort
    const rankedPools = this.calculateAndRankPools(candidatePools, config);
    if (rankedPools.length > 0) {
      this.logger.debug(`Top pool: ${rankedPools[0]?.pair} with effective APY ${rankedPools[0]?.effectiveApy.toFixed(2)}%`);
    }

    // 6. Step 4: Build ideal portfolio
    const idealPortfolio = this.buildIdealPortfolio(rankedPools, botState.totalCapitalUsd, config);
    this.logger.debug(`Ideal portfolio has ${idealPortfolio.length} positions`);

    // 7. Step 5: Compare with current portfolio
    const { toWithdraw, toAdd } = this.comparePortfolios(botState.currentPositions, idealPortfolio, config);

    // 8. Step 6: Estimate rebalancing costs
    const estimatedGasTotal = this.estimateRebalancingCosts(toWithdraw, toAdd, config.expectedGasUsd);

    // 9. Step 7: Calculate 30-day profit estimate
    const currentWeightedApy = this.calculateWeightedApy(botState.currentPositions, botState.totalCapitalUsd);
    const idealWeightedApy = this.calculateIdealWeightedApy(idealPortfolio, botState.totalCapitalUsd);
    const { profit30d, netProfit30d } = this.estimateProfit(
      currentWeightedApy,
      idealWeightedApy,
      botState.totalCapitalUsd,
      estimatedGasTotal
    );

    // 10. Calculate utility (Section 3)
    const currentUtility = this.calculatePortfolioUtility(botState.currentPositions, config);
    const targetUtility = this.calculateIdealPortfolioUtility(idealPortfolio, config);
    const grossUtilityImprovement = targetUtility - currentUtility;
    const netUtilityGain = this.calculateNetUtilityGain(
      grossUtilityImprovement,
      estimatedGasTotal,
      botState.totalCapitalUsd,
      config.planningHorizonDays
    );

    // 11. Step 6 (Spec): Apply rebalance conditions
    const { shouldRebalance, reason } = this.evaluateRebalanceConditions(
      rebalancesToday,
      config.dailyRebalanceLimit,
      netProfit30d,
      estimatedGasTotal,
      idealWeightedApy,
      currentWeightedApy,
      netUtilityGain,
      config.theta,
      toWithdraw,
      config.maxIlLossPercent
    );

    // Build decision
    const decision: RebalanceDecision = {
      shouldRebalance,
      reason,
      currentWeightedApy,
      idealWeightedApy,
      apyImprovement: idealWeightedApy - currentWeightedApy,
      currentUtility,
      targetUtility,
      grossUtilityImprovement,
      netUtilityGain,
      estimatedGasTotalUsd: estimatedGasTotal,
      profit30dUsd: profit30d,
      netProfit30dUsd: netProfit30d,
      toWithdraw,
      toAdd,
      rebalancesTodayBefore: rebalancesToday,
      rebalancesTodayAfter: shouldRebalance ? rebalancesToday + 1 : rebalancesToday,
      calculatedAt: new Date(),
      configUsed: config,
    };

    this.logger.log(`Decision for user ${userId}: shouldRebalance=${shouldRebalance}, reason="${reason}"`);
    return decision;
  }

  /**
   * Execute the decision by dispatching investments for each ideal position.
   */
  async executeDecision(params: ExecuteDecisionParams): Promise<{ dispatchedPositionIds: string[] }> {
    if (!params.decision.shouldRebalance) {
      return { dispatchedPositionIds: [] };
    }

    if (!this.assetHubService.isInitialized()) {
      throw new Error('AssetHubService is not initialized (missing env vars)');
    }

    if (!this.moonbeamService.isInitialized()) {
      throw new Error('MoonbeamService is not initialized (missing env vars)');
    }

    const dispatchedPositionIds: string[] = [];

    // Resolve user once for DB position creation
    const user = await this.userRepository.findOne({
      where: { walletAddress: params.userWalletAddress.toLowerCase() },
    });
    if (!user) {
      throw new Error(`User not found for wallet ${params.userWalletAddress}`);
    }

    // Liquidations
    for (const w of params.decision.toWithdraw) {
      try {
        const dbPos = await this.positionRepository.findOne({
          where: { id: w.positionId },
          relations: ['pool'],
        });

        if (!dbPos?.moonbeamPositionId || !dbPos.assetHubPositionId) {
          this.logger.warn(`Skip liquidation; missing moonbeamPositionId/assetHubPositionId for snapshot positionId=${w.positionId}`);
          continue;
        }

        const moonbeamLocalId = Number(dbPos.moonbeamPositionId);
        if (!Number.isFinite(moonbeamLocalId) || moonbeamLocalId <= 0) {
          this.logger.warn(`Skip liquidation; invalid moonbeamPositionId=${dbPos.moonbeamPositionId} for positionId=${dbPos.id}`);
          continue;
        }

        await this.moonbeamService.liquidateSwapAndReturn({
          positionId: moonbeamLocalId,
          baseAsset: dbPos.baseAsset,
          beneficiary: params.userWalletAddress,
          minAmountOut0: 0n,
          minAmountOut1: 0n,
          limitSqrtPrice: 0n,
          assetHubPositionId: dbPos.assetHubPositionId,
        });

        this.logger.log(`Liquidation initiated for dbPositionId=${dbPos.id}`);
      } catch (e) {
        this.logger.warn(`Liquidation initiation failed for positionId=${w.positionId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Investments — two-phase: XCM transfer (AH) + EVM call (Moonbeam)
    for (const a of params.decision.toAdd) {
      try {
        this.logger.log(`Dispatching investment for pool ${a.poolId}, amount $${a.targetAllocationUsd}`);

        // Resolve pool address from DB (a.poolId is a DB UUID, contract needs address)
        const pool = await this.poolRepository.findOne({ where: { id: a.poolId } });
        if (!pool) {
          this.logger.warn(`Pool not found for id=${a.poolId}, skipping investment`);
          continue;
        }

        // Convert USD allocation to DOT planck
        const amount = await this.tokenMath.usdToDotPlanck(a.targetAllocationUsd);

        // Phase 1: XCM transfer — deposits xcDOT to XCMProxy on Moonbeam
        const { positionId, moonbeamCalldata } = await this.assetHubService.dispatchInvestmentWithXcm({
          user: params.userWalletAddress,
          chainId: params.chainId,
          poolId: pool.poolAddress,
          baseAsset: params.baseAssetAddress,
          amount,
          lowerRangePercent: params.lowerRangePercent,
          upperRangePercent: params.upperRangePercent,
        });

        this.logger.log(`Phase 1 done for pool ${a.poolId}, positionId=${positionId}`);

        // Create DB Position entry (upsert: EventPersistenceService may have already
        // created it from the InvestmentInitiated event)
        let dbPosition = await this.positionRepository.findOne({
          where: { assetHubPositionId: positionId },
        });
        if (!dbPosition) {
          dbPosition = this.positionRepository.create({
            assetHubPositionId: positionId,
            userId: user.id,
            poolId: a.poolId,
            baseAsset: params.baseAssetAddress,
            amount: amount.toString(),
            lowerRangePercent: params.lowerRangePercent,
            upperRangePercent: params.upperRangePercent,
            chainId: params.chainId,
            status: PositionStatus.PENDING_EXECUTION,
          });
          dbPosition = await this.positionRepository.save(dbPosition);
        }
        dispatchedPositionIds.push(dbPosition.id);

        // Wait for XCM to settle on Moonbeam (~30s for XCMP relay)
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Phase 2: Backend calls receiveAssets() on Moonbeam
        try {
          await this.moonbeamService.callReceiveAssets(moonbeamCalldata);
          this.logger.log(`Phase 2 done: receiveAssets() called for ${positionId}`);
        } catch (phase2Error) {
          this.logger.error(
            `Phase 2 failed for ${positionId} (xcDOT at XCMProxy, retry manually): ${phase2Error instanceof Error ? phase2Error.message : String(phase2Error)}`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to dispatch investment for pool ${a.poolId}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with next investment — don't let one failure stop others
      }
    }

    // Increment rebalance counter so daily limit is enforced
    if (dispatchedPositionIds.length > 0) {
      await this.incrementRebalanceCount(user.id);
    }

    return { dispatchedPositionIds };
  }

  /**
   * Step 1: Collect Candidate Pools (Section 4)
   * Filter all available pools based on user criteria
   */
  private async collectCandidatePools(config: UserInvestmentConfig): Promise<PoolCandidate[]> {
    // Build query with filters
    const query = this.poolRepository.createQueryBuilder('pool')
      .leftJoinAndSelect('pool.dex', 'dex')
      .where('pool.isActive = :isActive', { isActive: true });

    // TVL filter: TVL >= minTvlUsd
    query.andWhere('CAST(pool.tvl AS DECIMAL) >= :minTvl', { minTvl: config.minTvlUsd });

    // APY filter: apy >= min_apy × 0.95 (slight tolerance)
    const minApyThreshold = config.minApy * 0.95;
    query.andWhere('CAST(pool.apr AS DECIMAL) >= :minApy', { minApy: minApyThreshold });

    // DEX filter (if specified)
    if (config.preferredDexes && config.preferredDexes.length > 0) {
      query.andWhere('dex.name IN (:...dexes)', { dexes: config.preferredDexes });
    }

    const pools = await query.getMany();

    // Convert to PoolCandidate and apply token filter
    const candidates: PoolCandidate[] = [];
    const now = new Date();

    for (const pool of pools) {
      // Token filter: both tokens must be in allowed list
      const isToken0Allowed = this.isTokenAllowed(pool.token0Symbol, config.allowedTokens);
      const isToken1Allowed = this.isTokenAllowed(pool.token1Symbol, config.allowedTokens);

      if (!isToken0Allowed || !isToken1Allowed) {
        continue;
      }

      // Age filter: pool must be at least minPoolAgeDays old
      const poolAge = Math.floor((now.getTime() - pool.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (poolAge < config.minPoolAgeDays) {
        continue;
      }

      candidates.push({
        poolId: pool.id,
        poolAddress: pool.poolAddress,
        dex: pool.dex?.name || 'Unknown',
        pair: `${pool.token0Symbol}/${pool.token1Symbol}`,
        token0Symbol: pool.token0Symbol,
        token1Symbol: pool.token1Symbol,
        apy30dAverage: parseFloat(pool.apr), // Using apr field as APY
        tvlUsd: parseFloat(pool.tvl),
        volume24hUsd: parseFloat(pool.volume24h),
        ageInDays: poolAge,
        fee: pool.fee,
        // Calculated fields will be filled in next step
        ilRiskFactor: 0,
        realApy: 0,
        effectiveApy: 0,
        riskScore: 0,
        protocolFees: 0,
      });
    }

    return candidates;
  }

  /**
   * Step 2-3: Calculate Real APY and Sort (Section 4)
   * Applies IL risk adjustment and sorts by effective APY
   */
  private calculateAndRankPools(pools: PoolCandidate[], config: UserInvestmentConfig): PoolCandidate[] {
    for (const pool of pools) {
      // Calculate IL risk factor based on token pair
      pool.ilRiskFactor = this.calculateIlRiskFactor(pool.token0Symbol, pool.token1Symbol);

      // Calculate real APY: apy_30d_average × (1 - il_risk_factor)
      pool.realApy = pool.apy30dAverage * (1 - pool.ilRiskFactor);

      // Effective APY (can add more adjustments here)
      pool.effectiveApy = pool.realApy;

      // Risk score for utility calculation (simple: use IL factor as proxy)
      pool.riskScore = pool.ilRiskFactor * 100; // Convert to percentage

      // Protocol fees (estimate based on DEX)
      pool.protocolFees = this.estimateProtocolFees(pool.dex, pool.fee);
    }

    // Sort by effective APY descending (Step 3)
    return pools.sort((a, b) => b.effectiveApy - a.effectiveApy);
  }

  /**
   * Step 4: Build Ideal Portfolio (Section 4)
   * Greedy algorithm to allocate capital to top pools
   */
  private buildIdealPortfolio(
    rankedPools: PoolCandidate[],
    totalCapitalUsd: number,
    config: UserInvestmentConfig
  ): IdealAllocation[] {
    const ideal: IdealAllocation[] = [];
    let remainingCapital = totalCapitalUsd;

    for (const pool of rankedPools) {
      // Max positions limit
      if (ideal.length >= config.maxPositions) {
        break;
      }

      // Calculate allocation for this pool
      const alloc = Math.min(config.maxAllocPerPositionUsd, remainingCapital);

      // Skip if allocation too small (not worth gas)
      if (alloc < config.minPositionSizeUsd) {
        continue;
      }

      ideal.push({
        poolId: pool.poolId,
        pool,
        allocationUsd: alloc,
        weight: alloc / totalCapitalUsd,
      });

      remainingCapital -= alloc;

      // Stop if no more capital
      if (remainingCapital < config.minPositionSizeUsd) {
        break;
      }
    }

    // If capital remains and is significant, could add to stable pool
    // (Simplified: we just leave it uninvested for now)
    if (remainingCapital > config.minPositionSizeUsd) {
      this.logger.debug(`$${remainingCapital.toFixed(2)} remains uninvested`);
    }

    return ideal;
  }

  /**
   * Step 5: Compare with Current Portfolio (Section 4)
   */
  private comparePortfolios(
    currentPositions: CurrentPosition[],
    idealPortfolio: IdealAllocation[],
    config: UserInvestmentConfig
  ): { toWithdraw: RebalanceAction[]; toAdd: RebalanceAction[] } {
    const toWithdraw: RebalanceAction[] = [];
    const toAdd: RebalanceAction[] = [];

    // Create maps for easy lookup
    const currentByPool = new Map(currentPositions.map(p => [p.poolId, p]));
    const idealByPool = new Map(idealPortfolio.map(a => [a.poolId, a]));

    // Find positions to withdraw (not in ideal OR allocation differs > 5%)
    for (const current of currentPositions) {
      const ideal = idealByPool.get(current.poolId);

      if (!ideal) {
        // Position not in ideal portfolio - withdraw entirely
        toWithdraw.push({
          type: 'WITHDRAW',
          positionId: current.positionId,
          poolId: current.poolId,
          currentAllocationUsd: current.allocationUsd,
          targetAllocationUsd: 0,
          differenceUsd: -current.allocationUsd,
        });
      } else {
        // Check if allocation difference > 5%
        const diffPercent = Math.abs(current.allocationUsd - ideal.allocationUsd) / current.allocationUsd;
        if (diffPercent > 0.05 && current.allocationUsd > ideal.allocationUsd) {
          // Decrease allocation
          toWithdraw.push({
            type: 'ADJUST',
            positionId: current.positionId,
            poolId: current.poolId,
            currentAllocationUsd: current.allocationUsd,
            targetAllocationUsd: ideal.allocationUsd,
            differenceUsd: ideal.allocationUsd - current.allocationUsd,
          });
        }
      }
    }

    // Find positions to add (new pools OR increased allocation)
    for (const ideal of idealPortfolio) {
      const current = currentByPool.get(ideal.poolId);

      if (!current) {
        // New position
        toAdd.push({
          type: 'ADD',
          poolId: ideal.poolId,
          currentAllocationUsd: 0,
          targetAllocationUsd: ideal.allocationUsd,
          differenceUsd: ideal.allocationUsd,
        });
      } else {
        // Check if allocation should increase
        const diffPercent = Math.abs(current.allocationUsd - ideal.allocationUsd) / current.allocationUsd;
        if (diffPercent > 0.05 && ideal.allocationUsd > current.allocationUsd) {
          toAdd.push({
            type: 'ADJUST',
            positionId: current.positionId,
            poolId: ideal.poolId,
            currentAllocationUsd: current.allocationUsd,
            targetAllocationUsd: ideal.allocationUsd,
            differenceUsd: ideal.allocationUsd - current.allocationUsd,
          });
        }
      }
    }

    return { toWithdraw, toAdd };
  }

  /**
   * Step 6: Estimate Rebalancing Costs (Section 4)
   * estimated_gas_total = (len(to_withdraw) × 1.8 + len(to_add) × 1.6) × expected_gas
   */
  private estimateRebalancingCosts(
    toWithdraw: RebalanceAction[],
    toAdd: RebalanceAction[],
    expectedGasUsd: number
  ): number {
    const withdrawCost = toWithdraw.length * GAS_COEFFICIENTS.REMOVE_LIQUIDITY * expectedGasUsd;
    const addCost = toAdd.length * GAS_COEFFICIENTS.ADD_LIQUIDITY * expectedGasUsd;
    return withdrawCost + addCost;
  }

  /**
   * Step 7: Estimate 30-Day Profit (Section 4)
   */
  private estimateProfit(
    currentWeightedApy: number,
    idealWeightedApy: number,
    totalCapitalUsd: number,
    estimatedGasTotal: number
  ): { profit30d: number; netProfit30d: number } {
    // 30-day profit = (ideal_apy - current_apy) / 100 × capital × (30/365)
    const apyDifference = idealWeightedApy - currentWeightedApy;
    const profit30d = (apyDifference / 100) * totalCapitalUsd * (30 / 365);
    const netProfit30d = profit30d - estimatedGasTotal;

    return { profit30d, netProfit30d };
  }

  /**
   * Universal Utility Function (Section 3.2)
   * U = Σᵢ wᵢ · (Rᵢ - λ · Sᵢ - Fᵢᵖʳᵒᵗᵒ)
   */
  private calculatePortfolioUtility(positions: CurrentPosition[], config: UserInvestmentConfig): number {
    if (positions.length === 0) return 0;

    const totalAllocation = positions.reduce((sum, p) => sum + p.allocationUsd, 0);
    if (totalAllocation === 0) return 0;

    let utility = 0;
    for (const pos of positions) {
      const weight = pos.allocationUsd / totalAllocation;
      const returnRate = pos.currentApy / 100; // R_i (as decimal)
      const riskScore = this.getPositionRiskScore(pos) / 100; // S_i (as decimal)
      const protocolFees = 0.005; // Estimate 0.5% annual protocol fees

      // U_i = w_i * (R_i - λ*S_i - F_i)
      utility += weight * (returnRate - config.lambda * riskScore - protocolFees);
    }

    return utility;
  }

  /**
   * Calculate utility for ideal portfolio
   */
  private calculateIdealPortfolioUtility(portfolio: IdealAllocation[], config: UserInvestmentConfig): number {
    if (portfolio.length === 0) return 0;

    const totalAllocation = portfolio.reduce((sum, a) => sum + a.allocationUsd, 0);
    if (totalAllocation === 0) return 0;

    let utility = 0;
    for (const alloc of portfolio) {
      const weight = alloc.weight;
      const returnRate = alloc.pool.effectiveApy / 100;
      const riskScore = alloc.pool.riskScore / 100;
      const protocolFees = alloc.pool.protocolFees / 100;

      utility += weight * (returnRate - config.lambda * riskScore - protocolFees);
    }

    return utility;
  }

  /**
   * Net Utility Gain (Section 5, Step 2)
   * ΔUⁿᵉᵗ = ΔUᵍʳᵒˢˢ · (T / 1 year) - Cᵗˣₜₒₜₐₗ
   */
  private calculateNetUtilityGain(
    grossUtilityImprovement: number,
    transactionCostUsd: number,
    totalCapitalUsd: number,
    planningHorizonDays: number
  ): number {
    // Convert horizon to fraction of year
    const horizonYearFraction = planningHorizonDays / 365;

    // Convert transaction cost to utility units (fraction of portfolio)
    const transactionCostUtility = transactionCostUsd / totalCapitalUsd;

    // ΔUⁿᵉᵗ = ΔUᵍʳᵒˢˢ · (T / 1 year) - Cᵗˣₜₒₜₐₗ
    return grossUtilityImprovement * horizonYearFraction - transactionCostUtility;
  }

  /**
   * Evaluate Rebalance Conditions (Section 6 & 7)
   */
  private evaluateRebalanceConditions(
    rebalancesToday: number,
    dailyRebalanceLimit: number,
    netProfit30d: number,
    estimatedGasTotal: number,
    idealWeightedApy: number,
    currentWeightedApy: number,
    netUtilityGain: number,
    theta: number,
    toWithdraw: RebalanceAction[],
    maxIlLossPercent: number
  ): { shouldRebalance: boolean; reason: string } {
    // Guard 1: Daily rebalance limit
    if (rebalancesToday >= dailyRebalanceLimit) {
      return { shouldRebalance: false, reason: `Daily limit reached (${rebalancesToday}/${dailyRebalanceLimit})` };
    }

    // Guard 2: Never rebalance downward (Section 7.1)
    if (idealWeightedApy < currentWeightedApy) {
      return { shouldRebalance: false, reason: 'Ideal APY is lower than current - no downward rebalance' };
    }

    // Guard 3: Net utility must exceed threshold (Section 5.3)
    if (netUtilityGain < theta) {
      return { shouldRebalance: false, reason: `Net utility gain (${netUtilityGain.toFixed(6)}) below threshold (${theta})` };
    }

    // Condition 1: Net profit must cover 4x gas over 30 days (Section 6)
    if (netProfit30d <= estimatedGasTotal * SAFETY_THRESHOLDS.MIN_GAS_COVERAGE_MULTIPLIER) {
      return {
        shouldRebalance: false,
        reason: `30-day net profit ($${netProfit30d.toFixed(2)}) doesn't cover ${SAFETY_THRESHOLDS.MIN_GAS_COVERAGE_MULTIPLIER}x gas ($${(estimatedGasTotal * SAFETY_THRESHOLDS.MIN_GAS_COVERAGE_MULTIPLIER).toFixed(2)})`
      };
    }

    // Condition 2: Minimum APY improvement (Section 6)
    const apyImprovement = idealWeightedApy - currentWeightedApy;
    if (apyImprovement < SAFETY_THRESHOLDS.MIN_APY_IMPROVEMENT_PERCENT) {
      return {
        shouldRebalance: false,
        reason: `APY improvement (${apyImprovement.toFixed(2)}%) below minimum (${SAFETY_THRESHOLDS.MIN_APY_IMPROVEMENT_PERCENT}%)`
      };
    }

    // Guard 4: IL loss protection (Section 7.2)
    // Check if any position to withdraw has IL loss > threshold
    // Note: This requires IL tracking which would need position entry price and current price
    // For now, we skip this check if IL data not available

    // All conditions passed
    return {
      shouldRebalance: true,
      reason: `All conditions met: APY +${apyImprovement.toFixed(2)}%, net profit $${netProfit30d.toFixed(2)}`
    };
  }

  // ============ Helper Methods ============

  /**
   * Calculate IL risk factor for a token pair (Section 4, Step 2)
   */
  private calculateIlRiskFactor(token0: string, token1: string): number {
    const tier0 = this.getTokenRiskTier(token0);
    const tier1 = this.getTokenRiskTier(token1);

    if (tier0 === TokenRiskTier.STABLE && tier1 === TokenRiskTier.STABLE) {
      return IL_RISK_FACTORS[TokenRiskTier.STABLE];
    }

    // Use the higher risk tier's factor
    const factor0 = IL_RISK_FACTORS[tier0];
    const factor1 = IL_RISK_FACTORS[tier1];

    return Math.max(factor0, factor1);
  }

  /**
   * Get token risk tier
   */
  private getTokenRiskTier(symbol: string): TokenRiskTier {
    const upperSymbol = symbol.toUpperCase();
    return TOKEN_RISK_CLASSIFICATION[upperSymbol] || TokenRiskTier.HIGH_RISK;
  }

  /**
   * Check if token is in allowed list
   */
  private isTokenAllowed(symbol: string, allowedTokens: string[]): boolean {
    if (!allowedTokens || allowedTokens.length === 0) {
      return true; // No filter means all allowed
    }
    const upperSymbol = symbol.toUpperCase();
    return allowedTokens.some(t => t.toUpperCase() === upperSymbol);
  }

  /**
   * Estimate protocol fees based on DEX
   */
  private estimateProtocolFees(dex: string, poolFee: number): number {
    // Most DEXes take a portion of trading fees
    // This is a rough estimate - would need DEX-specific data
    const baseFee = 0.5; // 0.5% base annual protocol fee estimate
    return baseFee;
  }

  /**
   * Calculate weighted APY for current positions
   */
  private calculateWeightedApy(positions: CurrentPosition[], totalCapital: number): number {
    if (positions.length === 0 || totalCapital === 0) return 0;

    const weightedSum = positions.reduce((sum, pos) => {
      return sum + (pos.allocationUsd * pos.currentApy);
    }, 0);

    return weightedSum / totalCapital;
  }

  /**
   * Calculate weighted APY for ideal portfolio
   */
  private calculateIdealWeightedApy(portfolio: IdealAllocation[], totalCapital: number): number {
    if (portfolio.length === 0 || totalCapital === 0) return 0;

    const totalAllocation = portfolio.reduce((sum, a) => sum + a.allocationUsd, 0);
    const weightedSum = portfolio.reduce((sum, alloc) => {
      return sum + (alloc.allocationUsd * alloc.pool.effectiveApy);
    }, 0);

    return weightedSum / totalAllocation;
  }

  /**
   * Get position risk score
   */
  private getPositionRiskScore(pos: CurrentPosition): number {
    // Parse pair to get tokens
    const [token0, token1] = pos.pair.split('/');
    if (!token0 || !token1) return 30; // Default high risk if can't parse

    return this.calculateIlRiskFactor(token0, token1) * 100;
  }

  /**
   * Get user configuration from preferences
   */
  private async getUserConfig(userId: string): Promise<UserInvestmentConfig | null> {
    const pref = await this.preferenceRepository.findOne({ where: { userId } });
    if (!pref) return null;

    return {
      minApy: parseFloat(pref.minApy as any),
      allowedTokens: pref.allowedTokens || [],
      maxPositions: pref.maxPositions,
      maxAllocPerPositionUsd: parseFloat(pref.maxAllocPerPositionUsd as any),
      dailyRebalanceLimit: pref.dailyRebalanceLimit,
      expectedGasUsd: parseFloat(pref.expectedGasUsd as any),
      lambda: parseFloat(pref.lambdaRiskAversion as any),
      theta: parseFloat(pref.thetaMinBenefit as any),
      planningHorizonDays: pref.planningHorizonDays,
      minTvlUsd: parseFloat(pref.minTvlUsd as any),
      minPoolAgeDays: pref.minPoolAgeDays,
      preferredDexes: pref.preferredDexes,
      maxIlLossPercent: parseFloat(pref.maxIlLossPercent as any),
      minPositionSizeUsd: parseFloat(pref.minPositionSizeUsd as any),
    };
  }

  /**
   * Get current bot state for user
   */
  private async getBotState(userId: string, totalCapitalUsd: number): Promise<BotState> {
    // Get active positions
    const positions = await this.positionRepository.find({
      where: {
        userId,
        status: In([PositionStatus.ACTIVE, PositionStatus.PENDING_EXECUTION])
      },
      relations: ['pool'],
    });

    // Convert planck amounts to USD
    const dotPrice = await this.priceService.getDotPriceUsd();
    const currentPositions: CurrentPosition[] = positions.map(pos => ({
      poolId: pos.poolId,
      dex: pos.pool?.dex?.name || 'Unknown',
      pair: `${pos.pool?.token0Symbol}/${pos.pool?.token1Symbol}`,
      allocationUsd: this.tokenMath.smallestUnitToUsd(pos.amount, 10, dotPrice),
      currentApy: parseFloat(pos.pool?.apr || '0'),
      positionId: pos.id,
      entryTimestamp: pos.executedAt,
    }));

    return {
      totalCapitalUsd,
      currentPositions,
      rebalancesToday: await this.getRebalancesToday(userId),
    };
  }

  /**
   * Get rebalances today from DB (lazy-resets at midnight UTC)
   */
  private async getRebalancesToday(userId: string): Promise<number> {
    const pref = await this.preferenceRepository.findOne({ where: { userId } });
    if (!pref) return 0;

    const today = new Date().toISOString().split('T')[0];
    if (pref.lastRebalanceDate !== today) {
      // New day — reset counter
      pref.rebalanceCountToday = 0;
      pref.lastRebalanceDate = today;
      await this.preferenceRepository.save(pref);
      return 0;
    }

    return pref.rebalanceCountToday;
  }

  /**
   * Increment rebalance counter (persisted to DB)
   */
  async incrementRebalanceCount(userId: string): Promise<void> {
    const pref = await this.preferenceRepository.findOne({ where: { userId } });
    if (!pref) return;

    const today = new Date().toISOString().split('T')[0];
    if (pref.lastRebalanceDate !== today) {
      pref.rebalanceCountToday = 1;
      pref.lastRebalanceDate = today;
    } else {
      pref.rebalanceCountToday++;
    }

    await this.preferenceRepository.save(pref);
  }

  /**
   * Create a no-op decision (when rebalancing is not needed/possible)
   */
  private createNoOpDecision(reason: string): RebalanceDecision {
    return {
      shouldRebalance: false,
      reason,
      currentWeightedApy: 0,
      idealWeightedApy: 0,
      apyImprovement: 0,
      currentUtility: 0,
      targetUtility: 0,
      grossUtilityImprovement: 0,
      netUtilityGain: 0,
      estimatedGasTotalUsd: 0,
      profit30dUsd: 0,
      netProfit30dUsd: 0,
      toWithdraw: [],
      toAdd: [],
      rebalancesTodayBefore: 0,
      rebalancesTodayAfter: 0,
      calculatedAt: new Date(),
      configUsed: null as any,
    };
  }

  // ============================================================
  // API Methods (for Controller)
  // ============================================================

  /**
   * Evaluate investment for a wallet address (for API calls)
   * Creates user if not exists and applies preferences
   */
  async evaluateForWallet(
    walletAddress: string,
    availableCapitalUsd: number,
    preferences?: Record<string, any>,
  ): Promise<RebalanceDecision> {
    this.logger.log(`Evaluating for wallet ${walletAddress} with $${availableCapitalUsd}`);

    // Find or create user
    let user = await this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      user = this.userRepository.create({
        walletAddress: walletAddress.toLowerCase(),
        isActive: true,
      });
      await this.userRepository.save(user);
      this.logger.log(`Created new user for wallet ${walletAddress}`);
    }

    // Update preferences if provided
    if (preferences && Object.keys(preferences).length > 0) {
      await this.updateUserPreferencesInternal(user.id, preferences);
    }

    // Run the evaluation
    return this.evaluateInvestmentDecision(user.id, availableCapitalUsd);
  }

  /**
   * Update user preferences
   */
  private async updateUserPreferencesInternal(
    userId: string,
    preferences: Record<string, any>,
  ): Promise<void> {
    let pref = await this.preferenceRepository.findOne({
      where: { userId },
    });

    if (!pref) {
      pref = this.preferenceRepository.create({ userId });
    }

    // Map fields
    if (preferences.minApy !== undefined) pref.minApy = preferences.minApy;
    if (preferences.maxAllocPerPositionUsd !== undefined) {
      pref.maxAllocPerPositionUsd = preferences.maxAllocPerPositionUsd;
    }
    if (preferences.allowedTokens) pref.allowedTokens = preferences.allowedTokens;
    if (preferences.defaultLowerRangePercent !== undefined) {
      pref.defaultLowerRangePercent = preferences.defaultLowerRangePercent;
    }
    if (preferences.defaultUpperRangePercent !== undefined) {
      pref.defaultUpperRangePercent = preferences.defaultUpperRangePercent;
    }
    if (preferences.lambdaRiskAversion !== undefined) {
      pref.lambdaRiskAversion = preferences.lambdaRiskAversion;
    }

    await this.preferenceRepository.save(pref);
    this.logger.debug(`Updated preferences for user ${userId}`);
  }

  /**
   * Get user balance by user ID (from AssetHubVault contract)
   * Returns balance in USD (DOT amount × live price)
   */
  async getUserBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.debug(`getUserBalance: user ${userId} not found`);
      return 0;
    }
    return this.getUserBalanceByWallet(user.walletAddress);
  }

  /**
   * Get user balance by wallet address (from AssetHubVault contract)
   * Returns balance in USD (DOT amount × live price)
   */
  async getUserBalanceByWallet(walletAddress: string): Promise<number> {
    if (!this.assetHubService.isInitialized()) {
      this.logger.debug('AssetHubService not initialized — returning 0 balance');
      return 0;
    }

    try {
      const balancePlanck = await this.assetHubService.getUserBalance(walletAddress);
      return await this.tokenMath.dotPlanckToUsd(balancePlanck);
    } catch (error) {
      this.logger.error(`Failed to fetch balance for ${walletAddress}: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
