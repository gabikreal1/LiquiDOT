import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Pool } from '../pools/entities/pool.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { Position } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { AssetHubService } from '../blockchain/services/asset-hub.service';

import {
  CandidatePoolSnapshot,
  CurrentPositionSnapshot,
  DecisionPreferences,
  InvestmentDecisionResult,
} from './decision.types';
import { makeInvestmentDecision } from './decision.logic';

export interface RunDecisionParams {
  /** User id whose preferences should be applied. */
  userId: string;

  /**
   * Total capital to allocate in USD.
   *
   * If you don't have pricing wired, you can omit this and provide `totalCapitalBaseAssetWei` instead.
   */
  totalCapitalUsd?: number;

  /**
   * Total capital to allocate in base asset wei.
   *
   * If omitted and `deriveTotalCapitalFromVault=true`, the service will fetch it from AssetHubVault via
   * `AssetHubService.getUserBalance(userWalletAddress)`.
   */
  totalCapitalBaseAssetWei?: bigint;

  /**
   * When true, fetches the user's vault balance on-chain as the total capital source.
   * This enables genuine per-user sizing without requiring an off-chain valuation layer.
   */
  deriveTotalCapitalFromVault?: boolean;

  /**
   * When true, derives per-position allocations from on-chain AssetHubVault positions instead of using DB estimates.
   * Recommended for production.
   */
  deriveCurrentPositionsFromVault?: boolean;

  /** How many rebalances have been executed today (UTC day). */
  rebalancesToday: number;

  /**
   * On-chain user identity (EVM address).
   *
   * If omitted, it will be derived from `User.walletAddress` for the given `userId`.
   */
  userWalletAddress?: string;

  /** Base asset to invest in. */
  baseAssetAddress: string;
}

export interface ExecuteDecisionParams {
  decision: InvestmentDecisionResult;
  userWalletAddress: string;
  baseAssetAddress: string;
  /** Total amount (in wei) that corresponds to totalCapitalUsd. */
  amountWei: bigint;
  /** Range params for Uniswap V3 positions. */
  lowerRangePercent: number;
  upperRangePercent: number;
  /** Target chain ID; pools are currently Moonbeam (2004). */
  chainId?: number;
}

@Injectable()
export class InvestmentDecisionService {
  private readonly logger = new Logger(InvestmentDecisionService.name);

  constructor(
    @InjectRepository(Pool) private readonly poolRepo: Repository<Pool>,
    @InjectRepository(UserPreference) private readonly prefRepo: Repository<UserPreference>,
    @InjectRepository(Position) private readonly positionRepo: Repository<Position>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly assetHubService: AssetHubService,
  ) {}

  /**
  * Compute a decision result using the deterministic decision logic.
  *
  * Data sources:
  * - Pools/APR/TVL come from Postgres (`Pool`).
  * - Total capital can come from:
  *   - `totalCapitalUsd` (if you have a pricing layer), OR
  *   - `totalCapitalBaseAssetWei`, OR
  *   - `deriveTotalCapitalFromVault=true` (fetches `AssetHubVault.getUserBalance(user)` on-chain).
  *
  * Current limitation (pre-production):
  * - Per-position allocation sizing is not yet derived from on-chain positions; it is currently estimated.
  *   For production, prefer mapping `AssetHubVault.getUserPositions*()` amounts into the decision engine.
   */
  async runDecision(params: RunDecisionParams): Promise<InvestmentDecisionResult> {
    const userWalletAddress = await this.resolveUserWalletAddress(params);

    const pref = await this.prefRepo.findOne({ where: { userId: params.userId } });
    if (!pref) {
      throw new Error(`No preferences found for userId=${params.userId}`);
    }

    const pools = await this.poolRepo.find({
      where: { isActive: true },
      relations: ['dex'],
    });

    const positions = await this.positionRepo.find({
      where: { userId: params.userId },
      relations: ['pool', 'pool.dex'],
    });

    const decisionPrefs = this.mapToDecisionPreferences(pref);

    const candidates: CandidatePoolSnapshot[] = pools.map(p => ({
      poolId: p.id,
      poolAddress: p.poolAddress,
      dexName: p.dex?.name ?? 'unknown',
      token0Symbol: p.token0Symbol,
      token1Symbol: p.token1Symbol,
      apy30dAvgPct: parseNumberSafe(p.apr),
      tvlUsd: parseNumberSafe(p.tvl),
      ageDays: daysSince(p.createdAt),
    }));

  const totalCapitalUsd = await this.resolveTotalCapitalUsd({ ...params, userWalletAddress });

    const currentPositions: CurrentPositionSnapshot[] = await this.resolveCurrentPositions({
      userId: params.userId,
      userWalletAddress,
      dbPositions: positions,
      totalCapital: totalCapitalUsd,
      preferOnchain: params.deriveCurrentPositionsFromVault === true,
    });

    const decision = makeInvestmentDecision({
      prefs: decisionPrefs,
      totalCapitalUsd,
      candidates,
      currentPositions,
      rebalancesToday: params.rebalancesToday,
    });

    this.logger.log(
      `Decision computed userId=${params.userId} shouldExecute=${decision.shouldExecute} reasons=${decision.reasons.join('; ')}`,
    );

    return decision;
  }

