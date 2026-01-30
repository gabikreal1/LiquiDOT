import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEventListenerService } from './event-listener.service';
import { User } from '../../users/entities/user.entity';
import { Position, PositionStatus } from '../../positions/entities/position.entity';
import { Pool } from '../../pools/entities/pool.entity';

/**
 * EventPersistenceService
 * 
 * Persists blockchain events to the database.
 * Registers callbacks with BlockchainEventListenerService to handle:
 * - Deposits → Update user balance tracking
 * - Withdrawals → Update user balance tracking
 * - Investment Initiated → Create/Update Position (PENDING)
 * - Execution Confirmed → Update Position (ACTIVE)
 * - Position Liquidated → Update Position (LIQUIDATED)
 * 
 * This bridges the gap between blockchain events and database state.
 */
@Injectable()
export class EventPersistenceService implements OnModuleInit {
  private readonly logger = new Logger(EventPersistenceService.name);

  constructor(
    private eventListener: BlockchainEventListenerService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
  ) {}

  /**
   * Register event handlers on module initialization
   */
  onModuleInit() {
    this.logger.log('Registering event persistence handlers...');
    this.registerEventHandlers();
  }

  /**
   * Register all event handlers with the blockchain listener
   */
  private registerEventHandlers() {
    this.eventListener.registerCallbacks({
      // ========================================
      // Asset Hub Events
      // ========================================
      assetHub: {
        onDeposit: async (event) => {
          await this.handleDeposit(event);
        },

        onWithdrawal: async (event) => {
          await this.handleWithdrawal(event);
        },

        onInvestmentInitiated: async (event) => {
          await this.handleInvestmentInitiated(event);
        },

        onExecutionConfirmed: async (event) => {
          await this.handleExecutionConfirmed(event);
        },

        onPositionLiquidated: async (event) => {
          await this.handlePositionLiquidated(event);
        },

        onLiquidationSettled: async (event) => {
          await this.handleLiquidationSettled(event);
        },

        onChainAdded: async (event) => {
          this.logger.log(`New chain added: ${event.chainId}`);
        },

        onXcmMessageSent: async (event) => {
          this.logger.debug(`XCM message sent: ${event.messageHash}`);
        },
      },

      // ========================================
      // Moonbeam Events
      // ========================================
      moonbeam: {
        onAssetsReceived: async (event) => {
          this.logger.log(`Assets received on Moonbeam: ${event.user} - ${event.amount}`);
        },

        onPendingPositionCreated: async (event) => {
          await this.handlePendingPositionCreated(event);
        },

        onPositionExecuted: async (event) => {
          await this.handleMoonbeamPositionExecuted(event);
        },

        onPositionLiquidated: async (event) => {
          await this.handleMoonbeamPositionLiquidated(event);
        },

        onAssetsReturned: async (event) => {
          this.logger.log(`Assets returned from Moonbeam: ${event.user} - ${event.amount}`);
        },

        onPendingPositionCancelled: async (event) => {
          await this.handlePendingPositionCancelled(event);
        },
      },
    });

    this.logger.log('Event persistence handlers registered successfully');
  }

  // ========================================
  // Asset Hub Event Handlers
  // ========================================

