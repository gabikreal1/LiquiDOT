import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetHubService, AssetHubEventCallbacks } from './asset-hub.service';
import { MoonbeamService, MoonbeamEventCallbacks } from './moonbeam.service';

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
    },
    lastEventTime: null,
    isListening: false,
  };

  constructor(
    private configService: ConfigService,
    private assetHubService: AssetHubService,
    private moonbeamService: MoonbeamService,
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
    this.logger.log('Blockchain event listeners started');
  }

  /**
   * Stop listening to blockchain events
   */
  async stopListening(): Promise<void> {
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
        this.logger.debug(`Moonbeam Pending Position: ${event.assetHubPositionId}`);
        this.callbacks.moonbeam?.onPendingPositionCreated?.(event);
      },

      onPositionExecuted: (event) => {
        this.stats.moonbeam.positionsExecuted++;
        this.stats.lastEventTime = new Date();
        this.logger.log(`Moonbeam Position Executed: ${event.localPositionId} (AH: ${event.assetHubPositionId})`);
        this.callbacks.moonbeam?.onPositionExecuted?.(event);
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
      },
    };

    this.moonbeamService.setupEventListeners(moonbeamCallbacks);
    this.logger.log('Moonbeam event listeners configured');
  }
}
