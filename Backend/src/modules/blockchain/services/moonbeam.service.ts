import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { XCMProxyABI } from '../abis/XCMProxy.abi';

/**
 * Parameters for liquidating a position and returning assets to AssetHub
 */
export interface LiquidateParams {
  /** Local position ID on Moonbeam */
  positionId: number;
  /** Base asset address to swap to */
  baseAsset: string;
  /** XCM destination MultiLocation bytes for AssetHub */
  destination: Uint8Array;
  /** Minimum acceptable amount for token0 swap */
  minAmountOut0: bigint;
  /** Minimum acceptable amount for token1 swap */
  minAmountOut1: bigint;
  /** Price limit for swaps (0 for no limit) */
  limitSqrtPrice: bigint;
  /** Corresponding position ID on AssetHub */
  assetHubPositionId: string;
}

/**
 * Pending position awaiting execution after XCM transfer
 */
export interface PendingPosition {
  assetHubPositionId: string;
  token: string;
  user: string;
  amount: bigint;
  poolId: string;
  baseAsset: string;
  lowerRangePercent: number;
  upperRangePercent: number;
  slippageBps: number;
  timestamp: bigint;
  exists: boolean;
}

/**
 * Active LP position on Moonbeam DEX
 */
export interface MoonbeamPosition {
  assetHubPositionId: string;
  pool: string;
  token0: string;
  token1: string;
  bottomTick: number;
  topTick: number;
  liquidity: bigint;
  tokenId: number;
  owner: string;
  lowerRangePercent: number;
  upperRangePercent: number;
  entryPrice: bigint;
  timestamp: bigint;
  active: boolean;
}

/**
 * Result of position range check
 */
export interface RangeCheckResult {
  outOfRange: boolean;
  currentPrice: bigint;
}

/**
 * Tick range calculation result
 */
export interface TickRange {
  bottomTick: number;
  topTick: number;
}

/**
 * Collected fee amounts from LP position
 */
export interface CollectedFees {
  amount0: bigint;
  amount1: bigint;
}

/**
 * Quote result for swap simulation
 */
export interface SwapQuote {
  amountOut: bigint;
}

/**
 * Swap execution result
 */
export interface SwapResult {
  amountOut: bigint;
  transactionHash: string;
}

/**
 * XCM configuration status
 */
export interface XcmConfig {
  assetHubParaId: number;
  defaultDestWeight: bigint;
  defaultSlippageBps: number;
  trustedXcmCaller: string;
  xcmConfigFrozen: boolean;
  operator: string;
  paused: boolean;
  testMode: boolean;
}

/**
 * Event callback interfaces for Moonbeam contract events
 */
