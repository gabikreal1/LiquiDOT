import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetHubService } from '../blockchain/services/asset-hub.service';
import { User } from '../users/entities/user.entity';
import { Pool } from '../pools/entities/pool.entity';
import { Position, PositionStatus } from './entities/position.entity';

/**
 * Periodically sync on-chain AssetHubVault positions into Postgres.
 *
 * Design goals:
 * - Make DB positions a cached mirror of on-chain truth (for APIs + decisions).
 * - Keep it safe: if chain connectivity is missing, log and skip.
 * - Be idempotent: upsert based on assetHubPositionId.
 */
@Injectable()
export class PositionSyncService {
  private readonly logger = new Logger(PositionSyncService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly assetHub: AssetHubService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Pool) private readonly poolRepo: Repository<Pool>,
    @InjectRepository(Position) private readonly posRepo: Repository<Position>,
  ) {}

  @Cron('*/30 * * * *') // every 30 minutes
  async syncAllUsers(): Promise<void> {
    const enabled = this.config.get<boolean>('POSITION_SYNC_ENABLED', true);
    if (!enabled) return;

    if (!this.assetHub.isInitialized()) {
      this.logger.debug('AssetHubService not initialized; skipping position sync');
      return;
    }

    const users = await this.userRepo.find({ where: {} });
    for (const u of users) {
      if (!u.walletAddress) continue;
      try {
        await this.syncUser(u.id, u.walletAddress);
      } catch (e) {
        this.logger.warn(
          `Position sync failed for userId=${u.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  async syncUser(userId: string, walletAddress: string): Promise<{ upserts: number }> {
    if (!this.assetHub.isInitialized()) {
      throw new Error('AssetHubService not initialized');
    }

    const maxResults = this.config.get<number>('POSITION_SYNC_MAX_RESULTS', 200);
    const onchain = await this.assetHub.getUserPositionsWithIds(walletAddress, maxResults);
    if (onchain.length === 0) return { upserts: 0 };

    // Build pool lookup for join. Pools are keyed by poolAddress.
    const poolAddresses = Array.from(new Set(onchain.map(p => String(p.poolId).toLowerCase())));
    const pools = await this.poolRepo
      .createQueryBuilder('pool')
      .where('LOWER(pool.poolAddress) IN (:...addrs)', { addrs: poolAddresses })
      .getMany();
    const poolByAddr = new Map(pools.map(p => [p.poolAddress.toLowerCase(), p]));

      const mapStatus = (s: number, existing?: Position): PositionStatus => {
        // If we have already initiated liquidation off a decision, keep that marker
        // until the chain tells us it's settled/closed.
        if (existing?.status === PositionStatus.LIQUIDATION_PENDING) {
          return PositionStatus.LIQUIDATION_PENDING;
        }

      switch (s) {
        case 0:
          return PositionStatus.PENDING_EXECUTION;
        case 1:
          return PositionStatus.ACTIVE;
        case 2:
          return PositionStatus.LIQUIDATED;
        default:
          return PositionStatus.FAILED;
      }
    };

    let upserts = 0;
    for (const p of onchain) {
      const poolAddr = String(p.poolId).toLowerCase();
      const pool = poolByAddr.get(poolAddr);
      if (!pool) {
        this.logger.debug(`Skipping on-chain positionId=${p.positionId}; pool not found in DB: ${poolAddr}`);
        continue;
      }

      const assetHubPositionId = String(p.positionId);
      const chainId = Number(p.chainId);
      const existing = await this.posRepo.findOne({ where: { assetHubPositionId } });

  const status = mapStatus(Number(p.status), existing);

      const base = {
        assetHubPositionId,
        userId,
        poolId: pool.id,
        baseAsset: String(p.baseAsset),
        amount: String(p.amount),
        liquidity: null as any,
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        lowerTick: null as any,
        upperTick: null as any,
        entryPrice: null as any,
        status,
        chainId,
        returnedAmount: null as any,
        executedAt: status === PositionStatus.ACTIVE ? (existing?.executedAt ?? new Date()) : existing?.executedAt,
        liquidatedAt: status === PositionStatus.LIQUIDATED ? (existing?.liquidatedAt ?? new Date()) : existing?.liquidatedAt,
      };

      if (!existing) {
        await this.posRepo.save(this.posRepo.create(base as any));
        upserts++;
        continue;
      }

      await this.posRepo.save({ ...existing, ...(base as any) });
      upserts++;
    }

    return { upserts };
  }
}
