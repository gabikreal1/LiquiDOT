import {
  computeEffectiveApyPct,
  estimateGasTotalUsd,
  estimateProfit30dUsd,
  inferIlRiskFactor,
  makeInvestmentDecision,
} from './decision.logic';

import { CandidatePoolSnapshot, DecisionPreferences } from './decision.types';

describe('decision.logic', () => {
  test('inferIlRiskFactor stable-stable is 0', () => {
    expect(inferIlRiskFactor('USDC', 'USDT')).toBe(0);
  });

  test('computeEffectiveApyPct applies ilRiskFactor', () => {
    expect(computeEffectiveApyPct(10, 0.18)).toBeCloseTo(8.2);
  });

  test('estimateGasTotalUsd uses 1.8/1.6 multipliers', () => {
    expect(estimateGasTotalUsd({ withdrawCount: 2, addCount: 3, expectedGasUsd: 1 })).toBe(2 * 1.8 + 3 * 1.6);
  });

  test('estimateProfit30dUsd matches formula', () => {
    const profit = estimateProfit30dUsd({ currentWeightedApyPct: 8, idealWeightedApyPct: 9, totalCapitalUsd: 100_000 });
    // 1% improvement on 100k over 30/365 days
    expect(profit).toBeCloseTo((0.01 * 100_000 * (30 / 365)), 1);
  });

  test('makeInvestmentDecision produces deterministic decisionId for same inputs', () => {
    const prefs: DecisionPreferences = {
      minApyPct: 8,
      allowedTokenSymbols: ['USDC', 'USDT', 'WETH'],
      maxPositions: 2,
      maxAllocPerPosUsd: 25_000,
      expectedGasUsd: 1,
      dailyRebalanceLimit: 8,
      gasCoverMultiplier: 4,
      minApyImprovementPct: 0.7,
    };

    const candidates: CandidatePoolSnapshot[] = [
      {
        poolId: 'p1',
        poolAddress: '0x0000000000000000000000000000000000000001',
        dexName: 'Algebra',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apy30dAvgPct: 8.5,
        tvlUsd: 2_000_000,
        ageDays: 30,
      },
      {
        poolId: 'p2',
        poolAddress: '0x0000000000000000000000000000000000000002',
        dexName: 'Algebra',
        token0Symbol: 'USDC',
        token1Symbol: 'WETH',
        apy30dAvgPct: 12,
        tvlUsd: 5_000_000,
        ageDays: 40,
      },
    ];

    const base = {
      prefs,
      totalCapitalUsd: 50_000,
      candidates,
      currentPositions: [],
      rebalancesToday: 0,
      now: new Date('2025-01-01T00:00:00.000Z'),
    };

    const r1 = makeInvestmentDecision(base);
    const r2 = makeInvestmentDecision(base);

    expect(r1.decisionId).toEqual(r2.decisionId);
    expect(r1.idealPositions.length).toBeGreaterThan(0);
  });

  test('execution gating blocks when improvement too small', () => {
    const prefs: DecisionPreferences = {
      minApyPct: 8,
      allowedTokenSymbols: ['USDC', 'USDT'],
      maxPositions: 1,
      maxAllocPerPosUsd: 25_000,
      expectedGasUsd: 1,
      dailyRebalanceLimit: 8,
      gasCoverMultiplier: 4,
      minApyImprovementPct: 0.7,
    };

    const candidates: CandidatePoolSnapshot[] = [
      {
        poolId: 'p1',
        poolAddress: '0x0000000000000000000000000000000000000001',
        dexName: 'Algebra',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apy30dAvgPct: 8.05,
        tvlUsd: 2_000_000,
        ageDays: 30,
      },
    ];

    const res = makeInvestmentDecision({
      prefs,
      totalCapitalUsd: 50_000,
      candidates,
      currentPositions: [
        {
          positionId: 'pos_1',
          poolAddress: '0x0000000000000000000000000000000000000001',
          dexName: 'Algebra',
          token0Symbol: 'USDC',
          token1Symbol: 'USDT',
          allocationUsd: 50_000,
          currentApyPct: 8.0,
        },
      ],
      rebalancesToday: 0,
      now: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(res.shouldExecute).toBe(false);
    expect(res.reasons.join(' ')).toMatch(/APY improvement below threshold/i);
  });

  test('IL safeguard blocks when withdrawing position has IL > 6%', () => {
    const prefs: DecisionPreferences = {
      minApyPct: 8,
      allowedTokenSymbols: ['USDC', 'USDT'],
      maxPositions: 1,
      maxAllocPerPosUsd: 25_000,
      expectedGasUsd: 1,
      dailyRebalanceLimit: 8,
      gasCoverMultiplier: 0, // disable gas gating
      minApyImprovementPct: 0, // disable improvement gating
    };

    const candidates: CandidatePoolSnapshot[] = [
      {
        poolId: 'p2',
        poolAddress: '0x0000000000000000000000000000000000000002',
        dexName: 'Algebra',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apy30dAvgPct: 20,
        tvlUsd: 2_000_000,
        ageDays: 30,
      },
    ];

    const res = makeInvestmentDecision({
      prefs,
      totalCapitalUsd: 50_000,
      candidates,
      currentPositions: [
        {
          positionId: 'pos_1',
          poolAddress: '0x0000000000000000000000000000000000000001',
          dexName: 'Algebra',
          token0Symbol: 'USDC',
          token1Symbol: 'USDT',
          allocationUsd: 50_000,
          currentApyPct: 1,
          impermanentLossPct: 6.1,
        },
      ],
      rebalancesToday: 0,
      now: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(res.shouldExecute).toBe(false);
    expect(res.reasons.join(' ')).toMatch(/IL > 6%/i);
  });
});
