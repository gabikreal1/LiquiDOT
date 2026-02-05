/**
 * Users Service
 * 
 * CRUD operations for User entity.
 * Handles user registration on wallet connect and balance management.
 * 
 * Decision: Users are registered when frontend calls POST /users on wallet connect.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AssetHubService } from '../blockchain/services/asset-hub.service';

export interface UserBalance {
  userId: string;
  walletAddress: string;
  balanceWei: bigint;
  balanceUsd: number;
  lastSyncedAt: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  // In-memory cache for balances (event-driven updates)
  private balanceCache: Map<string, UserBalance> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private assetHubService: AssetHubService,
  ) { }

  /**
   * Create a new user
   */
  async create(walletAddress: string): Promise<User> {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if already exists
    const existing = await this.findByWallet(normalizedAddress);
    if (existing) {
      this.logger.log(`User already exists for wallet ${normalizedAddress}`);
      return existing;
    }

    const user = this.userRepository.create({
      walletAddress: normalizedAddress,
      isActive: true,
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(`Created user ${saved.id} for wallet ${normalizedAddress}`);
    return saved;
  }

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['positions', 'preferences'],
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  /**
   * Find user by wallet address
   */
  async findByWallet(walletAddress: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
      relations: ['positions', 'preferences'],
    });
  }

  /**
   * Find or create user by wallet address
   * Called on frontend wallet connect
   */
  async findOrCreate(walletAddress: string): Promise<User> {
    const existing = await this.findByWallet(walletAddress);
    if (existing) {
      return existing;
    }
    return this.create(walletAddress);
  }

  /**
   * Get user balance from cache
   * Uses event-driven updates from AssetHub events
   */
  async getBalance(userId: string): Promise<UserBalance> {
    const user = await this.findOne(userId);

    // Check cache first
    const cached = this.balanceCache.get(userId);
    if (cached) {
      return cached;
    }

    // If not in cache, sync from chain
    return this.syncBalanceFromChain(userId);
  }

  /**
   * Sync balance from AssetHub on-chain
   */
  async syncBalanceFromChain(userId: string): Promise<UserBalance> {
    const user = await this.findOne(userId);

    try {
      const balanceWei = await this.assetHubService.getUserBalance(user.walletAddress);

      const balance: UserBalance = {
        userId,
        walletAddress: user.walletAddress,
        balanceWei,
        balanceUsd: this.weiToUsd(balanceWei),
        lastSyncedAt: new Date(),
      };

      // Update cache
      this.balanceCache.set(userId, balance);

      this.logger.debug(`Synced balance for user ${userId}: $${balance.balanceUsd}`);
      return balance;
    } catch (error) {
      this.logger.error(`Error syncing balance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update cached balance (called by EventListenerService on deposit/withdrawal events)
   */
  updateCachedBalance(walletAddress: string, balanceWei: bigint): void {
    // Find user ID by wallet
    this.findByWallet(walletAddress).then(user => {
      if (user) {
        const balance: UserBalance = {
          userId: user.id,
          walletAddress: user.walletAddress,
          balanceWei,
          balanceUsd: this.weiToUsd(balanceWei),
          lastSyncedAt: new Date(),
        };
        this.balanceCache.set(user.id, balance);
        this.logger.debug(`Updated cached balance for ${walletAddress}: $${balance.balanceUsd}`);
      }
    }).catch(err => {
      this.logger.warn(`Could not update cache for ${walletAddress}:`, err);
    });
  }

  /**
   * Refresh all user balances
   */
  async refreshAllBalances(): Promise<void> {
    const users = await this.findAll();

    for (const user of users) {
      try {
        await this.syncBalanceFromChain(user.id);
      } catch (error) {
        this.logger.warn(`Could not refresh balance for user ${user.id}`);
      }
    }

    this.logger.log(`Refreshed balances for ${users.length} users`);
  }

  /**
   * Deactivate a user
   */
  async deactivate(userId: string): Promise<User> {
    await this.userRepository.update(userId, { isActive: false });
    this.logger.log(`Deactivated user ${userId}`);
    return this.findOne(userId);
  }

  /**
   * Reactivate a user
   */
  async reactivate(userId: string): Promise<User> {
    await this.userRepository.update(userId, { isActive: true });
    this.logger.log(`Reactivated user ${userId}`);
    return this.findOne(userId);
  }

  /**
   * Convert wei to USD (simplified - assumes stablecoin 1:1)
   */
  private weiToUsd(weiAmount: bigint): number {
    try {
      return Number(weiAmount / BigInt(10 ** 18));
    } catch {
      return 0;
    }
  }
}
