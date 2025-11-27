import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetHubService } from './services/asset-hub.service';
import { MoonbeamService } from './services/moonbeam.service';
import { XcmBuilderService } from './services/xcm-builder.service';
import { BlockchainEventListenerService } from './services/event-listener.service';

/**
 * BlockchainModule
 * 
 * Provides services for interacting with blockchain contracts on AssetHub and Moonbeam.
 * 
 * Services:
 * - AssetHubService: Manages AssetHubVault contract (deposits, investments, positions)
 * - MoonbeamService: Manages XCMProxy contract (LP positions, liquidations, swaps)
 * - XcmBuilderService: Builds XCM messages for cross-chain operations
 * - BlockchainEventListenerService: Unified event listener for both chains
 * 
 * Usage:
 * ```typescript
 * import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
 * 
 * @Module({
 *   imports: [BlockchainModule],
 * })
 * export class AppModule {}
 * ```
 * 
 * Then inject services:
 * ```typescript
 * constructor(
 *   private assetHubService: AssetHubService,
 *   private moonbeamService: MoonbeamService,
 * ) {}
 * ```
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Core contract services
    XcmBuilderService,      // Must be first - AssetHubService depends on it
    AssetHubService,
    MoonbeamService,
    
    // Event handling
    BlockchainEventListenerService,
  ],
  exports: [
    AssetHubService,
    MoonbeamService,
    XcmBuilderService,
    BlockchainEventListenerService,
  ],
})
export class BlockchainModule {}
