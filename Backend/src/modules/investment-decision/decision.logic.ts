import {
  CandidatePoolSnapshot,
  CurrentPositionSnapshot,
  DecisionPreferences,
  IdealPosition,
  InvestmentDecisionResult,
  RebalanceActions,
} from './decision.types';

const DEFAULTS = {
  minPositionSizeUsd: 3000,
  minTvlUsd: 1_000_000,
  minAgeDays: 14,
  dailyRebalanceLimit: 8,
  expectedGasUsd: 1.0,
  minApyImprovementPct: 0.7,
  gasCoverMultiplier: 4,
} as const;

const BLUECHIP = new Set(['ETH', 'WETH', 'BTC', 'WBTC']);
const STABLE = new Set(['USDC', 'USDT', 'DAI', 'FRAX']);

export function inferIlRiskFactor(token0: string, token1: string): number {
  const a = token0.toUpperCase();
  const b = token1.toUpperCase();

  const isStableA = STABLE.has(a);
  const isStableB = STABLE.has(b);
  if (isStableA && isStableB) return 0.0;

  const isBlueA = BLUECHIP.has(a);
  const isBlueB = BLUECHIP.has(b);

  // stable + bluechip volatile
  if ((isStableA && isBlueB) || (isStableB && isBlueA)) return 0.08;

  // bluechip pair
  if (isBlueA && isBlueB) return 0.08;

  // stable + non-bluechip volatile -> midcap bucket by default
  if ((isStableA && !isStableB) || (isStableB && !isStableA)) return 0.18;

  // other
  return 0.30;
}

export function computeEffectiveApyPct(apy30dAvgPct: number, ilRiskFactor: number): number {
  return apy30dAvgPct * (1 - ilRiskFactor);
}

export function isPoolAllowedByPreferences(pool: CandidatePoolSnapshot, prefs: DecisionPreferences): boolean {
  const minTvlUsd = prefs.minTvlUsd ?? DEFAULTS.minTvlUsd;
  const minAgeDays = prefs.minAgeDays ?? DEFAULTS.minAgeDays;
  const minApyTolerance = 0.95;

  const allowedTokens = new Set(prefs.allowedTokenSymbols.map(s => s.toUpperCase()));
  const token0Ok = allowedTokens.has(pool.token0Symbol.toUpperCase());
  const token1Ok = allowedTokens.has(pool.token1Symbol.toUpperCase());
  if (!token0Ok || !token1Ok) return false;

  if (prefs.allowedDexNames && prefs.allowedDexNames.length > 0) {
    const allowedDex = new Set(prefs.allowedDexNames.map(d => d.toLowerCase()));
    if (!allowedDex.has(pool.dexName.toLowerCase())) return false;
  }

  if (pool.apy30dAvgPct < prefs.minApyPct * minApyTolerance) return false;
  if (pool.tvlUsd < minTvlUsd) return false;
  if (pool.ageDays < minAgeDays) return false;

  return true;
}

export function buildIdealPortfolio(params: {
  totalCapitalUsd: number;
  candidates: Array<CandidatePoolSnapshot & { effectiveApyPct: number; ilRiskFactor: number }>;
  prefs: DecisionPreferences;
}): IdealPosition[] {
  const minPositionSizeUsd = params.prefs.minPositionSizeUsd ?? DEFAULTS.minPositionSizeUsd;

  const sorted = [...params.candidates].sort((a, b) => b.effectiveApyPct - a.effectiveApyPct);

  const ideal: IdealPosition[] = [];
  let remaining = params.totalCapitalUsd;

  for (const pool of sorted) {
    if (ideal.length >= params.prefs.maxPositions) break;

    const alloc = Math.min(params.prefs.maxAllocPerPosUsd, remaining);
    if (alloc < minPositionSizeUsd) continue;

    ideal.push({
      poolAddress: pool.poolAddress,
      dexName: pool.dexName,
      token0Symbol: pool.token0Symbol,
      token1Symbol: pool.token1Symbol,
      allocationUsd: round2(alloc),
      effectiveApyPct: round4(pool.effectiveApyPct),
      ilRiskFactor: pool.ilRiskFactor,
    });

    remaining -= alloc;
    if (remaining <= 0) break;
  }

  // remainder allocation: add to best stable pool by TVL (if remainder meaningful)
  if (remaining > (params.prefs.minPositionSizeUsd ?? DEFAULTS.minPositionSizeUsd)) {
    const stablePools = sorted
      .filter(p => inferIlRiskFactor(p.token0Symbol, p.token1Symbol) === 0)
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

    const target = stablePools[0];
    if (target && ideal.length > 0) {
      const existing = ideal.find(p => p.poolAddress.toLowerCase() === target.poolAddress.toLowerCase());
      if (existing) {
        existing.allocationUsd = round2(existing.allocationUsd + remaining);
      } else if (ideal.length < params.prefs.maxPositions) {
        ideal.push({
          poolAddress: target.poolAddress,
          dexName: target.dexName,
          token0Symbol: target.token0Symbol,
          token1Symbol: target.token1Symbol,
          allocationUsd: round2(remaining),
          effectiveApyPct: round4(target.effectiveApyPct),
          ilRiskFactor: target.ilRiskFactor,
        });
      } else {
        // if we're at max positions, add to the first position deterministically
        ideal[0].allocationUsd = round2(ideal[0].allocationUsd + remaining);
      }
    }
  }

  return ideal;
}

