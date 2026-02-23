import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetHubService, AssetHubEventCallbacks } from './asset-hub.service';
import { MoonbeamService, MoonbeamEventCallbacks } from './moonbeam.service';
import { XcmRetryService } from './xcm-retry.service';
import { Position, PositionStatus } from '../../positions/entities/position.entity';
import { ActivityLog, ActivityType, ActivityStatus } from '../../activity-logs/entities/activity-log.entity';

/**
 * Combined event callbacks for both chains
 */
export interface BlockchainEventCallbacks {
  assetHub?: AssetHubEventCallbacks;
  moonbeam?: MoonbeamEventCallbacks;
}

/**
 * Event statistics for monitoring
 */
export interface EventStats {
  assetHub: {
    investmentsInitiated: number;
    executionsConfirmed: number;
    positionsLiquidated: number;
    deposits: number;
    withdrawals: number;
  };
  moonbeam: {
    assetsReceived: number;
    positionsExecuted: number;
    liquidationsCompleted: number;
    assetsReturned: number;
    pendingPositionsCancelled: number;
  };
  lastEventTime: Date | null;
  isListening: boolean;
}

/**
 * BlockchainEventListenerService
 * 
 * Unified event listener for both AssetHub and Moonbeam chains.
 * Provides a single point of configuration for all blockchain events.
 * 
 * Features:
 * - Automatic reconnection on disconnect
 * - Event statistics tracking
 * - Graceful shutdown
 * - Event forwarding to registered handlers
 * 
 * Usage:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private eventListener: BlockchainEventListenerService) {
 *     this.eventListener.registerCallbacks({
 *       assetHub: {
 *         onInvestmentInitiated: (event) => this.handleInvestment(event),
 *       },
 *       moonbeam: {
 *         onPositionExecuted: (event) => this.handleExecution(event),
 *       },
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class BlockchainEventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainEventListenerService.name);
  private isListening = false;
  private callbacks: BlockchainEventCallbacks = {};
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectDelay = 60_000; // 1 minute max backoff
  
  private stats: EventStats = {
    assetHub: {
      investmentsInitiated: 0,
      executionsConfirmed: 0,
      positionsLiquidated: 0,
      deposits: 0,
      withdrawals: 0,
    },
    moonbeam: {
      assetsReceived: 0,
      positionsExecuted: 0,
      liquidationsCompleted: 0,
      assetsReturned: 0,
      pendingPositionsCancelled: 0,
    },
    lastEventTime: null,
    isListening: false,
  };

  constructor(
    private configService: ConfigService,
    private assetHubService: AssetHubService,
    private moonbeamService: MoonbeamService,
    private xcmRetryService: XcmRetryService,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Initialize event listeners on module startup
   */
  async onModuleInit() {
    const autoStart = this.configService.get<boolean>('BLOCKCHAIN_EVENTS_AUTO_START', true);
    
    if (autoStart) {
      await this.startListening();
    } else {
      this.logger.log('Event listeners not auto-started (BLOCKCHAIN_EVENTS_AUTO_START=false)');
    }
  }

  /**
   * Cleanup on module shutdown
   */
  async onModuleDestroy() {
    await this.stopListening();
  }

  /**
   * Register callbacks for blockchain events
   */
  registerCallbacks(callbacks: BlockchainEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
    
    // If already listening, restart to apply new callbacks
    if (this.isListening) {
      this.logger.log('Restarting event listeners with new callbacks');
      this.stopListening();
      this.startListening();
    }
  }

  /**
   * Start listening to blockchain events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Event listeners already active');
      return;
    }

    this.logger.log('Starting blockchain event listeners...');

    // Setup AssetHub listeners
    if (this.assetHubService.isInitialized()) {
      this.setupAssetHubListeners();
    } else {
      this.logger.warn('AssetHub service not initialized, skipping listeners');
    }

    // Setup Moonbeam listeners
    if (this.moonbeamService.isInitialized()) {
      this.setupMoonbeamListeners();
    } else {
      this.logger.warn('Moonbeam service not initialized, skipping listeners');
    }

    this.isListening = true;
    this.stats.isListening = true;
    this.reconnectAttempt = 0;
    this.logger.log('Blockchain event listeners started');
  }

  /**
   * Stop listening to blockchain events
   */
  async stopListening(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.isListening) {
      return;
    }

    this.logger.log('Stopping blockchain event listeners...');

    this.assetHubService.removeAllListeners();
    this.moonbeamService.removeAllListeners();

    this.isListening = false;
    this.stats.isListening = false;
    this.logger.log('Blockchain event listeners stopped');
  }

  /**
   * Attempt to reconnect with exponential backoff.
   * Called when a WebSocket disconnect or provider error is detected.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return; // Already scheduled

    this.reconnectAttempt++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );

    this.logger.warn(`Scheduling reconnection attempt ${this.reconnectAttempt} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        this.isListening = false;
        this.stats.isListening = false;
        await this.startListening();
        this.reconnectAttempt = 0; // Reset on success
        this.logger.log('Reconnection successful');
      } catch (err) {
        this.logger.error(`Reconnection failed: ${err instanceof Error ? err.message : String(err)}`);
        this.scheduleReconnect(); // Try again with further backoff
      }
    }, delay);
  }

  /**
   * Get current event statistics
   */
  getStats(): EventStats {
    return { ...this.stats };
  }

  /**
   * Reset event statistics
   */
  resetStats(): void {
    this.stats = {
      assetHub: {
        investmentsInitiated: 0,
        executionsConfirmed: 0,
        positionsLiquidated: 0,
        deposits: 0,
        withdrawals: 0,
      },
      moonbeam: {
        assetsReceived: 0,
        positionsExecuted: 0,
        liquidationsCompleted: 0,
        assetsReturned: 0,
        pendingPositionsCancelled: 0,
      },
      lastEventTime: null,
      isListening: this.isListening,
    };
  }

  /**
   * Setup AssetHub event listeners with statistics tracking
   */
  private setupAssetHubListeners(): void {
    const assetHubCallbacks: AssetHubEventCallbacks = {
      onDeposit: (event) => {
        this.stats.assetHub.deposits++;
        this.stats.lastEventTime = new Date();
        this.logger.debug(`AssetHub Deposit: ${event.user} deposited ${event.amount}`);
        this.callbacks.assetHub?.onDeposit?.(event);
      },

      onWithdrawal: (event) => {
        this.stats.assetHub.withdrawals++;
        this.stats.lastEventTime = new Date();
        this.logger.debug(`AssetHub Withdrawal: ${event.user} withdrew ${event.amount}`);
        this.callbacks.assetHub?.onWithdrawal?.(event);
      },

      onInvestmentInitiated: (event) => {
        this.stats.assetHub.investmentsInitiated++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`AssetHub Investment: ${event.positionId} initiated by ${event.user}`);
        this.callbacks.assetHub?.onInvestmentInitiated?.(event);
      },

      onExecutionConfirmed: (event) => {
        this.stats.assetHub.executionsConfirmed++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`AssetHub Execution: ${event.positionId} confirmed on chain ${event.chainId}`);
        this.callbacks.assetHub?.onExecutionConfirmed?.(event);
      },

      onPositionLiquidated: (event) => {
        this.stats.assetHub.positionsLiquidated++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`AssetHub Liquidation: ${event.positionId} returned ${event.finalAmount}`);
        this.callbacks.assetHub?.onPositionLiquidated?.(event);
      },

      onLiquidationSettled: (event) => {
        this.stats.lastEventTime = new Date();
        this.logger.log(`AssetHub Settlement: ${event.positionId} settled for ${event.receivedAmount}`);
        this.callbacks.assetHub?.onLiquidationSettled?.(event);
      },

      onChainAdded: (event) => {
        this.stats.lastEventTime = new Date();
        this.logger.log(`AssetHub Chain Added: ${event.chainId}`);
        this.callbacks.assetHub?.onChainAdded?.(event);
      },

      onXcmMessageSent: (event) => {
        this.stats.lastEventTime = new Date();
        this.logger.debug(`AssetHub XCM Sent: ${event.messageHash}`);
        this.callbacks.assetHub?.onXcmMessageSent?.(event);
      },
    };

    this.assetHubService.setupEventListeners(assetHubCallbacks);

    // Monitor for provider errors to trigger reconnection
    try {
      const provider = (this.assetHubService as any).provider;
      if (provider?.on) {
        provider.on('error', (err: Error) => {
          this.logger.error(`AssetHub provider error: ${err.message}`);
          this.scheduleReconnect();
        });
      }
    } catch {
      // Provider access not available — skip
    }

    this.logger.log('AssetHub event listeners configured');
  }

  /**
   * Setup Moonbeam event listeners with statistics tracking
   */
  private setupMoonbeamListeners(): void {
    const moonbeamCallbacks: MoonbeamEventCallbacks = {
      onAssetsReceived: (event) => {
        this.stats.moonbeam.assetsReceived++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Assets Received: ${event.amount} from ${event.user}`);
        this.callbacks.moonbeam?.onAssetsReceived?.(event);
      },

      onPendingPositionCreated: (event) => {
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Pending Position: ${event.assetHubPositionId} — auto-executing`);
        this.callbacks.moonbeam?.onPendingPositionCreated?.(event);

        // Orchestration: auto-execute the pending investment on Moonbeam (with retry)
        this.xcmRetryService.executeWithRetry(
          () => this.moonbeamService.executePendingInvestment(event.assetHubPositionId),
        ).then(async (attempt) => {
          if (attempt.success) {
            this.logger.log(`Auto-executed pending position ${event.assetHubPositionId} → local ID ${attempt.result} (${attempt.attempts} attempt(s))`);
          } else {
            this.logger.error(`Failed to auto-execute pending position ${event.assetHubPositionId} after ${attempt.attempts} attempts: ${attempt.error?.message}`);
            // Mark position as FAILED after exhausting retries
            try {
              await this.positionRepository.update(
                { assetHubPositionId: event.assetHubPositionId },
                { status: PositionStatus.FAILED, lastFailedAt: new Date() },
              );
            } catch (dbErr) {
              this.logger.error(`Failed to update position status: ${dbErr}`);
            }
          }
        }).catch((err) => {
          this.logger.error(`Unexpected error in executePendingInvestment retry: ${err.message}`);
        });
      },

      onPositionExecuted: (event) => {
        this.stats.moonbeam.positionsExecuted++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Position Executed: ${event.localPositionId} (AH: ${event.assetHubPositionId})`);
        this.callbacks.moonbeam?.onPositionExecuted?.(event);

        // Orchestration: confirm execution on AssetHub so position moves PENDING → ACTIVE (with retry)
        this.xcmRetryService.executeWithRetry(
          () => this.assetHubService.confirmExecution(
            event.assetHubPositionId,
            event.localPositionId.toString(),
            BigInt(event.liquidity),
          ),
        ).then(async (attempt) => {
          if (attempt.success) {
            this.logger.log(`Confirmed execution on AssetHub for position ${event.assetHubPositionId} (${attempt.attempts} attempt(s))`);
          } else {
            this.logger.error(`Failed to confirm execution on AssetHub for ${event.assetHubPositionId} after ${attempt.attempts} attempts: ${attempt.error?.message}`);
            // Log the failure for manual recovery
            try {
              await this.activityLogRepository.save(this.activityLogRepository.create({
                userId: (await this.positionRepository.findOne({ where: { assetHubPositionId: event.assetHubPositionId } }))?.userId,
                type: ActivityType.ERROR,
                status: ActivityStatus.FAILED,
                positionId: event.assetHubPositionId,
                details: { error: attempt.error?.message, operation: 'confirmExecution', attempts: attempt.attempts },
              }));
            } catch (dbErr) {
              this.logger.error(`Failed to create error activity log: ${dbErr}`);
            }
          }
        }).catch((err) => {
          this.logger.error(`Unexpected error in confirmExecution retry: ${err.message}`);
        });
      },

      onPositionLiquidated: (event) => {
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Position Liquidated: ${event.positionId}`);
        this.callbacks.moonbeam?.onPositionLiquidated?.(event);
      },

      onLiquidationCompleted: (event) => {
        this.stats.moonbeam.liquidationsCompleted++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Liquidation Complete: ${event.positionId} returned ${event.totalReturned}`);
        this.callbacks.moonbeam?.onLiquidationCompleted?.(event);
      },

      onAssetsReturned: (event) => {
        this.stats.moonbeam.assetsReturned++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Assets Returned: ${event.amount} for position ${event.positionId}`);
        this.callbacks.moonbeam?.onAssetsReturned?.(event);

        // Orchestration: settle liquidation on AssetHub (with retry)
        this.moonbeamService.getPosition(event.positionId)
          .then(async (pos) => {
            if (!pos) {
              this.logger.warn(`Cannot settle: Moonbeam position ${event.positionId} not found`);
              return;
            }

            const attempt = await this.xcmRetryService.executeWithRetry(
              () => this.assetHubService.settleLiquidation(
                pos.assetHubPositionId,
                BigInt(event.amount),
              ),
            );

            if (attempt.success) {
              this.logger.log(`Settled liquidation on AssetHub for Moonbeam position ${event.positionId} (${attempt.attempts} attempt(s))`);
            } else {
              this.logger.error(`Failed to settle liquidation for position ${event.positionId} after ${attempt.attempts} attempts: ${attempt.error?.message}`);
              // Log the failure for manual recovery
              try {
                const dbPos = await this.positionRepository.findOne({ where: { assetHubPositionId: pos.assetHubPositionId } });
                if (dbPos) {
                  await this.activityLogRepository.save(this.activityLogRepository.create({
                    userId: dbPos.userId,
                    type: ActivityType.ERROR,
                    status: ActivityStatus.FAILED,
                    positionId: pos.assetHubPositionId,
                    details: { error: attempt.error?.message, operation: 'settleLiquidation', attempts: attempt.attempts, amount: event.amount },
                  }));
                }
              } catch (dbErr) {
                this.logger.error(`Failed to create error activity log: ${dbErr}`);
              }
            }
          })
          .catch((err) => {
            this.logger.error(`Failed to settle liquidation for position ${event.positionId}: ${err.message}`);
          });
      },

      onPendingPositionCancelled: (event) => {
        this.stats.moonbeam.pendingPositionsCancelled++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Pending Position Cancelled: ${event.assetHubPositionId} refund=${event.refundAmount}`);
        this.callbacks.moonbeam?.onPendingPositionCancelled?.(event);
      },
    };

    this.moonbeamService.setupEventListeners(moonbeamCallbacks);

    // Monitor for provider errors to trigger reconnection
    try {
      const provider = (this.moonbeamService as any).provider;
      if (provider?.on) {
        provider.on('error', (err: Error) => {
          this.logger.error(`Moonbeam provider error: ${err.message}`);
          this.scheduleReconnect();
        });
      }
    } catch {
      // Provider access not available — skip
    }

    this.logger.log('Moonbeam event listeners configured');
  }
}
