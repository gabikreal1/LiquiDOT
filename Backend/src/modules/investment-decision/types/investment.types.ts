/**
 * Investment Decision Types
 * Based on defi_investment_bot_spec.md
 */

/**
 * Token risk tiers for Impermanent Loss calculation
 * From defi_investment_bot_spec.md Section 8.4
 */
export enum TokenRiskTier {
  STABLE = 'STABLE',       // IL factor 0.00 (USDC, USDT, DAI)
  BLUECHIP = 'BLUECHIP',   // IL factor 0.08 (ETH, WETH, WBTC)
  MIDCAP = 'MIDCAP',       // IL factor 0.18 (AAVE, UNI, etc.)
  HIGH_RISK = 'HIGH_RISK', // IL factor 0.30 (all others)
}

/**
 * IL Risk factors by tier (Section 4, Step 2)
 */
export const IL_RISK_FACTORS: Record<TokenRiskTier, number> = {
  [TokenRiskTier.STABLE]: 0.00,
  [TokenRiskTier.BLUECHIP]: 0.08,
  [TokenRiskTier.MIDCAP]: 0.18,
  [TokenRiskTier.HIGH_RISK]: 0.30,
};

/**
 * Known token classifications
 */
export const TOKEN_RISK_CLASSIFICATION: Record<string, TokenRiskTier> = {
  // Stables (Tier 0)
  'USDC': TokenRiskTier.STABLE,
  'USDT': TokenRiskTier.STABLE,
  'DAI': TokenRiskTier.STABLE,
  'USDC.e': TokenRiskTier.STABLE,
  'FRAX': TokenRiskTier.STABLE,
  'BUSD': TokenRiskTier.STABLE,
  'TUSD': TokenRiskTier.STABLE,
  'xcUSDT': TokenRiskTier.STABLE,
  'xcUSDC': TokenRiskTier.STABLE,
  
  // Blue-chip (Tier 1)
  'ETH': TokenRiskTier.BLUECHIP,
  'WETH': TokenRiskTier.BLUECHIP,
  'WBTC': TokenRiskTier.BLUECHIP,
  'BTC': TokenRiskTier.BLUECHIP,
  'stETH': TokenRiskTier.BLUECHIP,
  'wstETH': TokenRiskTier.BLUECHIP,
  'GLMR': TokenRiskTier.BLUECHIP, // Native Moonbeam
  'WGLMR': TokenRiskTier.BLUECHIP,
  'DOT': TokenRiskTier.BLUECHIP,
  'xcDOT': TokenRiskTier.BLUECHIP,
  
  // Mid-cap (Tier 2)
  'AAVE': TokenRiskTier.MIDCAP,
  'UNI': TokenRiskTier.MIDCAP,
  'LINK': TokenRiskTier.MIDCAP,
  'CRV': TokenRiskTier.MIDCAP,
  'MKR': TokenRiskTier.MIDCAP,
  'SNX': TokenRiskTier.MIDCAP,
  'COMP': TokenRiskTier.MIDCAP,
  'SUSHI': TokenRiskTier.MIDCAP,
  'STELLA': TokenRiskTier.MIDCAP,
  'WELL': TokenRiskTier.MIDCAP,
};

/**
 * Current position representation (Section 2)
 */
export interface CurrentPosition {
  poolId: string;
  dex: string;
  pair: string;
  allocationUsd: number;
  currentApy: number;
  positionId: string;
  entryTimestamp?: Date;
  ilLossPercent?: number;
}

/**
 * Bot state variables (Section 2)
 */
export interface BotState {
  totalCapitalUsd: number;
  currentPositions: CurrentPosition[];
  rebalancesToday: number;
  lastRebalanceAt?: Date;
}

/**
 * User configuration (Section 1 & 9)
 */
export interface UserInvestmentConfig {
  minApy: number;                    // Minimum acceptable APY (e.g., 8%)
  allowedTokens: string[];           // Approved tokens
  maxPositions: number;              // Maximum concurrent positions (e.g., 6)
  maxAllocPerPositionUsd: number;    // Maximum per position in USD
  dailyRebalanceLimit: number;       // Maximum rebalances per day
  expectedGasUsd: number;            // Expected gas cost in USD
  lambda: number;                    // Risk aversion parameter
  theta: number;                     // Minimum net benefit threshold
  planningHorizonDays: number;       // Planning horizon for rebalancing
  minTvlUsd: number;                 // Minimum pool TVL
  minPoolAgeDays: number;            // Minimum pool age
  preferredDexes?: string[];         // Optional DEX whitelist
  maxIlLossPercent: number;          // Max IL loss before postponing exit
  minPositionSizeUsd: number;        // Min position size (below not worth gas)
}

/**
 * Pool candidate after filtering (Section 4, Step 1)
 */
export interface PoolCandidate {
  poolId: string;
  poolAddress: string;
  dex: string;
  pair: string;
  token0Symbol: string;
  token1Symbol: string;
  apy30dAverage: number;
  tvlUsd: number;
  volume24hUsd: number;
  ageInDays: number;
  fee: number;
  
  // Calculated fields
  ilRiskFactor: number;
  realApy: number;
  effectiveApy: number;
  riskScore: number;
  protocolFees: number;
}

/**
 * Ideal portfolio allocation (Section 4, Step 4)
 */
export interface IdealAllocation {
  poolId: string;
  pool: PoolCandidate;
  allocationUsd: number;
  weight: number; // Portfolio weight (0-1)
}

/**
 * Rebalancing action (Section 4, Step 5)
 */
export interface RebalanceAction {
  type: 'WITHDRAW' | 'ADD' | 'ADJUST';
  positionId?: string;  // Existing position (for WITHDRAW/ADJUST)
  poolId: string;
  currentAllocationUsd: number;
  targetAllocationUsd: number;
  differenceUsd: number;
}

/**
 * Rebalancing decision output (Section 5 & 6)
 */
export interface RebalanceDecision {
  shouldRebalance: boolean;
  reason: string;
  
  // Portfolio analysis
  currentWeightedApy: number;
  idealWeightedApy: number;
  apyImprovement: number;
  
  // Utility calculations (Section 3)
  currentUtility: number;
  targetUtility: number;
  grossUtilityImprovement: number;
  netUtilityGain: number;
  
  // Cost estimates (Section 4, Step 6)
  estimatedGasTotalUsd: number;
  profit30dUsd: number;
  netProfit30dUsd: number;
  
  // Actions to take
  toWithdraw: RebalanceAction[];
  toAdd: RebalanceAction[];
  
  // State
  rebalancesTodayBefore: number;
  rebalancesTodayAfter: number;
  
  // Metadata
  calculatedAt: Date;
  configUsed: UserInvestmentConfig;
}

/**
 * Gas cost coefficients (Section 8.3)
 */
export const GAS_COEFFICIENTS = {
  REMOVE_LIQUIDITY: 1.8,  // Remove liquidity + swap if needed
  ADD_LIQUIDITY: 1.6,     // Swap if needed + add liquidity
};

/**
 * Safety thresholds (Section 7)
 */
export const SAFETY_THRESHOLDS = {
  MIN_APY_IMPROVEMENT_PERCENT: 0.7,     // 0.7% minimum APY improvement
  MIN_GAS_COVERAGE_MULTIPLIER: 4,       // Net profit must be 4x gas over 30 days
  MAX_REBALANCES_PER_HOUR: 2,           // Rate limiting
  MIN_POSITION_SIZE_USD: 3000,          // Below this, not worth gas
  DEFAULT_IL_LOSS_THRESHOLD: 6,         // 6% IL loss threshold
};
