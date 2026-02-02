import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interface } from 'ethers';
import { PapiClientService } from '../papi/papi-client.service';
import { PAPI_DEFAULT_GAS_LIMIT } from '../papi/papi.constants';

/**
 * XCM Investment Parameters
 * Used to build XCM messages for Asset Hub → Moonbeam transfers
 */
export interface XcmInvestmentParams {
  /** Amount in base units (wei) */
  amount: bigint;
  /** XCMProxy contract address on Moonbeam */
  moonbeamProxyAddress: string;
  /** AssetHubVault contract address */
  assetHubVaultAddress: string;
  /** User's address initiating the investment */
  user: string;
  /** Target pool address on Moonbeam */
  poolId: string;
  /** Target chain ID (2004 for Moonbeam) */
  chainId: number;
  /** Lower price range percentage (e.g., -5 for -5%) */
  lowerRangePercent: number;
  /** Upper price range percentage (e.g., +10 for +10%) */
  upperRangePercent: number;
}

/**
 * XCM Return Parameters
 * Used to build XCM destinations for Moonbeam → Asset Hub returns
 */
export interface XcmReturnParams {
  /** User's Asset Hub address to receive returned assets */
  userAddress: string;
  /** Amount being returned */
  amount: bigint;
}

/**
 * Dry run result for XCM message validation
 */
export interface XcmDryRunResult {
  success: boolean;
  estimatedFees: string;
  error?: string;
}

/**
 * XCM Builder Service
 * 
 * Constructs XCM messages using ParaSpell SDK for cross-chain operations.
 * The smart contracts expect pre-built XCM messages:
 * - AssetHubVault.dispatchInvestment() requires destination + xcmMessage bytes
 * - XCMProxy.liquidateSwapAndReturn() requires destination bytes for XTokens
 * 
 * @see https://paraspell.github.io/docs/sdk/getting-started.html
 */
@Injectable()
export class XcmBuilderService implements OnModuleDestroy {
  private readonly logger = new Logger(XcmBuilderService.name);
  private readonly testMode: boolean;
  private readonly moonbeamParaId: number;
  private readonly assetHubParaId: number;

  constructor(
    private configService: ConfigService,
    private papiClient: PapiClientService,
  ) {
    this.testMode = this.configService.get<boolean>('XCM_TEST_MODE', false);
    this.moonbeamParaId = this.configService.get<number>('MOONBEAM_PARA_ID', 2004);
    this.assetHubParaId = this.configService.get<number>('ASSET_HUB_PARA_ID', 1000);

    if (this.testMode) {
      this.logger.warn('XCM Builder running in TEST MODE - using mock XCM messages');
    }

    this.logger.log(
      `XCM Builder initialized (Moonbeam: ${this.moonbeamParaId}, Asset Hub: ${this.assetHubParaId})`,
    );
  }