  /**
   * Execute the decision by dispatching investments for each ideal position.
   *
   * For M2 we implement a minimal execution loop:
   * - "Withdraw" is not executed here yet (needs contract support + accounting).
   * - We dispatch new/increased allocations in `decision.actions.toAdd`.
   */
  async executeDecision(params: ExecuteDecisionParams): Promise<{ dispatchedPositionIds: string[] }> {
    if (!params.decision.shouldExecute) {
      return { dispatchedPositionIds: [] };
    }

    if (!this.assetHubService.isInitialized()) {
      throw new Error('AssetHubService is not initialized (missing env vars)');
    }

    const chainId = params.chainId ?? 2004;

    const dispatchedPositionIds: string[] = [];

    const allocations = allocateWeiByUsd({
      items: params.decision.actions.toAdd.map(p => ({ poolAddress: p.poolAddress, allocationUsd: p.allocationUsd })),
      totalWei: params.amountWei,
    });

    for (const add of params.decision.actions.toAdd) {
      const amountWei = allocations.get(add.poolAddress.toLowerCase()) ?? 0n;

      if (amountWei <= 0n) continue;

      const positionId = await this.assetHubService.dispatchInvestmentWithXcm({
        user: params.userWalletAddress,
        chainId,
        poolId: add.poolAddress,
        baseAsset: params.baseAssetAddress,
        amount: amountWei,
        lowerRangePercent: params.lowerRangePercent,
        upperRangePercent: params.upperRangePercent,
      });

      dispatchedPositionIds.push(positionId);
    }

    return { dispatchedPositionIds };
  }

  // ============================================================
  // Allocation helpers
  // ============================================================

  /**
   * Deterministically allocate a bigint total across items using integer USD-cents weights and
   * largest remainder rounding. Prevents float drift and ensures sum(allocWei) == totalWei.
   */
  private _allocateWeiByUsd = allocateWeiByUsd;

  private async resolveTotalCapitalUsd(params: RunDecisionParams & { userWalletAddress: string }): Promise<number> {
    if (typeof params.totalCapitalUsd === 'number' && Number.isFinite(params.totalCapitalUsd)) {
      return params.totalCapitalUsd;
    }

    let baseAssetWei: bigint | undefined = params.totalCapitalBaseAssetWei;
    if (!baseAssetWei && params.deriveTotalCapitalFromVault) {
      if (!this.assetHubService.isInitialized()) {
        throw new Error('AssetHubService is not initialized; cannot derive capital from vault');
      }
      baseAssetWei = await this.assetHubService.getUserBalance(params.userWalletAddress);
    }

    // Without a pricing layer, treat base-asset units as “USD-like” for sizing.
    // This still makes sizing truly per-user, just not dollar-denominated.
    if (!baseAssetWei) {
      throw new Error('Missing totalCapitalUsd and no onchain/wei capital source provided');
    }

    // Convert to a Number for the decision engine. If value is too large, cap at MAX_SAFE_INTEGER.
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    const capped = baseAssetWei > max ? max : baseAssetWei;
    return Number(capped);
  }

  private async resolveUserWalletAddress(params: RunDecisionParams): Promise<string> {
    if (params.userWalletAddress && params.userWalletAddress.length > 0) {
      return params.userWalletAddress;
    }

    const user = await this.userRepo.findOne({ where: { id: params.userId } });
    if (!user?.walletAddress) {
      throw new Error(`No walletAddress found for userId=${params.userId}`);
    }

    return user.walletAddress;
  }

  private mapToDecisionPreferences(pref: UserPreference): DecisionPreferences {
    // UserPreference.minApr is basis points; convert to %
    const minApyPct = pref.minApr / 100;

    const allowedTokenSymbols = (pref.preferredTokens ?? []).length > 0
      ? pref.preferredTokens
      : ['USDC', 'USDT', 'DOT', 'WETH'];

    return {
      minApyPct,
      allowedTokenSymbols,
      allowedDexNames: pref.preferredDexes ?? undefined,
      maxPositions: 6,
      maxAllocPerPosUsd: 25_000,
      dailyRebalanceLimit: 8,
      expectedGasUsd: 1.0,
      minApyImprovementPct: 0.7,
      gasCoverMultiplier: 4,
    };
  }

