import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { AssetHubVaultABI } from '../abis/AssetHubVault.abi';
import { XcmBuilderService, XcmInvestmentParams } from './xcm-builder.service';

// ============================================================
// INTERFACES
// ============================================================

/**
 * Position status enum matching contract
 */
export enum PositionStatus {
  PENDING = 0,
  ACTIVE = 1,
  LIQUIDATED = 2,
}

/**
 * Parameters for dispatching an investment (public interface)
 * Note: destination and xcmMessage are built internally by XcmBuilderService
 */
export interface DispatchInvestmentRequest {
  /** User wallet address */
  user: string;
  /** Target chain ID (e.g., 2004 for Moonbeam) */
  chainId: number;
  /** Pool address on target chain */
  poolId: string;
  /** Base asset address to invest */
  baseAsset: string;
  /** Amount to invest */
  amount: bigint;
  /** Lower range percentage for LP position */
  lowerRangePercent: number;
  /** Upper range percentage for LP position */
  upperRangePercent: number;
}

/**
 * Full parameters including XCM bytes (internal use)
 */
export interface DispatchInvestmentParams extends DispatchInvestmentRequest {
  destination: Uint8Array;
  preBuiltXcmMessage: Uint8Array;
}

/**
 * Position data from contract
 */
export interface ContractPosition {
  user: string;
  poolId: string;
  baseAsset: string;
  chainId: number;
  lowerRangePercent: number;
  upperRangePercent: number;
  timestamp: bigint;
  status: PositionStatus;
  amount: bigint;
  remotePositionId: string;
}

/**
 * Contract position with its AssetHubVault storage key (bytes32).
 *
 * Note: existing methods return positions without ids (since the contract view methods
 * return Position structs only). For DB syncing we need the ids, so we fetch ids and then
 * hydrate each Position via getPosition().
 */
export interface ContractPositionWithId extends ContractPosition {
  positionId: string;
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  supported: boolean;
  xcmDestination: string;
  chainName: string;
  timestamp: bigint;
}

/**
 * User position statistics
 */
export interface UserPositionStats {
  total: number;
  pending: number;
  active: number;
  liquidated: number;
}

/**
 * Event callback interfaces for AssetHub contract events
 */