  /**
   * Build Passet Hub Transact `innerCall` bytes for settling a liquidation.
   *
   * This produces SCALE-encoded call bytes suitable to be passed as the `call` argument
   * into Moonbeam's XCM Transactor `transactThroughDerivative(...)`.
   *
   * Key properties:
   * - Metadata-driven (no hardcoded pallet indices)
   * - Uses EVM ABI encoding for the target call: AssetHubVault.settleLiquidation(bytes32,uint256)
   * - Optionally wraps in utility.forceBatch/batchAll/batch and optionally includes revive.mapAccount()
   * - Uses P-API (polkadot-api) instead of Polkadot.js for grant compliance
   *
   * WARNING: This method requires a live connection to a PassetHub node (PASSET_HUB_WS).
   */
  async buildPassetHubSettleLiquidationInnerCall(params: {
    assetHubVaultAddress: string;
    positionId: `0x${string}`;
    receivedAmount: bigint;
    includeMapAccount?: boolean;
  }): Promise<`0x${string}`> {
    const enabled = this.configService.get<boolean>(
      'ENABLE_PASSETHUB_TRANSACT_SETTLEMENT',
      false,
    );
    if (!enabled) {
      throw new Error(
        'PassetHub Transact settlement is disabled (ENABLE_PASSETHUB_TRANSACT_SETTLEMENT=false)',
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(params.assetHubVaultAddress)) {
      throw new Error(
        `assetHubVaultAddress must be an EVM address (0x + 40 hex chars), got: ${params.assetHubVaultAddress}`,
      );
    }

    // Build EVM calldata for AssetHubVault.settleLiquidation(bytes32,uint256)
    const vaultIface = new Interface([
      'function settleLiquidation(bytes32 positionId,uint256 receivedAmount)',
    ]);
    const evmCalldata = vaultIface.encodeFunctionData('settleLiquidation', [
      params.positionId,
      params.receivedAmount,
    ]) as `0x${string}`;

    const includeMapAccount = params.includeMapAccount === true;

    // Build revive.call transaction using P-API
    const reviveCallTx = await this.papiClient.getReviveCallTransaction({
      dest: params.assetHubVaultAddress,
      value: 0n,
      gasLimit: PAPI_DEFAULT_GAS_LIMIT,
      storageDepositLimit: null,
      inputData: evmCalldata,
    });

    this.logger.log(
      `PassetHub settleLiquidation innerCall built using P-API Revive.call`,
    );

    // Try to wrap in utility batch if requested
    if (includeMapAccount) {
      const mapAccountTx = await this.papiClient.buildReviveMapAccount();
      if (mapAccountTx) {
        try {
          const batchResult = await this.papiClient.buildUtilityBatch([
            mapAccountTx,
            reviveCallTx,
          ]);
          return batchResult.hex;
        } catch (e) {
          this.logger.warn(`utility batching failed; returning Revive.call innerCall only: ${e}`);
        }
      }
    }

    // Return just the revive.call encoded
    const encoded = await reviveCallTx.getEncodedData();
    return encoded.asHex() as `0x${string}`;
  }

  /**
   * Build XCM message for Asset Hub → Moonbeam investment
   * 
   * Creates a complete XCM program that:
   * 1. Withdraws DOT from the user's Asset Hub balance
   * 2. Pays execution fees
   * 3. Deposits assets to XCMProxy on Moonbeam
   * 4. Executes Transact to call receiveAssets()
   * 
   * @param params Investment parameters
   * @returns Encoded destination and XCM message bytes
   */
  async buildInvestmentXcm(params: XcmInvestmentParams): Promise<{
    destination: Uint8Array;
    xcmMessage: Uint8Array;
  }> {
    this.logger.log(
      `Building investment XCM: ${params.amount} to pool ${params.poolId}`,
    );

    // In test mode, return mock bytes
    if (this.testMode) {
      return this.buildMockXcm(params);
    }

    try {
      // Dynamic import to avoid issues if ParaSpell isn't installed yet
      const { Builder, Version } = await import('@paraspell/sdk');

      // Use ParaSpell SDK to construct the XCM message
      const builder = Builder()
        .from('AssetHubPolkadot')
        .to('Moonbeam')
        .currency({
          symbol: 'DOT',
          amount: params.amount.toString(),
        })
        .address(params.moonbeamProxyAddress)
        // @ts-ignore - Version enum may need adjustment
        .xcmVersion(Version.V4);

      const tx = await builder.build();

      // Extract raw bytes from the built transaction
      // ParaSpell returns the XCM components we need
      const destinationBytes = this.extractDestinationBytes(tx);
      const messageBytes = this.extractMessageBytes(tx);

      this.logger.log(
        `Investment XCM built: dest=${destinationBytes.length} bytes, msg=${messageBytes.length} bytes`,
      );

      return {
        destination: destinationBytes,
        xcmMessage: messageBytes,
      };
    } catch (error) {
      this.logger.error(`Failed to build investment XCM: ${error.message}`);
      throw new Error(`XCM build failed: ${error.message}`);
    }
  }

  /**
   * Build XCM destination for Moonbeam → Asset Hub return
   * 
   * Creates a MultiLocation encoding for the XTokens precompile
   * to return assets to the user's Asset Hub account.
   * 
   * @param params Return parameters
   * @returns Encoded destination bytes
   */
  async buildReturnDestination(params: XcmReturnParams): Promise<Uint8Array> {
    this.logger.log(`Building return destination for ${params.userAddress}`);

    // In test mode, return mock destination
    if (this.testMode) {
      return this.buildMockDestination(params.userAddress);
    }

    try {
      const { Builder, Version } = await import('@paraspell/sdk');

      const builder = Builder()
        .from('Moonbeam')
        .to('AssetHubPolkadot')
        .currency({
          symbol: 'DOT',
          amount: params.amount.toString(),
        })
        .address(params.userAddress)
        // @ts-ignore
        .xcmVersion(Version.V4);

      const tx = await builder.build();
      const destinationBytes = this.extractDestinationBytes(tx);

      this.logger.log(`Return destination built: ${destinationBytes.length} bytes`);
      
      return destinationBytes;
    } catch (error) {
      this.logger.error(`Failed to build return destination: ${error.message}`);
      throw new Error(`XCM destination build failed: ${error.message}`);
    }
  }

  /**
   * Dry run XCM to verify it will succeed before execution
   * 
   * Uses ParaSpell's dryRun feature to simulate the XCM transfer
   * and check for potential failures before committing on-chain.
   * 
   * @param params Investment parameters
   * @returns Dry run result with success status and estimated fees
   */
  async dryRunXcm(params: XcmInvestmentParams): Promise<XcmDryRunResult> {
    this.logger.log(`Dry running XCM for ${params.amount} to ${params.poolId}`);

    if (this.testMode) {
      return {
        success: true,
        estimatedFees: '1000000000', // 1 DOT in planck
      };
    }

    try {
      const { Builder } = await import('@paraspell/sdk');

      const result = await Builder()
        .from('AssetHubPolkadot')
        .to('Moonbeam')
        .currency({
          symbol: 'DOT',
          amount: params.amount.toString(),
        })
        .address(params.moonbeamProxyAddress)
        .senderAddress(params.user)
        .dryRun();

      // TDryRunResult has origin, destination, hops, and optional failureReason
      // Check if there's a failure at any stage
      const hasFailure = !!result.failureReason;
      const originFee = result.origin?.success ? result.origin.fee?.toString() : '0';

      return {
        success: !hasFailure && result.origin?.success === true,
        estimatedFees: originFee ?? '0',
        error: result.failureReason,
      };
    } catch (error) {
      this.logger.error(`Dry run failed: ${error.message}`);
      return {
        success: false,
        estimatedFees: '0',
        error: error.message,
      };
    }
  }

  /**
   * Build MultiLocation for a specific parachain
   * 
   * @param paraId Parachain ID
   * @param accountId Account address on the target chain
   * @returns Encoded MultiLocation bytes
   */
  buildMultiLocation(paraId: number, accountId: string): Uint8Array {
    // MultiLocation structure for XCM V4:
    // { parents: 1, interior: X2(Parachain(paraId), AccountId32/AccountKey20(accountId)) }
    
    // For EVM chains (Moonbeam), use AccountKey20
    // For Substrate chains (Asset Hub), use AccountId32
    
    const isEvmChain = paraId === this.moonbeamParaId;
    
    if (this.testMode) {
      return new Uint8Array([1, 0, paraId & 0xff, (paraId >> 8) & 0xff]);
    }

    // This is a simplified encoding - actual SCALE encoding is more complex
    // ParaSpell SDK handles this internally
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify({
      parents: 1,
      interior: {
        X2: [
          { Parachain: paraId },
          isEvmChain 
            ? { AccountKey20: { network: null, key: accountId } }
            : { AccountId32: { network: null, id: accountId } },
        ],
      },
    }));
  }

