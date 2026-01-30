/**
 * Stop-Loss Service Types
 */

/**
 * Position status for stop-loss monitoring
 */
export enum MonitoredPositionStatus {
  ACTIVE = 'ACTIVE',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  LIQUIDATING = 'LIQUIDATING',  // DB lock to prevent double-liquidation
  LIQUIDATED = 'LIQUIDATED',
  FAILED = 'FAILED',
}

/**
 * Position monitor result
 */
export interface PositionCheckResult {
  positionId: string;
  poolId: string;
  userId: string;
  status: MonitoredPositionStatus;
  currentPrice: string;
  lowerBoundPrice: string;
  upperBoundPrice: string;
  isOutOfRange: boolean;
  isAtUpperBound: boolean;  // Take-profit trigger
  isAtLowerBound: boolean;  // Stop-loss trigger
  checkedAt: Date;
}

/**
 * Liquidation execution result
 */
export interface LiquidationResult {
  success: boolean;
  positionId: string;
  transactionHash?: string;
  returnedAmount?: string;
  error?: string;
  executedAt: Date;
}

/**
 * Stop-loss configuration
 */
export interface StopLossConfig {
  checkIntervalMs: number;
  batchSize: number;
  slippageBps: number;
  maxRetries: number;
  alertOnFailure: boolean;
}
