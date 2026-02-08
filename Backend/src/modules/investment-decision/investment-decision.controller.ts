<<<<<<< Updated upstream
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
=======
import { Body, Controller, Param, Post } from '@nestjs/common';
>>>>>>> Stashed changes
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InvestmentDecisionService } from './investment-decision.service';
import { RebalanceDecision, RebalanceAction } from './types/investment.types';

<<<<<<< Updated upstream
// ============================================================
// DTOs - Request/Response Types
// ============================================================

/**
 * Investment decision request DTO
 * Supports both legacy frontend format and new enhanced format
 */
export class InvestmentDecisionRequestDto {
  /** User's wallet address (required) */
  walletAddress: string;

  /** Amount to invest in USD */
  depositAmount?: number;

  /** Selected deposit coin symbol (e.g., "USDC") */
  selectedDepositCoin?: string;

  /** User preferences for investment */
  preferences?: UserPreferencesDto;
}

export class UserPreferencesDto {
  /** Minimum acceptable APY (e.g., 8 for 8%) */
  minApy?: number;

  /** Max allocation per pool as percentage (e.g., 20 for 20%) */
  maxAllocation?: number;

  /** List of allowed token symbols */
  allowedTokens?: string[];

  /** Risk strategy: "conservative" | "moderate" | "aggressive" */
  riskStrategy?: string;

  /** Stop-loss and take-profit range [stopLoss, takeProfit] */
  slTpRange?: [number, number];

  /** Risk aversion factor (0-1, higher = more risk averse) */
  lambdaRiskAversion?: number;
}

/**
 * Token info in a pool
 */
export interface TokenInfo {
  symbol: string;
  address: string;
  decimals?: number;
  riskTier?: string;
}

/**
 * Enhanced pool decision with both legacy and new fields
 */
export interface PoolDecision {
  // === Legacy fields (for frontend compatibility) ===
  poolId: string;
  pairName: string;
  token0: TokenInfo;
  token1: TokenInfo;
  approximateAPR: number;
  totalValueLockedUSD: number;
  stopLoss: number;
  takeProfit: number;
  proportion: number;

  // === Enhanced fields (new algorithm data) ===
  poolAddress?: string;
  dex?: string;
  fee?: number;

  /** Risk-adjusted APY after IL factor */
  realApy?: number;

  /** Effective APY after risk aversion applied */
  effectiveApy?: number;

  /** Impermanent loss risk factor (0-0.30) */
  ilRiskFactor?: number;

  /** Utility score from optimization */
  utilityScore?: number;

  /** Allocation in USD */
  allocationUsd?: number;

  /** 24h trading volume */
  volume24hUsd?: number;

  /** Pool age in days */
  poolAgeDays?: number;
}

/**
 * Investment decision response
 * Contains both legacy format for frontend and enhanced metadata
 */
export interface InvestmentDecisionResponse {
  success: boolean;
  message: string;

  /** Pool allocation decisions */
  decisions: PoolDecision[];

  /** Portfolio-level metadata */
  metadata?: {
    totalCapitalUsd: number;
    currentWeightedApy: number;
    idealWeightedApy: number;
    apyImprovement: number;
    estimatedGasUsd: number;
    profit30dUsd: number;
    netProfit30dUsd: number;
    calculatedAt: string;

    // Utility analysis
    currentUtility?: number;
    targetUtility?: number;
    netUtilityGain?: number;

    // Rebalancing info
    shouldRebalance: boolean;
    rebalancesToday?: number;
    dailyRebalanceLimit?: number;
  };

  /** Actions to execute (for automation) */
  actions?: {
    toWithdraw: RebalanceAction[];
    toAdd: RebalanceAction[];
  };
}

// ============================================================
// Controller
// ============================================================

@ApiTags('investment-decision')
@Controller('investmentDecisions')
export class InvestmentDecisionController {
  private readonly logger = new Logger(InvestmentDecisionController.name);

  constructor(
    private readonly investmentDecisionService: InvestmentDecisionService,
  ) { }
=======
@ApiTags('investment-decision')
@Controller('users/:userId/decision')
export class InvestmentDecisionController {
  constructor(private readonly decisionService: InvestmentDecisionService) { }

