import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { Pool } from '../pools/entities/pool.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { Position } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { InvestmentDecisionService } from './investment-decision.service';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
import { MoonbeamService } from '../blockchain/services/moonbeam.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';

describe('InvestmentDecisionService', () => {
  let service: InvestmentDecisionService;

  const poolRepo = {
    find: jest.fn(),
  } as unknown as Repository<Pool>;

  const prefRepo = {
    findOne: jest.fn(),
  } as unknown as Repository<UserPreference>;

  const positionRepo = {
    find: jest.fn(),
  } as unknown as Repository<Position>;

  const userRepo = {
    findOne: jest.fn(),
  } as unknown as Repository<User>;

  const assetHubService = {
    isInitialized: jest.fn(() => true),
    dispatchInvestmentWithXcm: jest.fn(async () => 'pos_onchain_1'),
    getUserBalance: jest.fn(async () => 0n),
    getUserPositionsByStatus: jest.fn(async () => []),
  } as unknown as AssetHubService;

  const moonbeamService = {
    isInitialized: jest.fn(() => true),
    liquidateSwapAndReturn: jest.fn(async () => undefined),
  } as unknown as MoonbeamService;

  const xcmBuilderService = {
    buildReturnDestination: jest.fn(async () => new Uint8Array([1, 2, 3])),
  } as unknown as XcmBuilderService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvestmentDecisionService,
        { provide: getRepositoryToken(Pool), useValue: poolRepo },
        { provide: getRepositoryToken(UserPreference), useValue: prefRepo },
        { provide: getRepositoryToken(Position), useValue: positionRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AssetHubService, useValue: assetHubService },
        { provide: MoonbeamService, useValue: moonbeamService },
        { provide: XcmBuilderService, useValue: xcmBuilderService },
      ],
    }).compile();

    service = moduleRef.get(InvestmentDecisionService);
  });

  test('runDecision throws if user has no preferences', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({ id: 'u1', walletAddress: '0xabc' } satisfies Partial<User>);
    (prefRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.runDecision({
        userId: 'u1',
        totalCapitalUsd: 50_000,
        rebalancesToday: 0,
        baseAssetAddress: '0xdef',
      }),
    ).rejects.toThrow(/No preferences/);
  });

  test('executeDecision dispatches when shouldExecute=true', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({ id: 'u1', walletAddress: '0xabc' } satisfies Partial<User>);
    // Preference: minApr=800 bp => 8%
    (prefRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      minApr: 800,
      preferredDexes: ['Algebra'],
      preferredTokens: ['USDC', 'USDT', 'WETH'],
    } satisfies Partial<UserPreference>);

    // Pools
    (poolRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        poolAddress: '0x0000000000000000000000000000000000000001',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apr: '8.5',
        tvl: '2000000',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        isActive: true,
        dex: { name: 'Algebra' },
      },
    ]);

    // No current positions -> will prefer to add
    (positionRepo.find as jest.Mock).mockResolvedValue([]);

    const decision = await service.runDecision({
      userId: 'u1',
      totalCapitalUsd: 50_000,
      rebalancesToday: 0,
      baseAssetAddress: '0xdef',
    });

    // Force execution by relaxing thresholds for this test
    decision.shouldExecute = true;
    decision.actions.toAdd = decision.idealPositions;

    const result = await service.executeDecision({
      decision,
      userWalletAddress: '0xabc',
      baseAssetAddress: '0xdef',
      amountWei: 1000000000000000000n,
      lowerRangePercent: -5,
      upperRangePercent: 10,
      chainId: 2004,
    });

    expect(assetHubService.dispatchInvestmentWithXcm).toHaveBeenCalled();
    expect(result.dispatchedPositionIds.length).toBeGreaterThan(0);
  });

  test('executeDecision does nothing when shouldExecute=false', async () => {
    const result = await service.executeDecision({
      decision: {
        decisionId: 'd1',
        createdAt: new Date('2025-01-01').toISOString(),
        eligibleCandidates: [],
        idealPositions: [],
        actions: { toWithdraw: [], toAdd: [], toAdjust: [] },
        metrics: {
          currentWeightedApyPct: 0,
          idealWeightedApyPct: 0,
          estimatedGasTotalUsd: 0,
          profit30dUsd: 0,
          netProfit30dUsd: 0,
        },
        shouldExecute: false,
        reasons: ['No changes required'],
      },
      userWalletAddress: '0xabc',
      baseAssetAddress: '0xdef',
      amountWei: 1n,
      lowerRangePercent: -5,
      upperRangePercent: 10,
    });

    expect(assetHubService.dispatchInvestmentWithXcm).not.toHaveBeenCalled();
    expect(result.dispatchedPositionIds).toEqual([]);
  });

  test('runDecision can derive total capital from vault balance (per-user) when requested', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({ id: 'u1', walletAddress: '0xabc' } satisfies Partial<User>);
    (prefRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      minApr: 800,
      preferredDexes: ['Algebra'],
      preferredTokens: ['USDC', 'USDT', 'WETH'],
    } satisfies Partial<UserPreference>);

    (poolRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        poolAddress: '0x0000000000000000000000000000000000000001',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apr: '9.0',
        tvl: '2000000',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        isActive: true,
        dex: { name: 'Algebra' },
      },
    ]);

    (positionRepo.find as jest.Mock).mockResolvedValue([]);
    (assetHubService.getUserBalance as unknown as jest.Mock).mockResolvedValue(50_000n);

    const decision = await service.runDecision({
      userId: 'u1',
      deriveTotalCapitalFromVault: true,
      rebalancesToday: 0,
      baseAssetAddress: '0xdef',
    });

    expect(assetHubService.getUserBalance).toHaveBeenCalledWith('0xabc');
    expect(decision.idealPositions.length).toBeGreaterThan(0);
  });

  test('runDecision can derive current position weights from onchain ACTIVE positions', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue({ id: 'u1', walletAddress: '0xabc' } satisfies Partial<User>);

    (prefRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      minApr: 0,
      preferredDexes: ['Algebra'],
      preferredTokens: ['USDC', 'USDT'],
    } satisfies Partial<UserPreference>);

    // DB pools so we can join onchain poolId->poolAddress
    (poolRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        poolAddress: '0x0000000000000000000000000000000000000001',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apr: '1.0',
        tvl: '2000000',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        isActive: true,
        dex: { name: 'Algebra' },
      },
      {
        id: 'p2',
        poolAddress: '0x0000000000000000000000000000000000000002',
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        apr: '1.0',
        tvl: '2000000',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        isActive: true,
        dex: { name: 'Algebra' },
      },
    ]);

    // DB positions used only to build poolsByAddress map inside service
    (positionRepo.find as jest.Mock).mockResolvedValue([
      { id: 'db1', amount: '0', pool: { poolAddress: '0x0000000000000000000000000000000000000001', token0Symbol: 'USDC', token1Symbol: 'USDT', apr: '1.0', dex: { name: 'Algebra' } } },
      { id: 'db2', amount: '0', pool: { poolAddress: '0x0000000000000000000000000000000000000002', token0Symbol: 'USDC', token1Symbol: 'USDT', apr: '1.0', dex: { name: 'Algebra' } } },
    ]);

    (assetHubService.isInitialized as unknown as jest.Mock).mockReturnValue(true);
    (assetHubService.getUserPositionsByStatus as unknown as jest.Mock).mockResolvedValue([
      { poolId: '0x0000000000000000000000000000000000000001', amount: 3n },
      { poolId: '0x0000000000000000000000000000000000000002', amount: 1n },
    ]);

    const decision = await service.runDecision({
      userId: 'u1',
      totalCapitalUsd: 100,
      deriveCurrentPositionsFromVault: true,
      rebalancesToday: 0,
      baseAssetAddress: '0xdef',
    });

    // 3:1 => 75/25 (round2)
    const cur = decision.metrics.currentWeightedApyPct; // triggers calculation path
    expect(cur).toBeDefined();
    // Ensure service called chain
    expect(assetHubService.getUserPositionsByStatus).toHaveBeenCalledWith('0xabc', 1);
  });

  test('runDecision fails if walletAddress cannot be derived', async () => {
    (userRepo.findOne as jest.Mock).mockResolvedValue(null);
    (prefRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      minApr: 800,
    } satisfies Partial<UserPreference>);

    await expect(
      service.runDecision({
        userId: 'u1',
        totalCapitalUsd: 10_000,
        rebalancesToday: 0,
        baseAssetAddress: '0xdef',
      }),
    ).rejects.toThrow(/walletAddress/i);
  });

  test('executeDecision allocates wei deterministically and sums to totalWei', async () => {
    const decision = {
      decisionId: 'd2',
      createdAt: new Date('2025-01-01').toISOString(),
      eligibleCandidates: [],
      idealPositions: [
        {
          poolAddress: '0x0000000000000000000000000000000000000001',
          dexName: 'Algebra',
          token0Symbol: 'USDC',
          token1Symbol: 'USDT',
          allocationUsd: 600,
          effectiveApyPct: 10,
          ilRiskFactor: 0,
        },
        {
          poolAddress: '0x0000000000000000000000000000000000000002',
          dexName: 'Algebra',
          token0Symbol: 'USDC',
          token1Symbol: 'WETH',
          allocationUsd: 400,
          effectiveApyPct: 12,
          ilRiskFactor: 0.08,
        },
      ],
      actions: {
        toWithdraw: [],
        toAdd: [
          {
            poolAddress: '0x0000000000000000000000000000000000000001',
            dexName: 'Algebra',
            token0Symbol: 'USDC',
            token1Symbol: 'USDT',
            allocationUsd: 600,
            effectiveApyPct: 10,
            ilRiskFactor: 0,
          },
          {
            poolAddress: '0x0000000000000000000000000000000000000002',
            dexName: 'Algebra',
            token0Symbol: 'USDC',
            token1Symbol: 'WETH',
            allocationUsd: 400,
            effectiveApyPct: 12,
            ilRiskFactor: 0.08,
          },
        ],
        toAdjust: [],
      },
      metrics: {
        currentWeightedApyPct: 0,
        idealWeightedApyPct: 0,
        estimatedGasTotalUsd: 0,
        profit30dUsd: 0,
        netProfit30dUsd: 0,
      },
      shouldExecute: true,
      reasons: [],
    };

    // Two dispatches expected
    (assetHubService.dispatchInvestmentWithXcm as unknown as jest.Mock)
      .mockResolvedValueOnce('pos1')
      .mockResolvedValueOnce('pos2');

    const totalWei = 1_000_000_000_000_000_000n;

    await service.executeDecision({
      decision,
      userWalletAddress: '0xabc',
      baseAssetAddress: '0xdef',
      amountWei: totalWei,
      lowerRangePercent: -5,
      upperRangePercent: 10,
      chainId: 2004,
    });

    const calls = (assetHubService.dispatchInvestmentWithXcm as unknown as jest.Mock).mock.calls;
    expect(calls.length).toBe(2);
    const a0 = calls[0][0].amount as bigint;
    const a1 = calls[1][0].amount as bigint;
    expect(a0 + a1).toBe(totalWei);

    // roughly 60/40 split (within 1 wei rounding)
    expect(Number(a0) / Number(totalWei)).toBeGreaterThan(0.59);
    expect(Number(a0) / Number(totalWei)).toBeLessThan(0.61);
  });
 
  it('previews an initial allocation with percent weights', async () => {
    // Arrange: pools
    (poolRepo.find as unknown as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        poolAddress: '0xpool1',
        dex: { name: 'Algebra' },
        token0Symbol: 'USDC',
        token1Symbol: 'USDT',
        token0Address: '0x0000000000000000000000000000000000000001',
        token1Address: '0x0000000000000000000000000000000000000002',
        apr: 12,
        tvl: 5_000_000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40),
      },
      {
        id: 'p2',
        poolAddress: '0xpool2',
        dex: { name: 'Algebra' },
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Address: '0x0000000000000000000000000000000000000003',
        token1Address: '0x0000000000000000000000000000000000000001',
        apr: 10,
        tvl: 10_000_000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80),
      },
    ]);

    (prefRepo.findOne as unknown as jest.Mock).mockResolvedValue({
      userId: 'u1',
      minApr: 600, // 6%
      preferredTokens: ['USDC', 'USDT', 'WETH'],
      preferredDexes: ['Algebra'],
    });

    // Act
    const res = await service.previewInitialAllocation({
      userId: 'u1',
      totalCapitalUsd: 10_000,
      maxPositions: 2,
    });

    // Assert
    expect(res.totalCapitalUsd).toBe(10_000);
    expect(res.eligibleCandidatesCount).toBeGreaterThan(0);
    expect(Array.isArray(res.idealPositions)).toBe(true);

    const sumPct = res.idealPositions.reduce((acc, p) => acc + p.allocationPct, 0);
    expect(sumPct).toBeGreaterThan(99);
    expect(sumPct).toBeLessThan(101);
  });

});
