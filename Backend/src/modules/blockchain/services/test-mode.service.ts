import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { XCMProxyABI } from '../abis/XCMProxy.abi';
import { AssetHubVaultABI } from '../abis/AssetHubVault.abi';

/**
 * Test mode synchronization status
 */
export interface TestModeStatus {
  /** Backend test mode flag */
  backendTestMode: boolean;
  /** XCMProxy contract test mode */
  xcmProxyTestMode: boolean | null;
  /** AssetHubVault contract test mode */
  assetHubTestMode: boolean | null;
  /** Whether all systems are synchronized */
  synchronized: boolean;
  /** Last synchronization timestamp */
  lastSyncTime: Date | null;
}

/**
 * TestModeService
 * 
 * Centralized service to manage test mode across the backend and contracts.
 * In test mode:
 * - XCM validation is skipped in contracts
 * - Mock XCM messages are used instead of real ParaSpell SDK calls
 * - Direct contract calls are allowed without XCM origin verification
 * 
 * Environment variables:
 * - TEST_MODE: Enable/disable test mode (default: false)
 * - NODE_ENV: Auto-enables test mode when 'development' or 'test'
 * 
 * @see XCMProxy.sol testMode flag
 * @see AssetHubVault.sol testMode flag
 */
@Injectable()
export class TestModeService implements OnModuleInit {
  private readonly logger = new Logger(TestModeService.name);
  
  private _isTestMode: boolean;
  private lastSyncTime: Date | null = null;
  
  // Contract connections (initialized lazily)
  private xcmProxyContract: ethers.Contract | null = null;
  private assetHubContract: ethers.Contract | null = null;
  private xcmProxyWriteContract: ethers.Contract | null = null;
  private assetHubWriteContract: ethers.Contract | null = null;

  constructor(private configService: ConfigService) {
    // Determine test mode from environment
    const envTestMode = this.configService.get<string>('TEST_MODE', 'false');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'production');
    
    // Enable test mode if explicitly set, or if in development/test environment
    this._isTestMode = 
      envTestMode.toLowerCase() === 'true' || 
      nodeEnv === 'development' || 
      nodeEnv === 'test';
    