export interface AssetHubEventCallbacks {
  onDeposit?: (event: {
    user: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onWithdrawal?: (event: {
    user: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onInvestmentInitiated?: (event: {
    positionId: string;
    user: string;
    chainId: number;
    poolId: string;
    amount: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onExecutionConfirmed?: (event: {
    positionId: string;
    chainId: number;
    remotePositionId: string;
    liquidity: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onPositionLiquidated?: (event: {
    positionId: string;
    user: string;
    finalAmount: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onLiquidationSettled?: (event: {
    positionId: string;
    user: string;
    receivedAmount: string;
    expectedAmount: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onChainAdded?: (event: {
    chainId: number;
    xcmDestination: string;
    executor: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
  onXcmMessageSent?: (event: {
    messageHash: string;
    destination: string;
    message: string;
    blockNumber: number;
    transactionHash: string;
  }) => void;
}

/**
 * AssetHubService - Manages all interactions with AssetHubVault contract
 * 
 * This service handles:
 * - User deposits and withdrawals
 * - Investment dispatching via XCM to Moonbeam
 * - Position tracking and status management
 * - Liquidation settlement
 * - Chain configuration management
 * 
 * @see AssetHubVault.sol for contract implementation
 */
@Injectable()
export class AssetHubService implements OnModuleInit {
  private readonly logger = new Logger(AssetHubService.name);
  private contract: ethers.Contract;
  private readOnlyContract: ethers.Contract;
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  private readonly xcmProxyAddress: string;

  constructor(
    private configService: ConfigService,
    private xcmBuilderService: XcmBuilderService,
  ) {
    this.xcmProxyAddress = this.configService.get<string>('XCM_PROXY_ADDRESS', '');
  }

  /**
   * Initialize contract connections on module startup
   */
  async onModuleInit() {
    await this.initializeContract();
  }

  private async initializeContract() {
    const rpcUrl = this.configService.get<string>('ASSETHUB_RPC_URL');
    const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
    const contractAddress = this.configService.get<string>('ASSETHUB_VAULT_ADDRESS');

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn('Missing required environment variables for AssetHub - service will be limited');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Write contract with wallet
    this.contract = new ethers.Contract(
      contractAddress,
      AssetHubVaultABI,
      this.wallet,
    );

    // Read-only contract for view functions
    this.readOnlyContract = new ethers.Contract(
      contractAddress,
      AssetHubVaultABI,
      this.provider,
    );

    this.logger.log(`AssetHub Vault initialized at ${contractAddress}`);
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
   * Dispatches an investment to Moonbeam via XCM
   * This version automatically builds the XCM message using XcmBuilderService
   * 
   * @param params Investment request parameters
   * @returns Position ID from the contract event
   */
  async dispatchInvestmentWithXcm(params: DispatchInvestmentRequest): Promise<string> {
    try {
      this.logger.log(
        `Preparing investment dispatch for user ${params.user} to pool ${params.poolId}`,
      );

      // Build XCM message using XcmBuilderService
      const xcmParams: XcmInvestmentParams = {
        amount: params.amount,
        moonbeamProxyAddress: this.xcmProxyAddress,
        assetHubVaultAddress: this.contract.target as string,
        user: params.user,
        poolId: params.poolId,
        chainId: params.chainId,
        lowerRangePercent: params.lowerRangePercent,
        upperRangePercent: params.upperRangePercent,
      };

      // Optional: Dry run to verify XCM will succeed
      const dryRunResult = await this.xcmBuilderService.dryRunXcm(xcmParams);
      if (!dryRunResult.success) {
        throw new Error(`XCM dry run failed: ${dryRunResult.error}`);
      }
      this.logger.log(`XCM dry run passed, estimated fees: ${dryRunResult.estimatedFees}`);

      // Build the actual XCM message
      const { destination, xcmMessage } = await this.xcmBuilderService.buildInvestmentXcm(xcmParams);

      // Call the contract with built XCM
      return this.dispatchInvestment({
        ...params,
        destination,
        preBuiltXcmMessage: xcmMessage,
      });
    } catch (error) {
      this.logger.error(`Failed to dispatch investment with XCM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Dispatches an investment to Moonbeam via XCM
   * Calls: AssetHubVault.dispatchInvestment()
   */
  async dispatchInvestment(params: DispatchInvestmentParams): Promise<string> {
    try {
      this.logger.log(
        `Dispatching investment for user ${params.user} to pool ${params.poolId}`,
      );

      const tx = await this.contract.dispatchInvestment(
        params.user,
        params.chainId,
        params.poolId,
        params.baseAsset,
        params.amount,
        params.lowerRangePercent,
        params.upperRangePercent,
        params.destination,
        params.preBuiltXcmMessage,
      );

      const receipt = await tx.wait();
      this.logger.log(`Investment dispatched. Tx: ${receipt.hash}`);

      // Extract positionId from InvestmentInitiated event
      const event = receipt.logs.find(
        (log: any) => log.eventName === 'InvestmentInitiated',
      );
      if (!event) {
        throw new Error('InvestmentInitiated event not found');
      }

      const positionId = event.args.positionId;
      return positionId;
    } catch (error) {
      this.logger.error(`Failed to dispatch investment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirms position execution from Moonbeam
   * Called by XCM relayer when position is created on Moonbeam
   * Calls: AssetHubVault.confirmExecution()
   */
  async confirmExecution(
    positionId: string,
    remotePositionId: string,
    liquidity: bigint,
  ): Promise<void> {
    try {
      this.logger.log(`Confirming execution for position ${positionId}`);

      const tx = await this.contract.confirmExecution(
        positionId,
        remotePositionId,
        liquidity,
      );

      await tx.wait();
      this.logger.log(`Position ${positionId} confirmed as ACTIVE`);
    } catch (error) {
      this.logger.error(`Failed to confirm execution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Settles liquidation by transferring assets back to user
   * Called after receiving assets from Moonbeam
   * Calls: AssetHubVault.settleLiquidation()
   */
  async settleLiquidation(
    positionId: string,
    receivedAmount: bigint,
  ): Promise<void> {
    try {
      this.logger.log(`Settling liquidation for position ${positionId}`);

      const tx = await this.contract.settleLiquidation(
        positionId,
        receivedAmount,
      );

      await tx.wait();
      this.logger.log(
        `Position ${positionId} liquidated with ${receivedAmount} returned`,
      );
    } catch (error) {
      this.logger.error(`Failed to settle liquidation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets user positions from contract storage
   * Calls: AssetHubVault.getUserPositionsPage()
   */
  async getUserPositions(
    userAddress: string,
    start = 0,
    count = 100,
  ): Promise<ContractPosition[]> {
    try {
      const positions = await this.contract.getUserPositionsPage(
        userAddress,
        start,
        count,
      );
      return positions.map((p: any) => ({
        user: p.user,
        poolId: p.poolId,
        baseAsset: p.baseAsset,
        chainId: Number(p.chainId),
        lowerRangePercent: Number(p.lowerRangePercent),
        upperRangePercent: Number(p.upperRangePercent),
        timestamp: p.timestamp,
        status: Number(p.status),
        amount: p.amount,
        remotePositionId: p.remotePositionId,
      }));
    } catch (error) {
      this.logger.error(`Failed to get user positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets user position statistics
   * Calls: AssetHubVault.getUserPositionStats()
   */
  async getUserPositionStats(userAddress: string): Promise<UserPositionStats> {
    try {
      const stats = await this.readOnlyContract.getUserPositionStats(userAddress);
      return {
        total: Number(stats.total),
        pending: Number(stats.pending),
        active: Number(stats.active),
        liquidated: Number(stats.liquidated),
      };
    } catch (error) {
      this.logger.error(`Failed to get user stats: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // DEPOSIT & WITHDRAWAL
  // ============================================================

  /**
   * Deposits native tokens to the vault
   * Calls: AssetHubVault.deposit()
   */
  async deposit(amount: bigint): Promise<string> {
    try {
      this.logger.log(`Depositing ${amount} to vault`);
      const tx = await this.contract.deposit({ value: amount });
      const receipt = await tx.wait();
      this.logger.log(`Deposit successful. Tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to deposit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Withdraws tokens from the vault
   * Calls: AssetHubVault.withdraw()
   */
  async withdraw(amount: bigint): Promise<string> {
    try {
      this.logger.log(`Withdrawing ${amount} from vault`);
      const tx = await this.contract.withdraw(amount);
      const receipt = await tx.wait();
      this.logger.log(`Withdrawal successful. Tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to withdraw: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets user balance in the vault
   * Calls: AssetHubVault.getUserBalance()
   */
  async getUserBalance(userAddress: string): Promise<bigint> {
    try {
      return await this.readOnlyContract.getUserBalance(userAddress);
    } catch (error) {
      this.logger.error(`Failed to get user balance: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // POSITION QUERIES
  // ============================================================

  /**
   * Gets a specific position by ID
   * Calls: AssetHubVault.getPosition()
   */
  async getPosition(positionId: string): Promise<ContractPosition | null> {
    try {
      const p = await this.readOnlyContract.getPosition(positionId);
      if (p.user === ethers.ZeroAddress) {
        return null;
      }
      return this.mapPosition(p);
    } catch (error) {
      this.logger.error(`Failed to get position ${positionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets all positions for a user
   * Calls: AssetHubVault.getUserPositions()
   */
  async getAllUserPositions(userAddress: string): Promise<ContractPosition[]> {
    try {
      const positions = await this.readOnlyContract.getUserPositions(userAddress);
      return positions.map((p: any) => this.mapPosition(p));
    } catch (error) {
      this.logger.error(`Failed to get all user positions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets positions filtered by status
   * Calls: AssetHubVault.getUserPositionsByStatus()
   */
  async getUserPositionsByStatus(
    userAddress: string,
    status: PositionStatus,
    maxResults: number = 100,
  ): Promise<ContractPosition[]> {
    try {
      const positions = await this.readOnlyContract.getUserPositionsByStatus(
        userAddress,
        status,
        maxResults,
      );
      return positions.map((p: any) => this.mapPosition(p));
    } catch (error) {
      this.logger.error(`Failed to get positions by status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets user position IDs (paginated)
   * Calls: AssetHubVault.getUserPositionIds()
   */
  async getUserPositionIds(
    userAddress: string,
    start: number = 0,
    count: number = 100,
  ): Promise<string[]> {
    try {
      return await this.readOnlyContract.getUserPositionIds(userAddress, start, count);
    } catch (error) {
      this.logger.error(`Failed to get user position IDs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch all user position IDs by paging getUserPositionIds().
   */
  async getAllUserPositionIds(userAddress: string, pageSize = 100): Promise<string[]> {
    const ids: string[] = [];
    let start = 0;
    while (true) {
      const page = await this.getUserPositionIds(userAddress, start, pageSize);
      if (page.length === 0) break;
      ids.push(...page);
      start += page.length;
      if (page.length < pageSize) break;
    }
    return ids;
  }

  /**
   * Fetch user positions along with their AssetHub position IDs.
   *
   * Implementation note: the contract returns Position structs without IDs, so we fetch IDs
   * then hydrate each position via getPosition(id).
   */
  async getUserPositionsWithIds(userAddress: string, maxResults = 200): Promise<ContractPositionWithId[]> {
    const ids = await this.getAllUserPositionIds(userAddress, Math.min(100, maxResults));
    const limited = ids.slice(0, maxResults);

    const out: ContractPositionWithId[] = [];
    for (const id of limited) {
      const p = await this.getPosition(id);
      if (!p) continue;
      out.push({ positionId: id, ...p });
    }

    // deterministic sort
    out.sort((a, b) => a.positionId.localeCompare(b.positionId));
    return out;
  }

  /**
   * Gets the count of user positions
   * Calls: AssetHubVault.getUserPositionCount()
   */
  async getUserPositionCount(userAddress: string): Promise<number> {
    try {
      const count = await this.readOnlyContract.getUserPositionCount(userAddress);
      return Number(count);
    } catch (error) {
      this.logger.error(`Failed to get user position count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if a position is active
   * Calls: AssetHubVault.isPositionActive()
   */
  async isPositionActive(userAddress: string, positionId: string): Promise<boolean> {
    try {
      return await this.readOnlyContract.isPositionActive(userAddress, positionId);
    } catch (error) {
      this.logger.error(`Failed to check if position is active: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // CHAIN CONFIGURATION
  // ============================================================

  /**
   * Checks if a chain is supported
   * Calls: AssetHubVault.isChainSupported()
   */
  async isChainSupported(chainId: number): Promise<boolean> {
    try {
      return await this.readOnlyContract.isChainSupported(chainId);
    } catch (error) {
      this.logger.error(`Failed to check chain support: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets chain configuration
   * Calls: AssetHubVault.getChainConfig()
   */
  async getChainConfig(chainId: number): Promise<ChainConfig> {
    try {
      const config = await this.readOnlyContract.getChainConfig(chainId);
      return {
        supported: config.supported,
        xcmDestination: config.xcmDestination,
        chainName: config.chainName,
        timestamp: config.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get chain config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets chain executor address
   * Calls: AssetHubVault.chainExecutors()
   */
  async getChainExecutor(chainId: number): Promise<string> {
    try {
      return await this.readOnlyContract.chainExecutors(chainId);
    } catch (error) {
      this.logger.error(`Failed to get chain executor: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // CONTRACT STATE QUERIES
  // ============================================================

  /**
   * Gets contract paused state
   * Calls: AssetHubVault.paused()
   */
  async isPaused(): Promise<boolean> {
    try {
      return await this.readOnlyContract.paused();
    } catch (error) {
      this.logger.error(`Failed to get paused state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets contract test mode state
   * Calls: AssetHubVault.testMode()
   */
  async isTestMode(): Promise<boolean> {
    try {
      return await this.readOnlyContract.testMode();
    } catch (error) {
      this.logger.error(`Failed to get test mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets contract admin address
   * Calls: AssetHubVault.admin()
   */
  async getAdmin(): Promise<string> {
    try {
      return await this.readOnlyContract.admin();
    } catch (error) {
      this.logger.error(`Failed to get admin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets contract operator address
   * Calls: AssetHubVault.operator()
   */
  async getOperator(): Promise<string> {
    try {
      return await this.readOnlyContract.operator();
    } catch (error) {
      this.logger.error(`Failed to get operator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets emergency address
   * Calls: AssetHubVault.emergency()
   */
  async getEmergency(): Promise<string> {
    try {
      return await this.readOnlyContract.emergency();
    } catch (error) {
      this.logger.error(`Failed to get emergency: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets XCM precompile address
   * Calls: AssetHubVault.XCM_PRECOMPILE()
   */
  async getXcmPrecompile(): Promise<string> {
    try {
      return await this.readOnlyContract.XCM_PRECOMPILE();
    } catch (error) {
      this.logger.error(`Failed to get XCM precompile: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // ADMIN OPERATIONS (Admin/Operator only)
  // ============================================================

  /**
   * Adds a new supported chain (admin only)
   * Calls: AssetHubVault.addChain()
   */
  async addChain(
    chainId: number,
    xcmDestination: Uint8Array,
    chainName: string,
    executor: string,
  ): Promise<string> {
    try {
      this.logger.log(`Adding chain ${chainId}: ${chainName}`);
      const tx = await this.contract.addChain(chainId, xcmDestination, chainName, executor);
      const receipt = await tx.wait();
      this.logger.log(`Chain ${chainId} added. Tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to add chain: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a supported chain (admin only)
   * Calls: AssetHubVault.removeChain()
   */
  async removeChain(chainId: number): Promise<string> {
    try {
      this.logger.log(`Removing chain ${chainId}`);
      const tx = await this.contract.removeChain(chainId);
      const receipt = await tx.wait();
      this.logger.log(`Chain ${chainId} removed. Tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to remove chain: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates chain executor (admin only)
   * Calls: AssetHubVault.updateChainExecutor()
   */
  async updateChainExecutor(chainId: number, executor: string): Promise<string> {
    try {
      this.logger.log(`Updating executor for chain ${chainId}`);
      const tx = await this.contract.updateChainExecutor(chainId, executor);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to update chain executor: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets operator address (admin only)
   * Calls: AssetHubVault.setOperator()
   */
  async setOperator(operator: string): Promise<string> {
    try {
      this.logger.log(`Setting operator to ${operator}`);
      const tx = await this.contract.setOperator(operator);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to set operator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets emergency address (admin only)
   * Calls: AssetHubVault.setEmergency()
   */
  async setEmergency(emergency: string): Promise<string> {
    try {
      this.logger.log(`Setting emergency to ${emergency}`);
      const tx = await this.contract.setEmergency(emergency);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to set emergency: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets test mode (admin only)
   * Calls: AssetHubVault.setTestMode()
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
   * Pauses the contract (admin only)
   * Calls: AssetHubVault.pause()
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
   * Unpauses the contract (admin only)
   * Calls: AssetHubVault.unpause()
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

  /**
   * Emergency liquidates a position (emergency only)
   * Calls: AssetHubVault.emergencyLiquidatePosition()
   */
  async emergencyLiquidatePosition(
    chainId: number,
    positionId: string,
    value: bigint = 0n,
  ): Promise<string> {
    try {
      this.logger.log(`Emergency liquidating position ${positionId} on chain ${chainId}`);
      const tx = await this.contract.emergencyLiquidatePosition(chainId, positionId, { value });
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to emergency liquidate: ${error.message}`);
      throw error;
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  /**
   * Sets up comprehensive event listeners for contract events
   */
  setupEventListeners(callbacks: AssetHubEventCallbacks): void {
    if (!this.contract) {
      this.logger.warn('Contract not initialized, cannot setup event listeners');
      return;
    }

    // Deposit event
    if (callbacks.onDeposit) {
      this.contract.on('Deposit', (user, amount, event) => {
        this.logger.log(`Event: Deposit from ${user}`);
        callbacks.onDeposit!({
          user,
          amount: amount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // Withdrawal event
    if (callbacks.onWithdrawal) {
      this.contract.on('Withdrawal', (user, amount, event) => {
        this.logger.log(`Event: Withdrawal from ${user}`);
        callbacks.onWithdrawal!({
          user,
          amount: amount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // InvestmentInitiated event
    if (callbacks.onInvestmentInitiated) {
      this.contract.on('InvestmentInitiated', (positionId, user, chainId, poolId, amount, event) => {
        this.logger.log(`Event: InvestmentInitiated ${positionId}`);
        callbacks.onInvestmentInitiated!({
          positionId,
          user,
          chainId: Number(chainId),
          poolId,
          amount: amount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // PositionExecutionConfirmed event
    if (callbacks.onExecutionConfirmed) {
      this.contract.on('PositionExecutionConfirmed', (positionId, chainId, remotePositionId, liquidity, event) => {
        this.logger.log(`Event: PositionExecutionConfirmed ${positionId}`);
        callbacks.onExecutionConfirmed!({
          positionId,
          chainId: Number(chainId),
          remotePositionId,
          liquidity: liquidity.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // PositionLiquidated event
    if (callbacks.onPositionLiquidated) {
      this.contract.on('PositionLiquidated', (positionId, user, finalAmount, event) => {
        this.logger.log(`Event: PositionLiquidated ${positionId}`);
        callbacks.onPositionLiquidated!({
          positionId,
          user,
          finalAmount: finalAmount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // LiquidationSettled event
    if (callbacks.onLiquidationSettled) {
      this.contract.on('LiquidationSettled', (positionId, user, receivedAmount, expectedAmount, event) => {
        this.logger.log(`Event: LiquidationSettled ${positionId}`);
        callbacks.onLiquidationSettled!({
          positionId,
          user,
          receivedAmount: receivedAmount.toString(),
          expectedAmount: expectedAmount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // ChainAdded event
    if (callbacks.onChainAdded) {
      this.contract.on('ChainAdded', (chainId, xcmDestination, executor, event) => {
        this.logger.log(`Event: ChainAdded ${chainId}`);
        callbacks.onChainAdded!({
          chainId: Number(chainId),
          xcmDestination,
          executor,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    // XCMMessageSent event
    if (callbacks.onXcmMessageSent) {
      this.contract.on('XCMMessageSent', (messageHash, destination, message, event) => {
        this.logger.log(`Event: XCMMessageSent ${messageHash}`);
        callbacks.onXcmMessageSent!({
          messageHash,
          destination,
          message,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        });
      });
    }

    this.logger.log('AssetHub event listeners setup complete');
  }

  /**
   * Removes all event listeners
   */
  removeAllListeners(): void {
    if (this.contract) {
      this.contract.removeAllListeners();
      this.logger.log('All AssetHub event listeners removed');
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Maps raw contract position data to ContractPosition interface
   */
  private mapPosition(p: any): ContractPosition {
    return {
      user: p.user,
      poolId: p.poolId,
      baseAsset: p.baseAsset,
      chainId: Number(p.chainId),
      lowerRangePercent: Number(p.lowerRangePercent),
      upperRangePercent: Number(p.upperRangePercent),
      timestamp: p.timestamp,
      status: Number(p.status) as PositionStatus,
      amount: p.amount,
      remotePositionId: p.remotePositionId,
    };
  }
}