export function diffPortfolio(params: {
  currentPositions: CurrentPositionSnapshot[];
  ideal: IdealPosition[];
  allocationDeltaThresholdPct?: number;
}): RebalanceActions {
  const thresholdPct = params.allocationDeltaThresholdPct ?? 5;

  const currentByPool = new Map(params.currentPositions.map(p => [p.poolAddress.toLowerCase(), p] as const));
  const idealByPool = new Map(params.ideal.map(p => [p.poolAddress.toLowerCase(), p] as const));

  const toWithdraw: CurrentPositionSnapshot[] = [];
  const toAdd: IdealPosition[] = [];
  const toAdjust: RebalanceActions['toAdjust'] = [];

  for (const cur of params.currentPositions) {
    const target = idealByPool.get(cur.poolAddress.toLowerCase());
    if (!target) {
      toWithdraw.push(cur);
      continue;
    }

    const deltaPct = allocationDeltaPct(cur.allocationUsd, target.allocationUsd);
    if (deltaPct > thresholdPct) {
      // treat as withdraw+add if target is higher, adjust if lower
      if (target.allocationUsd > cur.allocationUsd) {
        toAdd.push(target);
      } else {
        toAdjust.push({
          poolAddress: cur.poolAddress,
          fromAllocationUsd: cur.allocationUsd,
          toAllocationUsd: target.allocationUsd,
        });
      }
    }
  }

  for (const target of params.ideal) {
    if (!currentByPool.has(target.poolAddress.toLowerCase())) {
      toAdd.push(target);
    }
  }

  // determinism: stable ordering output
  toWithdraw.sort((a, b) => a.poolAddress.localeCompare(b.poolAddress));
  toAdd.sort((a, b) => a.poolAddress.localeCompare(b.poolAddress));
  toAdjust.sort((a, b) => a.poolAddress.localeCompare(b.poolAddress));

  return { toWithdraw, toAdd, toAdjust };
}

export function estimateGasTotalUsd(params: {
  withdrawCount: number;
  addCount: number;
  expectedGasUsd: number;
}): number {
  return round2(params.withdrawCount * 1.8 * params.expectedGasUsd + params.addCount * 1.6 * params.expectedGasUsd);
}

export function computeWeightedApyPct(items: Array<{ allocationUsd: number; apyPct: number }>, totalCapitalUsd: number): number {
  if (totalCapitalUsd <= 0) return 0;
  const sum = items.reduce((acc, it) => acc + it.allocationUsd * it.apyPct, 0);
  return round4(sum / totalCapitalUsd);
}

export function estimateProfit30dUsd(params: {
  currentWeightedApyPct: number;
  idealWeightedApyPct: number;
  totalCapitalUsd: number;
}): number {
  const diffPct = params.idealWeightedApyPct - params.currentWeightedApyPct;
  const profit = (diffPct / 100) * params.totalCapitalUsd * (30 / 365);
  return round2(profit);
}

