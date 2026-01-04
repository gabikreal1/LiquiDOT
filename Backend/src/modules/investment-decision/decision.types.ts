export type TokenSymbol = string;

export type DexName = string;

export interface DecisionPreferences {
  /** Minimum APY/APR percentage (e.g. 8 for 8%). */
  minApyPct: number;

  /**
   * Token addresses that are allowed to appear in pool pairs (both tokens must be allowed).
   *
   * Preferred over symbols because symbols are not unique across chains/bridges.
   */
  allowedTokenAddresses?: string[];

  /** Token symbols that are allowed to appear in pool pairs (both tokens must be allowed). */
  allowedTokenSymbols: TokenSymbol[];

  /** DEX names that are allowed. If empty/undefined, all dexes are allowed. */
  allowedDexNames?: DexName[];

  /** Maximum number of positions allowed in the portfolio. */
  maxPositions: number;

  /** Maximum allocation per position in USD. */
  maxAllocPerPosUsd: number;

  /** Skip allocations smaller than this; default is 3000 USD. */
  minPositionSizeUsd?: number;

  /** Minimum TVL for pools in USD; default is 1_000_000. */
  minTvlUsd?: number;

  /** Minimum pool age in days; default is 14. */
  minAgeDays?: number;

  /** Daily rebalance limit; default is 8. */
  dailyRebalanceLimit?: number;

  /** Expected gas cost in USD, used for estimating rebalance cost; default is 1.0. */
  expectedGasUsd?: number;

  /** Minimum APY improvement threshold required for executing; default is 0.7 (% points). */
  minApyImprovementPct?: number;

  /** Profit must cover gas by this multiplier; default is 4. */
  gasCoverMultiplier?: number;
}

export interface CurrentPositionSnapshot {
  positionId: string;
  poolAddress: string;
  dexName: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Address?: string;
  token1Address?: string;
  allocationUsd: number;
  currentApyPct: number;
  /** Optional impermanent loss percentage (0..100). If absent, IL-based safeguard can be skipped. */
  impermanentLossPct?: number;
}

export interface CandidatePoolSnapshot {
  poolId: string;
  poolAddress: string;
  dexName: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Address?: string;
  token1Address?: string;

  apy30dAvgPct: number;
  tvlUsd: number;
  ageDays: number;

  /** Optional category hint. If missing, it will be inferred from token symbols. */
  categoryHint?: 'stable-stable' | 'bluechip-volatile' | 'midcap' | 'other';
}

export interface IdealPosition {
  poolAddress: string;
  dexName: string;
  token0Symbol: string;
  token1Symbol: string;
  allocationUsd: number;
  effectiveApyPct: number;
  ilRiskFactor: number;
}

export interface RebalanceActions {
  toWithdraw: CurrentPositionSnapshot[];
  toAdd: IdealPosition[];
  toAdjust: Array<{
    poolAddress: string;
    fromAllocationUsd: number;
    toAllocationUsd: number;
  }>;
}

export interface DecisionMetrics {
  currentWeightedApyPct: number;
  idealWeightedApyPct: number;
  estimatedGasTotalUsd: number;
  profit30dUsd: number;
  netProfit30dUsd: number;
}

export interface InvestmentDecisionResult {
  decisionId: string;
  createdAt: string;

  eligibleCandidates: Array<CandidatePoolSnapshot & { effectiveApyPct: number; ilRiskFactor: number }>;
  idealPositions: IdealPosition[];
  actions: RebalanceActions;
  metrics: DecisionMetrics;

  shouldExecute: boolean;
  reasons: string[];
}