export interface MoonbeamEventCallbacks {
  onAssetsReceived?: (event: {
    token: string;
    user: string;
    amount: string;
    investmentParams: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onPendingPositionCreated?: (event: {
    assetHubPositionId: string;
    user: string;
    token: string;
    amount: string;
    poolId: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onPositionExecuted?: (event: {
    assetHubPositionId: string;
    localPositionId: number;
    nfpmTokenId: number;
    liquidity: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onPositionLiquidated?: (event: {
    positionId: number;
    user: string;
    amount0: string;
    amount1: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onLiquidationCompleted?: (event: {
    positionId: number;
    assetHubPositionId: string;
    user: string;
    baseAsset: string;
    totalReturned: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onAssetsReturned?: (event: {
    token: string;
    user: string;
    destination: string;
    amount: string;
    positionId: number;
    blockNumber: number;
    transactionHash: string;
  }) => void;
}

/**
 * MoonbeamService - Manages all interactions with XCMProxy contract on Moonbeam
 * 
 * This service handles:
 * - LP position creation after XCM transfer
 * - Position monitoring (range checks for stop-loss)
 * - Liquidation and asset return via XCM
 * - Fee collection from positions
 * - Swap operations via DEX integration
 * 
 * @see XCMProxy.sol for contract implementation
 */
@Injectable()
export class MoonbeamService implements OnModuleInit {
  private readonly logger = new Logger(MoonbeamService.name);
  private contract: ethers.Contract;
  private readOnlyContract: ethers.Contract;
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize contract connections on module startup
   */
  async onModuleInit() {
    await this.initializeContract();
  }

  private async initializeContract() {
    const rpcUrl = this.configService.get<string>('MOONBEAM_RPC_URL');
    const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
    const contractAddress = this.configService.get<string>('MOONBEAM_XCM_PROXY_ADDRESS');

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn('Missing required environment variables for Moonbeam - service will be limited');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Write contract with wallet
    this.contract = new ethers.Contract(
      contractAddress,
      XCMProxyABI,
      this.wallet,
    );

    // Read-only contract for view functions
    this.readOnlyContract = new ethers.Contract(
      contractAddress,
      XCMProxyABI,
      this.provider,
    );

    this.logger.log(`Moonbeam XCM Proxy initialized at ${contractAddress}`);
  }

  /**
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contract?.target as string;
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return !!this.contract;
  }

  /**
   * Executes a pending investment on Moonbeam
   * Called after assets arrive via XCM
   * Calls: XCMProxy.executePendingInvestment()
   */
  async executePendingInvestment(assetHubPositionId: string): Promise<number> {
    try {
      this.logger.log(`Executing pending investment ${assetHubPositionId}`);

      const tx = await this.contract.executePendingInvestment(assetHubPositionId);
      const receipt = await tx.wait();

      // Extract local position ID from PositionExecuted event
      const event = receipt.logs.find(
        (log: any) => log.eventName === 'PositionExecuted',
      );
      if (!event) {
        throw new Error('PositionExecuted event not found');
      }

      const localPositionId = Number(event.args.localPositionId);
      this.logger.log(
        `Position executed on Moonbeam. Local ID: ${localPositionId}`,
      );

      return localPositionId;
    } catch (error) {
      this.logger.error(`Failed to execute investment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if a position is out of range (for stop-loss)
   * Calls: XCMProxy.isPositionOutOfRange()
   */
  async isPositionOutOfRange(positionId: number): Promise<{
    outOfRange: boolean;
    currentPrice: bigint;
  }> {
    try {
      const result = await this.contract.isPositionOutOfRange(positionId);
      return {
        outOfRange: result.outOfRange,
        currentPrice: result.currentPrice,
      };
    } catch (error) {
      this.logger.error(`Failed to check position range: ${error.message}`);
      throw error;
    }
  }

  /**
   * Liquidates position, swaps to base asset, and sends back to AssetHub
   * Calls: XCMProxy.liquidateSwapAndReturn()
   */
  async liquidateSwapAndReturn(params: LiquidateParams): Promise<void> {
    try {
      this.logger.log(`Liquidating position ${params.positionId}`);

      const tx = await this.contract.liquidateSwapAndReturn(
        params.positionId,
        params.baseAsset,
        params.destination,
        params.minAmountOut0,
        params.minAmountOut1,
        params.limitSqrtPrice,
        params.assetHubPositionId,
      );

      await tx.wait();
      this.logger.log(`Position ${params.positionId} liquidated and returned`);
    } catch (error) {
      this.logger.error(`Failed to liquidate position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets all active positions on Moonbeam
   * Calls: XCMProxy.getActivePositions()
   */
  async getActivePositions(): Promise<MoonbeamPosition[]> {
    try {
      const positions = await this.contract.getActivePositions();
      return positions.map((p: any) => ({
        assetHubPositionId: p.assetHubPositionId,
        pool: p.pool,
        token0: p.token0,
        token1: p.token1,
        bottomTick: Number(p.bottomTick),
        topTick: Number(p.topTick),
        liquidity: p.liquidity,
        tokenId: Number(p.tokenId),
        owner: p.owner,
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        entryPrice: p.entryPrice,
        timestamp: p.timestamp,
        active: p.active,
      }));
    } catch (error) {
      this.logger.error(`Failed to get active positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets user positions from Moonbeam contract
   * Calls: XCMProxy.getUserPositions()
   */
  async getUserPositions(userAddress: string): Promise<MoonbeamPosition[]> {
    try {
      const positions = await this.contract.getUserPositions(userAddress);
      return positions.map((p: any) => ({
        assetHubPositionId: p.assetHubPositionId,
        pool: p.pool,
        token0: p.token0,
        token1: p.token1,
        bottomTick: Number(p.bottomTick),
        topTick: Number(p.topTick),
        liquidity: p.liquidity,
        tokenId: Number(p.tokenId),
        owner: p.owner,
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        entryPrice: p.entryPrice,
        timestamp: p.timestamp,
        active: p.active,
      }));
    } catch (error) {
      this.logger.error(`Failed to get user positions: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // POSITION MANAGEMENT
  // ============================================================

  /**
   * Gets a specific position by ID
   * Calls: XCMProxy.positions(positionId)
   */
  async getPosition(positionId: number): Promise<MoonbeamPosition | null> {
    try {
      const p = await this.readOnlyContract.positions(positionId);
      if (!p.active && p.liquidity === 0n) {
        return null;
      }
      return {
        assetHubPositionId: p.assetHubPositionId,
        pool: p.pool,
        token0: p.token0,
        token1: p.token1,
        bottomTick: Number(p.bottomTick),
        topTick: Number(p.topTick),
        liquidity: p.liquidity,
        tokenId: Number(p.tokenId),
        owner: p.owner,
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        entryPrice: p.entryPrice,
        timestamp: p.timestamp,
        active: p.active,
      };
    } catch (error) {
      this.logger.error(`Failed to get position ${positionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets a pending position by AssetHub position ID
   * Calls: XCMProxy.pendingPositions(assetHubPositionId)
   */
  async getPendingPosition(assetHubPositionId: string): Promise<PendingPosition | null> {
    try {
      const p = await this.readOnlyContract.pendingPositions(assetHubPositionId);
      if (!p.exists) {
        return null;
      }
      return {
        assetHubPositionId: p.assetHubPositionId,
        token: p.token,
        user: p.user,
        amount: p.amount,
        poolId: p.poolId,
        baseAsset: p.baseAsset,
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        slippageBps: Number(p.slippageBps),
        timestamp: p.timestamp,
        exists: p.exists,
      };
    } catch (error) {
      this.logger.error(`Failed to get pending position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets local position ID from AssetHub position ID
   * Calls: XCMProxy.assetHubPositionToLocalId(assetHubPositionId)
   */
  async getLocalPositionId(assetHubPositionId: string): Promise<number> {
    try {
      const localId = await this.readOnlyContract.assetHubPositionToLocalId(assetHubPositionId);
      return Number(localId);
    } catch (error) {
      this.logger.error(`Failed to get local position ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets the current position counter (total positions created)
   * Calls: XCMProxy.positionCounter()
   */
  async getPositionCounter(): Promise<number> {
    try {
      const counter = await this.readOnlyContract.positionCounter();
      return Number(counter);
    } catch (error) {
      this.logger.error(`Failed to get position counter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancels a pending position and refunds assets
   * Calls: XCMProxy.cancelPendingPosition()
   */
  async cancelPendingPosition(
    assetHubPositionId: string,
    destination: Uint8Array,
  ): Promise<string> {
    try {
      this.logger.log(`Cancelling pending position ${assetHubPositionId}`);
      const tx = await this.contract.cancelPendingPosition(assetHubPositionId, destination);
      const receipt = await tx.wait();
      this.logger.log(`Pending position cancelled. Tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to cancel pending position: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // TICK & PRICE CALCULATIONS
  // ============================================================

  /**
   * Calculates tick range based on pool and range percentages
   * Calls: XCMProxy.calculateTickRange()
   */
  async calculateTickRange(
    pool: string,
    lowerRangePercent: number,
    upperRangePercent: number,
  ): Promise<TickRange> {
    try {
      const result = await this.readOnlyContract.calculateTickRange(
        pool,
        lowerRangePercent,
        upperRangePercent,
      );
      return {
        bottomTick: Number(result.bottomTick),
        topTick: Number(result.topTick),
      };
    } catch (error) {
      this.logger.error(`Failed to calculate tick range: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // FEE COLLECTION
  // ============================================================

  /**
   * Collects accrued fees from an LP position
   * Calls: XCMProxy.collectFees()
   */
  async collectFees(positionId: number): Promise<CollectedFees> {
    try {
      this.logger.log(`Collecting fees for position ${positionId}`);
      const tx = await this.contract.collectFees(positionId);
      const receipt = await tx.wait();

      // Parse the amounts from the transaction result
      // Note: collectFees returns (uint256 amount0, uint256 amount1)
      const iface = new ethers.Interface(XCMProxyABI);
      const result = iface.decodeFunctionResult('collectFees', receipt.logs[0]?.data || '0x');
      
      return {
        amount0: result.amount0 || 0n,
        amount1: result.amount1 || 0n,
      };
    } catch (error) {
      this.logger.error(`Failed to collect fees: ${error.message}`);
      throw error;
    }
  }

  /**
   * Executes full liquidation (remove all liquidity)
   * Calls: XCMProxy.executeFullLiquidation()
   */
  async executeFullLiquidation(positionId: number): Promise<CollectedFees> {
    try {
      this.logger.log(`Executing full liquidation for position ${positionId}`);
      const tx = await this.contract.executeFullLiquidation(positionId);
      const receipt = await tx.wait();

      // Parse PositionLiquidated event
      const event = receipt.logs.find(
        (log: any) => log.eventName === 'PositionLiquidated',
      );

      return {
        amount0: event?.args?.amount0 || 0n,
        amount1: event?.args?.amount1 || 0n,
      };
    } catch (error) {
      this.logger.error(`Failed to execute full liquidation: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // SWAP OPERATIONS
  // ============================================================

  /**
   * Gets a quote for a swap operation (simulation)
   * Calls: XCMProxy.quoteExactInputSingle()
   */
  async quoteSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    limitSqrtPrice: bigint = 0n,
  ): Promise<SwapQuote> {
    try {
      const amountOut = await this.contract.quoteExactInputSingle(
        tokenIn,
        tokenOut,
        amountIn,
        limitSqrtPrice,
      );
      return { amountOut };
    } catch (error) {
      this.logger.error(`Failed to get swap quote: ${error.message}`);
      throw error;
    }
  }

  /**
   * Executes a swap operation
   * Calls: XCMProxy.swapExactInputSingle()
   */
  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    recipient: string,
    amountIn: bigint,
    amountOutMinimum: bigint,
    limitSqrtPrice: bigint = 0n,
  ): Promise<SwapResult> {
    try {
      this.logger.log(`Executing swap: ${amountIn} ${tokenIn} -> ${tokenOut}`);
      const tx = await this.contract.swapExactInputSingle(
        tokenIn,
        tokenOut,
        recipient,
        amountIn,
        amountOutMinimum,
        limitSqrtPrice,
      );
      const receipt = await tx.wait();

      // Parse ProceedsSwapped event
      const event = receipt.logs.find(
        (log: any) => log.eventName === 'ProceedsSwapped',
      );

      return {
        amountOut: event?.args?.amountOut || 0n,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to execute swap: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // TOKEN MANAGEMENT
  // ============================================================

  /**
   * Gets the contract's balance of a token
   * Calls: XCMProxy.getBalance()
   */
  async getTokenBalance(token: string): Promise<bigint> {
    try {
      return await this.readOnlyContract.getBalance(token);
    } catch (error) {
      this.logger.error(`Failed to get token balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if a token is supported
   * Calls: XCMProxy.supportedTokens()
   */
  async isTokenSupported(token: string): Promise<boolean> {
    try {
      return await this.readOnlyContract.supportedTokens(token);
    } catch (error) {
      this.logger.error(`Failed to check token support: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // XCM CONFIGURATION (Read-only)
  // ============================================================

  /**
   * Gets the current XCM configuration
   */
  async getXcmConfig(): Promise<XcmConfig> {
    try {
      const [
        assetHubParaId,
        defaultDestWeight,
        defaultSlippageBps,
        trustedXcmCaller,
        xcmConfigFrozen,
        operator,
        paused,
        testMode,
      ] = await Promise.all([
        this.readOnlyContract.assetHubParaId(),
        this.readOnlyContract.defaultDestWeight(),
        this.readOnlyContract.defaultSlippageBps(),
        this.readOnlyContract.trustedXcmCaller(),
        this.readOnlyContract.xcmConfigFrozen(),
        this.readOnlyContract.operator(),
        this.readOnlyContract.paused(),
        this.readOnlyContract.testMode(),
      ]);

      return {
        assetHubParaId: Number(assetHubParaId),
        defaultDestWeight,
        defaultSlippageBps: Number(defaultSlippageBps),
        trustedXcmCaller,
        xcmConfigFrozen,
        operator,
        paused,
        testMode,
      };
    } catch (error) {
      this.logger.error(`Failed to get XCM config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets integration contract addresses
   */
  async getIntegrationAddresses(): Promise<{
    nfpm: string;
    quoter: string;
    swapRouter: string;
    xTokensPrecompile: string;
    xcmTransactorPrecompile: string;
  }> {
    try {
      const [nfpm, quoter, swapRouter, xTokens, xcmTransactor] = await Promise.all([
        this.readOnlyContract.nfpmContract(),
        this.readOnlyContract.quoterContract(),
        this.readOnlyContract.swapRouterContract(),
        this.readOnlyContract.xTokensPrecompile(),
        this.readOnlyContract.xcmTransactorPrecompile(),
      ]);

      return {
        nfpm,
        quoter,
        swapRouter,
        xTokensPrecompile: xTokens,
        xcmTransactorPrecompile: xcmTransactor,
      };
    } catch (error) {
      this.logger.error(`Failed to get integration addresses: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // ADMIN OPERATIONS (Operator/Owner only)
  // ============================================================

  /**
   * Adds a supported token (operator only)
   * Calls: XCMProxy.addSupportedToken()
   */
  async addSupportedToken(token: string): Promise<string> {
    try {
      this.logger.log(`Adding supported token: ${token}`);
      const tx = await this.contract.addSupportedToken(token);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to add supported token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a supported token (operator only)
   * Calls: XCMProxy.removeSupportedToken()
   */
  async removeSupportedToken(token: string): Promise<string> {
    try {
      this.logger.log(`Removing supported token: ${token}`);
      const tx = await this.contract.removeSupportedToken(token);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to remove supported token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets test mode (owner only)
   * Calls: XCMProxy.setTestMode()
   */
  async setTestMode(enabled: boolean): Promise<string> {
    try {
      this.logger.log(`Setting test mode: ${enabled}`);
      const tx = await this.contract.setTestMode(enabled);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to set test mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pauses the contract (owner only)
   * Calls: XCMProxy.pause()
   */
  async pause(): Promise<string> {
    try {
      this.logger.log('Pausing contract');
      const tx = await this.contract.pause();
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to pause contract: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unpauses the contract (owner only)
   * Calls: XCMProxy.unpause()
   */
  async unpause(): Promise<string> {
    try {
      this.logger.log('Unpausing contract');
      const tx = await this.contract.unpause();
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to unpause contract: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  /**
   * Sets up comprehensive event listeners for contract events
   */
  setupEventListeners(callbacks: MoonbeamEventCallbacks): void {
    if (!this.contract) {
      this.logger.warn('Contract not initialized, cannot setup event listeners');
      return;
    }

    // AssetsReceived event
    if (callbacks.onAssetsReceived) {
      this.contract.on('AssetsReceived', (token, user, amount, investmentParams, event) => {
        this.logger.log(`Event: AssetsReceived from ${user}`);
        callbacks.onAssetsReceived!({
          token,
          user,
          amount: amount.toString(),
          investmentParams,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // PendingPositionCreated event
    if (callbacks.onPendingPositionCreated) {
      this.contract.on('PendingPositionCreated', (assetHubPositionId, user, token, amount, poolId, event) => {
        this.logger.log(`Event: PendingPositionCreated ${assetHubPositionId}`);
        callbacks.onPendingPositionCreated!({
          assetHubPositionId,
          user,
          token,
          amount: amount.toString(),
          poolId,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // PositionExecuted event
    if (callbacks.onPositionExecuted) {
      this.contract.on('PositionExecuted', (assetHubPositionId, localPositionId, nfpmTokenId, liquidity, event) => {
        this.logger.log(`Event: PositionExecuted ${localPositionId}`);
        callbacks.onPositionExecuted!({
          assetHubPositionId,
          localPositionId: Number(localPositionId),
          nfpmTokenId: Number(nfpmTokenId),
          liquidity: liquidity.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // PositionLiquidated event
    if (callbacks.onPositionLiquidated) {
      this.contract.on('PositionLiquidated', (positionId, user, amount0, amount1, event) => {
        this.logger.log(`Event: PositionLiquidated ${positionId}`);
        callbacks.onPositionLiquidated!({
          positionId: Number(positionId),
          user,
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // LiquidationCompleted event
    if (callbacks.onLiquidationCompleted) {
      this.contract.on('LiquidationCompleted', (positionId, assetHubPositionId, user, baseAsset, totalReturned, event) => {
        this.logger.log(`Event: LiquidationCompleted ${positionId}`);
        callbacks.onLiquidationCompleted!({
          positionId: Number(positionId),
          assetHubPositionId,
          user,
          baseAsset,
          totalReturned: totalReturned.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // AssetsReturned event
    if (callbacks.onAssetsReturned) {
      this.contract.on('AssetsReturned', (token, user, destination, amount, positionId, event) => {
        this.logger.log(`Event: AssetsReturned for position ${positionId}`);
        callbacks.onAssetsReturned!({
          token,
          user,
          destination,
          amount: amount.toString(),
          positionId: Number(positionId),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    this.logger.log('Moonbeam event listeners setup complete');
  }

  /**
   * Removes all event listeners
   */
  removeAllListeners(): void {
    if (this.contract) {
      this.contract.removeAllListeners();
      this.logger.log('All Moonbeam event listeners removed');
    }
  }
}