export function makeInvestmentDecision(params: {
  prefs: DecisionPreferences;
  totalCapitalUsd: number;
  candidates: CandidatePoolSnapshot[];
  currentPositions: CurrentPositionSnapshot[];
  rebalancesToday: number;
  now?: Date;
}): InvestmentDecisionResult {
  const now = params.now ?? new Date();

  const dailyRebalanceLimit = params.prefs.dailyRebalanceLimit ?? DEFAULTS.dailyRebalanceLimit;
  const expectedGasUsd = params.prefs.expectedGasUsd ?? DEFAULTS.expectedGasUsd;
  const minApyImprovementPct = params.prefs.minApyImprovementPct ?? DEFAULTS.minApyImprovementPct;
  const gasCoverMultiplier = params.prefs.gasCoverMultiplier ?? DEFAULTS.gasCoverMultiplier;

  const eligible = params.candidates
    .filter(p => isPoolAllowedByPreferences(p, params.prefs))
    .map(p => {
      const ilRiskFactor = p.categoryHint
        ? categoryHintToIlRisk(p.categoryHint)
        : inferIlRiskFactor(p.token0Symbol, p.token1Symbol);

      const effectiveApyPct = computeEffectiveApyPct(p.apy30dAvgPct, ilRiskFactor);
      return { ...p, ilRiskFactor, effectiveApyPct: round4(effectiveApyPct) };
    })
    .sort((a, b) => b.effectiveApyPct - a.effectiveApyPct);

  const ideal = buildIdealPortfolio({
    totalCapitalUsd: params.totalCapitalUsd,
    candidates: eligible,
    prefs: params.prefs,
  });

  const actions = diffPortfolio({ currentPositions: params.currentPositions, ideal });

  const currentWeightedApyPct = computeWeightedApyPct(
    params.currentPositions.map(p => ({ allocationUsd: p.allocationUsd, apyPct: p.currentApyPct })),
    params.totalCapitalUsd,
  );

  const idealWeightedApyPct = computeWeightedApyPct(
    ideal.map(p => ({ allocationUsd: p.allocationUsd, apyPct: p.effectiveApyPct })),
    params.totalCapitalUsd,
  );

  const estimatedGasTotalUsd = estimateGasTotalUsd({
    withdrawCount: actions.toWithdraw.length,
    addCount: actions.toAdd.length,
    expectedGasUsd,
  });

  const profit30dUsd = estimateProfit30dUsd({
    currentWeightedApyPct,
    idealWeightedApyPct,
    totalCapitalUsd: params.totalCapitalUsd,
  });

  const netProfit30dUsd = round2(profit30dUsd - estimatedGasTotalUsd);

  const reasons: string[] = [];
  let shouldExecute = true;

  if (idealWeightedApyPct < currentWeightedApyPct) {
    shouldExecute = false;
    reasons.push('Ideal weighted APY is lower than current');
  }

  if (params.rebalancesToday >= dailyRebalanceLimit) {
    shouldExecute = false;
    reasons.push('Daily rebalance limit reached');
  }

  if (idealWeightedApyPct < currentWeightedApyPct + minApyImprovementPct) {
    shouldExecute = false;
    reasons.push('APY improvement below threshold');
  }

  if (netProfit30dUsd <= estimatedGasTotalUsd * gasCoverMultiplier) {
    shouldExecute = false;
    reasons.push('Net profit does not cover gas multiple');
  }

  // IL safeguard (if IL signal exists)
  const ilBreached = actions.toWithdraw.some(p => typeof p.impermanentLossPct === 'number' && p.impermanentLossPct > 6);
  if (ilBreached) {
    shouldExecute = false;
    reasons.push('Withdraw IL > 6% safeguard triggered');
  }

  // no-ops
  const noAction = actions.toWithdraw.length === 0 && actions.toAdd.length === 0 && actions.toAdjust.length === 0;
  if (noAction) {
    shouldExecute = false;
    reasons.push('No changes required');
  }

  const decisionId = stableDecisionId({
    now: now.toISOString(),
    prefs: params.prefs,
    totalCapitalUsd: params.totalCapitalUsd,
    eligible: eligible.map(p => ({ poolAddress: p.poolAddress, effectiveApyPct: p.effectiveApyPct })),
    current: params.currentPositions.map(p => ({ poolAddress: p.poolAddress, allocationUsd: p.allocationUsd, apy: p.currentApyPct })),
  });

  return {
    decisionId,
    createdAt: now.toISOString(),
    eligibleCandidates: eligible,
    idealPositions: ideal,
    actions,
    metrics: {
      currentWeightedApyPct,
      idealWeightedApyPct,
      estimatedGasTotalUsd,
      profit30dUsd,
      netProfit30dUsd,
    },
    shouldExecute,
    reasons,
  };
}

function allocationDeltaPct(currentUsd: number, idealUsd: number): number {
  if (currentUsd <= 0) return 100;
  return (Math.abs(idealUsd - currentUsd) / currentUsd) * 100;
}

function categoryHintToIlRisk(hint: NonNullable<CandidatePoolSnapshot['categoryHint']>): number {
  switch (hint) {
    case 'stable-stable':
      return 0.0;
    case 'bluechip-volatile':
      return 0.08;
    case 'midcap':
      return 0.18;
    case 'other':
    default:
      return 0.30;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function stableDecisionId(input: unknown): string {
  // Deterministic (non-crypto) hash. Good enough for IDs/logging/tests.
  const json = stableStringify(input);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) >>> 0;
  }
  return `dec_${hash.toString(16)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