  @ApiOperation({ summary: 'Run investment decision logic for a user (dry run or execute)' })
  @Post('run')
  async run(@Param('userId') userId: string, @Body() body: RunDecisionDto) {
    return this.decisionService.runDecision({
      userId,
      totalCapitalUsd: body.totalCapitalUsd,
      totalCapitalBaseAssetWei: body.totalCapitalBaseAssetWei
        ? BigInt(body.totalCapitalBaseAssetWei)
        : undefined,
      deriveTotalCapitalFromVault: body.deriveTotalCapitalFromVault,
      deriveCurrentPositionsFromVault: body.deriveCurrentPositionsFromVault,
      rebalancesToday: body.rebalancesToday,
      baseAssetAddress: body.baseAssetAddress,
      userWalletAddress: body.userWalletAddress,
    });
  }
>>>>>>> Stashed changes

  /**
   * POST /api/investmentDecisions
   * 
   * Calculate optimal investment decisions for a user.
   * Returns both legacy format (for current frontend) and enhanced data.
   */
<<<<<<< Updated upstream
  @ApiOperation({ summary: 'Calculate optimal investment allocation' })
  @Post()
  @HttpCode(HttpStatus.OK)
  async getInvestmentDecisions(
    @Body() dto: InvestmentDecisionRequestDto,
  ): Promise<InvestmentDecisionResponse> {
    this.logger.log(`Investment decision request for wallet: ${dto.walletAddress}`);
=======
  @ApiOperation({ summary: 'Preview allocation for hypothetical capital' })
  @Post('preview-allocation')
  async previewAllocation(@Param('userId') userId: string, @Body() dto: PreviewAllocationDto) {
    return this.decisionService.previewInitialAllocation({ userId, ...dto });
  }
>>>>>>> Stashed changes

    // Validation
    if (!dto.walletAddress) {
      throw new BadRequestException('walletAddress is required');
    }

    const availableCapitalUsd = dto.depositAmount || 0;
    if (availableCapitalUsd <= 0) {
      return {
        success: false,
        message: 'No deposit amount specified. Please enter an amount to invest.',
        decisions: [],
      };
    }

    try {
      // Evaluate investment using the service
      const decision = await this.investmentDecisionService.evaluateForWallet(
        dto.walletAddress,
        availableCapitalUsd,
        this.mapPreferencesToConfig(dto.preferences, availableCapitalUsd),
      );

      // Convert to response format
      return this.buildResponse(decision, availableCapitalUsd, dto.preferences);
    } catch (error) {
      this.logger.error(`Investment decision failed: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Failed to calculate investment decisions: ${error.message}`,
        decisions: [],
      };
    }
  }

  /**
   * GET /api/investmentDecisions/wallet/:address
   * 
   * Get investment recommendations for a wallet without executing.
   */
  @Get('wallet/:address')
  async getDecisionsForWallet(
    @Param('address') walletAddress: string,
  ): Promise<InvestmentDecisionResponse> {
    this.logger.log(`Getting decisions for wallet: ${walletAddress}`);

    try {
      // Get user's balance from blockchain
      const balance = await this.investmentDecisionService.getUserBalanceByWallet(walletAddress);

      if (balance <= 0) {
        return {
          success: true,
          message: 'No balance found. Please deposit funds first.',
          decisions: [],
          metadata: {
            totalCapitalUsd: 0,
            currentWeightedApy: 0,
            idealWeightedApy: 0,
            apyImprovement: 0,
            estimatedGasUsd: 0,
            profit30dUsd: 0,
            netProfit30dUsd: 0,
            calculatedAt: new Date().toISOString(),
            shouldRebalance: false,
          },
        };
      }

      const decision = await this.investmentDecisionService.evaluateForWallet(
        walletAddress,
        balance,
      );

      return this.buildResponse(decision, balance);
    } catch (error) {
      this.logger.error(`Failed to get decisions: ${error.message}`);
      return {
        success: false,
        message: error.message,
        decisions: [],
      };
    }
  }

