export interface PositionDetail {
  id: string;
  userId: string;
  poolId: string;
  poolName: string;
  status: string;
  chainId: number;
  amount: string; // wei
  amountDot: number;
  entryPrice: string; // wei
  lowerRangePercent: number;
  upperRangePercent: number;
  lowerTick: number;
  upperTick: number;
  entryPriceUsd: number;
  currentPrice: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  dexName: string;
  assetHubTxHash: string | null;
  moonbeamTxHash: string | null;
  assetHubPositionId: string | null;
  moonbeamPositionId: number | null;
  createdAt: string;
  executedAt: string | null;
  liquidatedAt: string | null;
}

export interface PositionPnL {
  positionId: string;
  entryAmountUsd: number;
  currentValueUsd: number;
  feesEarnedUsd: number;
  ilLossUsd: number;
  netPnLUsd: number;
  netPnLPercent: number;
}
