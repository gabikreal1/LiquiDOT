/**
 * Blockchain Module Types
 * 
 * This file exports all shared types and interfaces for the blockchain module.
 * Import from '@/modules/blockchain/types' for clean access.
 */

// Re-export types from services
export {
  // AssetHub types
  PositionStatus,
  DispatchInvestmentRequest,
  DispatchInvestmentParams,
  ContractPosition,
  ChainConfig,
  UserPositionStats,
  AssetHubEventCallbacks,
} from '../services/asset-hub.service';

export {
  // Moonbeam types
  LiquidateParams,
  PendingPosition,
  MoonbeamPosition,
  RangeCheckResult,
  TickRange,
  CollectedFees,
  SwapQuote,
  SwapResult,
  XcmConfig,
  MoonbeamEventCallbacks,
} from '../services/moonbeam.service';

export {
  // XCM Builder types
  XcmInvestmentParams,
  XcmDryRunResult,
  XcmReturnParams,
} from '../services/xcm-builder.service';

// ============================================================
// COMMON TYPES
// ============================================================

/**
 * Transaction result with hash and optional receipt data
 */
export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: bigint;
  status: 'success' | 'failed';
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  start?: number;
  count?: number;
}

/**
 * Common event metadata
 */
export interface EventMetadata {
  blockNumber: number;
  transactionHash: string;
  logIndex?: number;
  timestamp?: number;
}

/**
 * Chain identifiers used in the system
 */
export enum ChainId {
  ASSET_HUB = 1000,
  MOONBEAM = 2004,
  MOONRIVER = 2023,
  POLKADOT = 0,
}

/**
 * Supported DEX protocols
 */
export enum DexProtocol {
  STELLASWAP = 'stellaswap',
  ZENLINK = 'zenlink',
  BEAMSWAP = 'beamswap',
}

/**
 * Investment status across the entire flow
 */
export enum InvestmentFlowStatus {
  /** Investment initiated, waiting for XCM transfer */
  INITIATED = 'initiated',
  /** Assets received on destination chain */
  ASSETS_RECEIVED = 'assets_received',
  /** LP position created on DEX */
  POSITION_CREATED = 'position_created',
  /** Position is active and earning fees */
  ACTIVE = 'active',
  /** Position is out of range, pending liquidation */
  OUT_OF_RANGE = 'out_of_range',
  /** Liquidation in progress */
  LIQUIDATING = 'liquidating',
  /** Assets returned via XCM */
  ASSETS_RETURNED = 'assets_returned',
  /** Fully settled and complete */
  SETTLED = 'settled',
  /** Error occurred during processing */
  ERROR = 'error',
}

/**
 * XCM message status
 */
export enum XcmMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  EXECUTED = 'executed',
  FAILED = 'failed',
}

/**
 * Error codes for blockchain operations
 */
export enum BlockchainErrorCode {
  // Connection errors
  RPC_CONNECTION_FAILED = 'RPC_CONNECTION_FAILED',
  WALLET_NOT_CONFIGURED = 'WALLET_NOT_CONFIGURED',
  
  // Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  NONCE_TOO_LOW = 'NONCE_TOO_LOW',
  
  // Contract errors
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // Position errors
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  POSITION_NOT_ACTIVE = 'POSITION_NOT_ACTIVE',
  POSITION_ALREADY_LIQUIDATED = 'POSITION_ALREADY_LIQUIDATED',
  
  // XCM errors
  XCM_BUILD_FAILED = 'XCM_BUILD_FAILED',
  XCM_DRY_RUN_FAILED = 'XCM_DRY_RUN_FAILED',
  XCM_SEND_FAILED = 'XCM_SEND_FAILED',
  
  // Authorization errors
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  CONTRACT_PAUSED = 'CONTRACT_PAUSED',
}

/**
 * Custom error class for blockchain operations
 */
export class BlockchainError extends Error {
  constructor(
    public readonly code: BlockchainErrorCode,
    message: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'BlockchainError';
  }
}