  /**
   * GET /api/investmentDecisions/user/:userId
   * 
   * Get investment recommendations for a user by ID.
   */
  @Get('user/:userId')
  async getDecisionsForUser(
    @Param('userId') userId: string,
  ): Promise<InvestmentDecisionResponse> {
    this.logger.log(`Getting decisions for user: ${userId}`);

    try {
      const balance = await this.investmentDecisionService.getUserBalance(userId);

      if (balance <= 0) {
        return {
          success: true,
          message: 'No balance found. Please deposit funds first.',
          decisions: [],
        };
      }

      const decision = await this.investmentDecisionService.evaluateInvestmentDecision(
        userId,
        balance,
      );

      return this.buildResponse(decision, balance);
    } catch (error) {
      this.logger.error(`Failed to get decisions: ${error.message}`);
      return {
        success: false,
        message: error.message,
        decisions: [],
      };
    }
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Map frontend preferences to service config format
   */
  private mapPreferencesToConfig(
    prefs: UserPreferencesDto | undefined,
    capitalUsd: number,
  ): Record<string, any> | undefined {
    if (!prefs) return undefined;

    const config: Record<string, any> = {};

    if (prefs.minApy !== undefined) {
      config.minApy = prefs.minApy;
    }

    if (prefs.maxAllocation !== undefined) {
      // Convert percentage to USD amount
      config.maxAllocPerPositionUsd = (prefs.maxAllocation / 100) * capitalUsd;
    }

    if (prefs.allowedTokens?.length) {
      config.allowedTokens = prefs.allowedTokens;
    }

    if (prefs.slTpRange) {
      config.defaultLowerRangePercent = prefs.slTpRange[0];
      config.defaultUpperRangePercent = prefs.slTpRange[1];
    }

    if (prefs.lambdaRiskAversion !== undefined) {
      config.lambdaRiskAversion = prefs.lambdaRiskAversion;
    }

    // Map risk strategy to lambda
    if (prefs.riskStrategy) {
      switch (prefs.riskStrategy) {
        case 'conservative':
          config.lambdaRiskAversion = 0.8;
          break;
        case 'moderate':
          config.lambdaRiskAversion = 0.5;
          break;
        case 'aggressive':
          config.lambdaRiskAversion = 0.2;
          break;
      }
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }

  /**
   * Build the response with both legacy and enhanced fields
   */
  private buildResponse(
    decision: RebalanceDecision,
    totalCapitalUsd: number,
    preferences?: UserPreferencesDto,
  ): InvestmentDecisionResponse {
    // Build pool decisions from toAdd actions
    const decisions: PoolDecision[] = decision.toAdd.map((action) => {
      const poolData = (action as any).poolData || {};
      const slTpRange = preferences?.slTpRange || [-5, 10];

      return {
        // Legacy fields
        poolId: action.poolId,
        pairName: poolData.pair || `${poolData.token0Symbol || '???'}/${poolData.token1Symbol || '???'}`,
        token0: {
          symbol: poolData.token0Symbol || '',
          address: poolData.token0Address || '',
          decimals: poolData.token0Decimals,
          riskTier: poolData.token0RiskTier,
        },
        token1: {
          symbol: poolData.token1Symbol || '',
          address: poolData.token1Address || '',
          decimals: poolData.token1Decimals,
          riskTier: poolData.token1RiskTier,
        },
        approximateAPR: poolData.apy30dAverage || decision.idealWeightedApy,
        totalValueLockedUSD: poolData.tvlUsd || 0,
        stopLoss: slTpRange[0],
        takeProfit: slTpRange[1],
        proportion: totalCapitalUsd > 0
          ? (action.targetAllocationUsd / totalCapitalUsd) * 100
          : 0,

        // Enhanced fields
        poolAddress: poolData.poolAddress,
        dex: poolData.dex,
        fee: poolData.fee,
        realApy: poolData.realApy,
        effectiveApy: poolData.effectiveApy,
        ilRiskFactor: poolData.ilRiskFactor,
        utilityScore: poolData.utilityScore,
        allocationUsd: action.targetAllocationUsd,
        volume24hUsd: poolData.volume24hUsd,
        poolAgeDays: poolData.ageInDays,
      };
    });

    return {
      success: true,
      message: decision.shouldRebalance
        ? `Recommended portfolio allocation with ${decision.toAdd.length} positions`
        : decision.reason || 'Portfolio analysis complete',
      decisions,
      metadata: {
        totalCapitalUsd,
        currentWeightedApy: decision.currentWeightedApy,
        idealWeightedApy: decision.idealWeightedApy,
        apyImprovement: decision.apyImprovement,
        estimatedGasUsd: decision.estimatedGasTotalUsd,
        profit30dUsd: decision.profit30dUsd,
        netProfit30dUsd: decision.netProfit30dUsd,
        calculatedAt: decision.calculatedAt.toISOString(),
        currentUtility: decision.currentUtility,
        targetUtility: decision.targetUtility,
        netUtilityGain: decision.netUtilityGain,
        shouldRebalance: decision.shouldRebalance,
        rebalancesToday: decision.rebalancesTodayBefore,
        dailyRebalanceLimit: decision.configUsed?.dailyRebalanceLimit,
      },
      actions: {
        toWithdraw: decision.toWithdraw,
        toAdd: decision.toAdd,
      },
    };
  }
}