  /**
   * Handle deposit event - track user deposit
   */
  private async handleDeposit(event: {
    user: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Processing deposit: ${event.user} deposited ${event.amount}`);
    
    try {
      // Find or create user
      let user = await this.userRepository.findOne({
        where: { walletAddress: event.user.toLowerCase() },
      });

      if (!user) {
        user = this.userRepository.create({
          walletAddress: event.user.toLowerCase(),
          isActive: true,
        });
        await this.userRepository.save(user);
        this.logger.log(`Created user from deposit event: ${event.user}`);
      }

      // Note: Actual balance is tracked on-chain via AssetHubService
      // This event is for logging/analytics purposes
      this.logger.log(`Deposit recorded: ${event.user} deposited ${event.amount} (tx: ${event.transactionHash})`);
    } catch (error) {
      this.logger.error(`Failed to handle deposit: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle withdrawal event
   */
  private async handleWithdrawal(event: {
    user: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Processing withdrawal: ${event.user} withdrew ${event.amount}`);
    
    // Withdrawal tracking for analytics
    // Actual balance updates come from blockchain queries
  }

  /**
   * Handle investment initiated event - create position record
   */
  private async handleInvestmentInitiated(event: {
    positionId: string;
    user: string;
    chainId: number;
    poolId: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Processing investment initiated: ${event.positionId}`);

    try {
      // Find user
      const user = await this.userRepository.findOne({
        where: { walletAddress: event.user.toLowerCase() },
      });

      if (!user) {
        this.logger.warn(`User not found for investment: ${event.user}`);
        return;
      }

      // Find pool
      const pool = await this.poolRepository.findOne({
        where: { poolAddress: event.poolId },
      });

      // Create or update position
      let position = await this.positionRepository.findOne({
        where: { assetHubPositionId: event.positionId },
      });

      if (!position) {
        position = this.positionRepository.create({
          assetHubPositionId: event.positionId,
          userId: user.id,
          poolId: pool?.id,
          amount: event.amount,
          chainId: event.chainId,
          status: PositionStatus.PENDING_EXECUTION,
          createdAt: new Date(),
        });
      } else {
        position.status = PositionStatus.PENDING_EXECUTION;
      }

      await this.positionRepository.save(position);
      this.logger.log(`Position created/updated: ${event.positionId} - PENDING_EXECUTION`);
    } catch (error) {
      this.logger.error(`Failed to handle investment initiated: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle execution confirmed event - update position to ACTIVE
   */
  private async handleExecutionConfirmed(event: {
    positionId: string;
    chainId: number;
    remotePositionId: string;
    liquidity: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Processing execution confirmed: ${event.positionId}`);

    try {
      const position = await this.positionRepository.findOne({
        where: { assetHubPositionId: event.positionId },
      });

      if (!position) {
        this.logger.warn(`Position not found for execution confirmation: ${event.positionId}`);
        return;
      }

      position.status = PositionStatus.ACTIVE;
      position.moonbeamPositionId = event.remotePositionId;
      position.liquidity = event.liquidity;
      position.executedAt = new Date();

      await this.positionRepository.save(position);
      this.logger.log(`Position updated: ${event.positionId} - ACTIVE (remote: ${event.remotePositionId})`);
    } catch (error) {
      this.logger.error(`Failed to handle execution confirmed: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle position liquidated event - update position to LIQUIDATED
   */
  private async handlePositionLiquidated(event: {
    positionId: string;
    user: string;
    finalAmount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Processing position liquidated: ${event.positionId}`);

    try {
      const position = await this.positionRepository.findOne({
        where: { assetHubPositionId: event.positionId },
      });

      if (!position) {
        this.logger.warn(`Position not found for liquidation: ${event.positionId}`);
        return;
      }

      position.status = PositionStatus.LIQUIDATED;
      position.returnedAmount = event.finalAmount;
      position.liquidatedAt = new Date();

      await this.positionRepository.save(position);
      this.logger.log(`Position updated: ${event.positionId} - LIQUIDATED (returned: ${event.finalAmount})`);
    } catch (error) {
      this.logger.error(`Failed to handle position liquidated: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle liquidation settled event
   */
  private async handleLiquidationSettled(event: {
    positionId: string;
    user: string;
    receivedAmount: string;
    expectedAmount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Liquidation settled: ${event.positionId} - received: ${event.receivedAmount}, expected: ${event.expectedAmount}`);
    
    // Log any slippage for analytics
    const received = BigInt(event.receivedAmount);
    const expected = BigInt(event.expectedAmount);
    if (received < expected) {
      const slippage = ((expected - received) * 10000n) / expected;
      this.logger.warn(`Slippage detected: ${Number(slippage) / 100}% on position ${event.positionId}`);
    }
  }

  // ========================================
  // Moonbeam Event Handlers
  // ========================================

  /**
   * Handle pending position created on Moonbeam
   */
  private async handlePendingPositionCreated(event: {
    assetHubPositionId: string;
    user: string;
    token: string;
    amount: string;
    poolId: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Pending position created on Moonbeam: ${event.assetHubPositionId}`);
    
    // Position state is primarily managed via AssetHub events
    // This is for cross-referencing and debugging
  }

  /**
   * Handle Moonbeam position executed
   */
  private async handleMoonbeamPositionExecuted(event: {
    assetHubPositionId: string;
    localPositionId: number;
    nfpmTokenId: number;
    liquidity: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Moonbeam position executed: ${event.assetHubPositionId} -> local ${event.localPositionId}`);

    try {
      const position = await this.positionRepository.findOne({
        where: { assetHubPositionId: event.assetHubPositionId },
      });

      if (position) {
        // Update with Moonbeam-specific data
        position.moonbeamPositionId = String(event.localPositionId);
        position.liquidity = event.liquidity;
        await this.positionRepository.save(position);
      }
    } catch (error) {
      this.logger.error(`Failed to handle Moonbeam execution: ${error.message}`);
    }
  }

  /**
   * Handle Moonbeam position liquidated
   */
  private async handleMoonbeamPositionLiquidated(event: {
    positionId: number;
    user: string;
    amount0: string;
    amount1: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Moonbeam position liquidated: ${event.positionId}`);
    
    // The main liquidation handling is done via AssetHub events
    // This captures the Moonbeam-side details for debugging
  }

  /**
   * Handle pending position cancelled
   */
  private async handlePendingPositionCancelled(event: {
    assetHubPositionId: string;
    user: string;
    refundAmount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    this.logger.log(`Pending position cancelled: ${event.assetHubPositionId} - refund: ${event.refundAmount}`);

    try {
      const position = await this.positionRepository.findOne({
        where: { assetHubPositionId: event.assetHubPositionId },
      });

      if (position) {
        position.status = PositionStatus.FAILED;
        await this.positionRepository.save(position);
        this.logger.log(`Position marked as FAILED: ${event.assetHubPositionId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle cancelled position: ${error.message}`);
    }
  }
}