    if (this._isTestMode) {
      this.logger.warn('🧪 TEST MODE ENABLED - XCM validation will be skipped');
    }
  }

  /**
   * Initialize contract connections on module startup
   */
  async onModuleInit() {
    await this.initializeContracts();
    
    // Auto-sync test mode to contracts on startup
    if (this._isTestMode) {
      await this.syncTestModeToContracts();
    }
  }

  /**
   * Initialize read-only contract connections for status checks
   */
  private async initializeContracts(): Promise<void> {
    try {
      const moonbeamRpc = this.configService.get<string>('MOONBEAM_RPC_URL');
      const assetHubRpc = this.configService.get<string>('ASSET_HUB_RPC_URL');
      const xcmProxyAddress = this.configService.get<string>('MOONBEAM_XCM_PROXY_ADDRESS');
      const assetHubAddress = this.configService.get<string>('ASSET_HUB_VAULT_ADDRESS');
      const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');

      if (moonbeamRpc && xcmProxyAddress) {
        const moonbeamProvider = new ethers.JsonRpcProvider(moonbeamRpc);
        this.xcmProxyContract = new ethers.Contract(
          xcmProxyAddress,
          XCMProxyABI,
          moonbeamProvider,
        );
        
        if (privateKey) {
          const wallet = new ethers.Wallet(privateKey, moonbeamProvider);
          this.xcmProxyWriteContract = new ethers.Contract(
            xcmProxyAddress,
            XCMProxyABI,
            wallet,
          );
        }
        this.logger.log('XCMProxy contract connection initialized');
      }

      if (assetHubRpc && assetHubAddress) {
        const assetHubProvider = new ethers.JsonRpcProvider(assetHubRpc);
        this.assetHubContract = new ethers.Contract(
          assetHubAddress,
          AssetHubVaultABI,
          assetHubProvider,
        );
        
        if (privateKey) {
          const wallet = new ethers.Wallet(privateKey, assetHubProvider);
          this.assetHubWriteContract = new ethers.Contract(
            assetHubAddress,
            AssetHubVaultABI,
            wallet,
          );
        }
        this.logger.log('AssetHubVault contract connection initialized');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize contracts: ${error.message}`);
    }
  }

  /**
   * Check if test mode is enabled (backend flag)
   */
  isTestMode(): boolean {
    return this._isTestMode;
  }

  /**
   * Get current test mode status across all systems
   */
  async getStatus(): Promise<TestModeStatus> {
    let xcmProxyTestMode: boolean | null = null;
    let assetHubTestMode: boolean | null = null;

    try {
      if (this.xcmProxyContract) {
        xcmProxyTestMode = await this.xcmProxyContract.testMode();
      }
    } catch (error) {
      this.logger.warn(`Failed to read XCMProxy testMode: ${error.message}`);
    }

    try {
      if (this.assetHubContract) {
        assetHubTestMode = await this.assetHubContract.testMode();
      }
    } catch (error) {
      this.logger.warn(`Failed to read AssetHubVault testMode: ${error.message}`);
    }

    const synchronized = 
      (xcmProxyTestMode === null || xcmProxyTestMode === this._isTestMode) &&
      (assetHubTestMode === null || assetHubTestMode === this._isTestMode);

    return {
      backendTestMode: this._isTestMode,
      xcmProxyTestMode,
      assetHubTestMode,
      synchronized,
      lastSyncTime: this.lastSyncTime,
    };
  }

  /**
   * Synchronize test mode flag to contracts
   * Requires owner/admin privileges on contracts
   */
  async syncTestModeToContracts(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Sync XCMProxy
    if (this.xcmProxyWriteContract) {
      try {
        const currentMode = await this.xcmProxyContract?.testMode();
        if (currentMode !== this._isTestMode) {
          this.logger.log(`Setting XCMProxy testMode to ${this._isTestMode}`);
          const tx = await this.xcmProxyWriteContract.setTestMode(this._isTestMode);
          await tx.wait();
          this.logger.log('XCMProxy testMode synchronized');
        }
      } catch (error) {
        const msg = `Failed to sync XCMProxy testMode: ${error.message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    // Sync AssetHubVault
    if (this.assetHubWriteContract) {
      try {
        const currentMode = await this.assetHubContract?.testMode();
        if (currentMode !== this._isTestMode) {
          this.logger.log(`Setting AssetHubVault testMode to ${this._isTestMode}`);
          const tx = await this.assetHubWriteContract.setTestMode(this._isTestMode);
          await tx.wait();
          this.logger.log('AssetHubVault testMode synchronized');
        }
      } catch (error) {
        const msg = `Failed to sync AssetHubVault testMode: ${error.message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    this.lastSyncTime = new Date();
    return { success: errors.length === 0, errors };
  }

  /**
   * Enable test mode (backend + contracts)
   */
  async enableTestMode(): Promise<{ success: boolean; errors: string[] }> {
    this._isTestMode = true;
    this.logger.warn('🧪 TEST MODE ENABLED');
    return this.syncTestModeToContracts();
  }

  /**
   * Disable test mode (backend + contracts)
   */
  async disableTestMode(): Promise<{ success: boolean; errors: string[] }> {
    this._isTestMode = false;
    this.logger.log('✅ TEST MODE DISABLED - Production mode active');
    return this.syncTestModeToContracts();
  }

  /**
   * Helper to check if XCM operations should be skipped
   * Use this in services before making XCM calls
   */
  shouldSkipXcm(): boolean {
    return this._isTestMode;
  }

  /**
   * Helper to check if XCM validation should be skipped
   * Use this when validating XCM caller addresses
   */
  shouldSkipXcmValidation(): boolean {
    return this._isTestMode;
  }
}
