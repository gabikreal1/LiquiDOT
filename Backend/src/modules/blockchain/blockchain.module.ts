import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetHubService } from './services/asset-hub.service';
import { MoonbeamService } from './services/moonbeam.service';
import { XcmBuilderService } from './services/xcm-builder.service';
import { BlockchainEventListenerService } from './services/event-listener.service';
import { TestModeService } from './services/test-mode.service';
import { XcmRetryService } from './services/xcm-retry.service';
import { EventPersistenceService } from './services/event-persistence.service';
import { User } from '../users/entities/user.entity';
import { Position } from '../positions/entities/position.entity';
import { Pool } from '../pools/entities/pool.entity';

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
 * - EventPersistenceService: Persists blockchain events to database
 * - TestModeService: Manages test mode synchronization across backend and contracts
 * - XcmRetryService: Provides retry logic with exponential backoff for XCM operations
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
 *   private testModeService: TestModeService,
 *   private xcmRetryService: XcmRetryService,
 * ) {}
 * ```
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Position, Pool]),
  ],
  providers: [
    // Core services
    TestModeService,        // Must be first - other services may depend on test mode
    XcmRetryService,        // Retry logic for XCM operations
    
    // Contract interaction services
    XcmBuilderService,      // XCM message building
    AssetHubService,        // AssetHub contract interactions
    MoonbeamService,        // Moonbeam contract interactions
    
    // Event handling
    BlockchainEventListenerService,
    EventPersistenceService, // Persists events to database
  ],
  exports: [
    AssetHubService,
    MoonbeamService,
    XcmBuilderService,
    BlockchainEventListenerService,
    TestModeService,
    XcmRetryService,
  ],
})
export class BlockchainModule {}