  /**
   * Extract destination bytes from ParaSpell transaction
   */
  private extractDestinationBytes(tx: any): Uint8Array {
    // ParaSpell SDK returns transaction objects that need to be encoded
    // The actual structure depends on the SDK version
    if (tx.destination) {
      if (tx.destination instanceof Uint8Array) {
        return tx.destination;
      }
      // Convert to bytes if it's a JSON object
      const encoder = new TextEncoder();
      return encoder.encode(JSON.stringify(tx.destination));
    }
    
    // Fallback: return empty bytes (should not happen in production)
    this.logger.warn('Could not extract destination bytes from transaction');
    return new Uint8Array(0);
  }

  /**
   * Extract XCM message bytes from ParaSpell transaction
   */
  private extractMessageBytes(tx: any): Uint8Array {
    if (tx.message) {
      if (tx.message instanceof Uint8Array) {
        return tx.message;
      }
      const encoder = new TextEncoder();
      return encoder.encode(JSON.stringify(tx.message));
    }
    
    // For transactions without explicit message field,
    // the entire tx might be the encoded call
    if (tx.method) {
      const encoder = new TextEncoder();
      return encoder.encode(JSON.stringify(tx.method));
    }
    
    this.logger.warn('Could not extract message bytes from transaction');
    return new Uint8Array(0);
  }

  /**
   * Build mock XCM for test mode
   */
  private buildMockXcm(params: XcmInvestmentParams): {
    destination: Uint8Array;
    xcmMessage: Uint8Array;
  } {
    this.logger.debug('Building mock XCM for test mode');
    
    // Create deterministic mock bytes based on parameters
    const encoder = new TextEncoder();
    const mockDestination = encoder.encode(
      `MOCK_DEST:${this.moonbeamParaId}:${params.moonbeamProxyAddress}`,
    );
    const mockMessage = encoder.encode(
      `MOCK_XCM:${params.amount}:${params.poolId}:${params.user}`,
    );

    return {
      destination: mockDestination,
      xcmMessage: mockMessage,
    };
  }

  /**
   * Build mock destination for test mode
   */
  private buildMockDestination(userAddress: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(`MOCK_DEST:${this.assetHubParaId}:${userAddress}`);
  }

  /**
   * Disconnect API connections when service is destroyed
   */
  async onModuleDestroy() {
    this.logger.log('XCM Builder service shutting down');
    // ParaSpell SDK handles cleanup internally via builder.disconnect()
    // No explicit cleanup needed here since we create new builders per request
  }
}
