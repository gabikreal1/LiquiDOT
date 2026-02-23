import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Position, PositionStatus } from '../positions/entities/position.entity';
import { Pool } from '../pools/entities/pool.entity';
import { ActivityLog } from '../activity-logs/entities/activity-log.entity';
import { UsersService } from '../users/users.service';
import { PriceService } from '../blockchain/services/price.service';
import { TokenMathService } from '../blockchain/services/token-math.service';

export interface DashboardResponse {
  user: {
    id: string;
    walletAddress: string;
    balanceDot: number;
    balanceUsd: number;
  };
  positions: Array<{
    id: string;
    poolName: string;
    status: PositionStatus;
    amountDot: number;
    currentValueUsd: number;
    pnlUsd: number;
    pnlPercent: number;
    assetHubTxHash: string | null;
    moonbeamTxHash: string | null;
    createdAt: Date;
    executedAt: Date | null;
  }>;
  recentActivity: Array<{
    type: string;
    status: string;
    txHash: string | null;
    details: any;
    createdAt: Date;
  }>;
  pools: Array<{
    id: string;
    name: string;
    apr: string;
    tvl: string;
    userAllocationUsd: number;
  }>;
  summary: {
    totalInvestedUsd: number;
    totalCurrentValueUsd: number;
    totalPnlUsd: number;
    totalPnlPercent: number;
    activePositionCount: number;
    pendingPositionCount: number;
  };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
    private usersService: UsersService,
    private priceService: PriceService,
    private tokenMath: TokenMathService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    // Fetch all data in parallel
    const [balance, positions, activityLogs, pools] = await Promise.all([
      this.usersService.getBalance(userId).catch(() => null),
      this.positionRepository.find({
        where: { userId },
        relations: ['pool'],
        order: { createdAt: 'DESC' },
      }),
      this.activityLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.poolRepository.find({
        where: { isActive: true },
        order: { tvl: 'DESC' },
      }),
    ]);

    const user = await this.usersService.findOne(userId);
    const dotPrice = await this.priceService.getDotPriceUsd().catch(() => 0);

    // Map positions with P&L
    let totalInvestedUsd = 0;
    let totalCurrentValueUsd = 0;
    let activeCount = 0;
    let pendingCount = 0;

    const mappedPositions = positions.map((pos) => {
      const amountDot = this.tokenMath.planckToDot(pos.amount);
      const entryUsd = amountDot * dotPrice;

      let currentValueUsd = entryUsd;
      if (pos.status === PositionStatus.LIQUIDATED && pos.returnedAmount) {
        currentValueUsd = this.tokenMath.planckToDot(pos.returnedAmount) * dotPrice;
      }

      const pnlUsd = currentValueUsd - entryUsd;
      const pnlPercent = entryUsd > 0 ? (pnlUsd / entryUsd) * 100 : 0;

      totalInvestedUsd += entryUsd;
      totalCurrentValueUsd += currentValueUsd;

      if (pos.status === PositionStatus.ACTIVE || pos.status === PositionStatus.OUT_OF_RANGE) {
        activeCount++;
      }
      if (pos.status === PositionStatus.PENDING_EXECUTION) {
        pendingCount++;
      }

      const poolName = pos.pool
        ? `${pos.pool.token0Symbol}/${pos.pool.token1Symbol}`
        : 'Unknown Pool';

      return {
        id: pos.id,
        poolName,
        status: pos.status,
        amountDot,
        currentValueUsd,
        pnlUsd,
        pnlPercent,
        assetHubTxHash: pos.assetHubTxHash || null,
        moonbeamTxHash: pos.moonbeamTxHash || null,
        createdAt: pos.createdAt,
        executedAt: pos.executedAt || null,
      };
    });

    // Pool allocations per user
    const userPoolAllocations = new Map<string, number>();
    for (const pos of positions) {
      if (pos.poolId && (pos.status === PositionStatus.ACTIVE || pos.status === PositionStatus.OUT_OF_RANGE)) {
        const amountUsd = this.tokenMath.planckToDot(pos.amount) * dotPrice;
        userPoolAllocations.set(pos.poolId, (userPoolAllocations.get(pos.poolId) || 0) + amountUsd);
      }
    }

    const mappedPools = pools.map((pool) => ({
      id: pool.id,
      name: `${pool.token0Symbol}/${pool.token1Symbol}`,
      apr: pool.apr,
      tvl: pool.tvl,
      userAllocationUsd: userPoolAllocations.get(pool.id) || 0,
    }));

    const totalPnlUsd = totalCurrentValueUsd - totalInvestedUsd;
    const totalPnlPercent = totalInvestedUsd > 0 ? (totalPnlUsd / totalInvestedUsd) * 100 : 0;

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        balanceDot: balance ? this.tokenMath.planckToDot(balance.balanceWei) : 0,
        balanceUsd: balance?.balanceUsd || 0,
      },
      positions: mappedPositions,
      recentActivity: activityLogs.map((log) => ({
        type: log.type,
        status: log.status,
        txHash: log.txHash || null,
        details: log.details,
        createdAt: log.createdAt,
      })),
      pools: mappedPools,
      summary: {
        totalInvestedUsd,
        totalCurrentValueUsd,
        totalPnlUsd,
        totalPnlPercent,
        activePositionCount: activeCount,
        pendingPositionCount: pendingCount,
      },
    };
  }
}