  private mapPositionsToCurrentSnapshots(positions: Position[], totalCapitalUsd: number): CurrentPositionSnapshot[] {
    if (positions.length === 0) return [];

    // Best-effort DB mapping: if we don't have on-chain sizing enabled/available, use amount ratios if present.
    // Positions store `amount` in base units (wei). This is not USD, but it keeps per-position weights realistic.
    const amounts = positions
      .filter(p => !!p.pool)
      .map(p => {
        const amt = safeBigInt(p.amount);
        return { position: p, amountWei: amt };
      });

    const totalWei = amounts.reduce((acc, a) => acc + a.amountWei, 0n);
    const totalAsNumber = totalCapitalUsd > 0 ? totalCapitalUsd : 0;

    return positions
      .filter(p => !!p.pool)
      .map(p => ({
        positionId: p.id,
        poolAddress: p.pool.poolAddress,
        dexName: p.pool.dex?.name ?? 'unknown',
        token0Symbol: p.pool.token0Symbol,
        token1Symbol: p.pool.token1Symbol,
        allocationUsd: totalWei > 0n
          ? round2(totalAsNumber * (Number(safeBigInt(p.amount)) / Number(totalWei)))
          : 0,
        currentApyPct: parseNumberSafe(p.pool.apr),
      }));
  }

  private async resolveCurrentPositions(params: {
    userId: string;
    userWalletAddress: string;
    dbPositions: Position[];
    totalCapital: number;
    preferOnchain: boolean;
  }): Promise<CurrentPositionSnapshot[]> {
    if (!params.preferOnchain) {
      return this.mapPositionsToCurrentSnapshots(params.dbPositions, params.totalCapital);
    }

    if (!this.assetHubService.isInitialized()) {
      // If user asked for on-chain truth but we can't access the chain, fall back to DB.
      return this.mapPositionsToCurrentSnapshots(params.dbPositions, params.totalCapital);
    }

    // Map DB pools by address so on-chain positions can be joined.
    const poolsByAddress = new Map<string, Pool>();
    for (const p of params.dbPositions) {
      if (p.pool?.poolAddress) poolsByAddress.set(p.pool.poolAddress.toLowerCase(), p.pool);
    }

    // Query active positions from the contract.
    const onchain = await this.assetHubService.getUserPositionsByStatus(params.userWalletAddress, 1);
    const onchainByPool = new Map<string, bigint>();
    for (const op of onchain) {
      const addr = String(op.poolId).toLowerCase();
      if (!poolsByAddress.has(addr)) continue;
      onchainByPool.set(addr, safeBigInt(op.amount));
    }

    const totalWei = [...onchainByPool.values()].reduce((acc, v) => acc + v, 0n);
    if (totalWei <= 0n) {
      return this.mapPositionsToCurrentSnapshots(params.dbPositions, params.totalCapital);
    }

    // Emit one snapshot per pool with a deterministic "positionId". We use "onchain:<pool>" since
    // AssetHubVault positions are bytes32 and not currently stored in DB as a join key.
    const snapshots: CurrentPositionSnapshot[] = [];
    for (const [poolAddr, amountWei] of onchainByPool.entries()) {
      const pool = poolsByAddress.get(poolAddr);
      if (!pool) continue;

      const weightPct = Number(amountWei) / Number(totalWei);
      snapshots.push({
        positionId: `onchain:${poolAddr}`,
        poolAddress: pool.poolAddress,
        dexName: pool.dex?.name ?? 'unknown',
        token0Symbol: pool.token0Symbol,
        token1Symbol: pool.token1Symbol,
        allocationUsd: round2(params.totalCapital * weightPct),
        currentApyPct: parseNumberSafe(pool.apr),
      });
    }

    snapshots.sort((a, b) => a.poolAddress.localeCompare(b.poolAddress));
    return snapshots;
  }
}

function safeBigInt(value: unknown): bigint {
  try {
    return BigInt(value as any);
  } catch {
    return 0n;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function allocateWeiByUsd(params: {
  items: Array<{ poolAddress: string; allocationUsd: number }>;
  totalWei: bigint;
}): Map<string, bigint> {
  const result = new Map<string, bigint>();
  if (params.totalWei <= 0n || params.items.length === 0) return result;

  const weights = params.items
    .map((it, idx) => ({
      idx,
      key: it.poolAddress.toLowerCase(),
      // convert USD to integer cents for weighting
      weight: BigInt(Math.max(0, Math.floor(it.allocationUsd * 100))),
    }))
    .filter(w => w.weight > 0n);

  if (weights.length === 0) return result;

  const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0n);
  if (totalWeight <= 0n) return result;

  // Base allocation + remainder tracking
  let allocated = 0n;
  const remainders: Array<{ key: string; remainder: bigint }> = [];

  for (const w of weights) {
    const numerator = params.totalWei * w.weight;
    const base = numerator / totalWeight;
    const rem = numerator % totalWeight;
    result.set(w.key, base);
    allocated += base;
    remainders.push({ key: w.key, remainder: rem });
  }

  // Distribute leftover 1 wei at a time to largest remainders deterministically
  let leftover = params.totalWei - allocated;
  if (leftover > 0n) {
    remainders.sort((a, b) => {
      if (a.remainder === b.remainder) return a.key.localeCompare(b.key);
      return a.remainder > b.remainder ? -1 : 1;
    });

    let i = 0;
    while (leftover > 0n) {
      const k = remainders[i % remainders.length].key;
      result.set(k, (result.get(k) ?? 0n) + 1n);
      leftover -= 1n;
      i++;
    }
  }

  return result;
}

function parseNumberSafe(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
