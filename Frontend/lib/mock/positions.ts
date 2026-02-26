import type { PositionDetail, PositionPnL } from "@/lib/types/position";

export const mockPosition: PositionDetail = {
  id: "pos-001",
  userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  poolId: "pool-001",
  poolName: "xcDOT/WGLMR",
  status: "ACTIVE",
  chainId: 1284,
  amount: "500000000000",
  amountDot: 50.0,
  entryPrice: "75000000000",
  lowerRangePercent: -5,
  upperRangePercent: 10,
  lowerTick: -1234,
  upperTick: 5678,
  entryPriceUsd: 7.5,
  currentPrice: 7.89,
  currentValueUsd: 375.0,
  pnlUsd: 25.0,
  pnlPercent: 7.14,
  dexName: "Algebra",
  assetHubTxHash:
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  moonbeamTxHash:
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  assetHubPositionId:
    "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
  moonbeamPositionId: 42,
  createdAt: "2026-02-01T12:00:00Z",
  executedAt: "2026-02-01T12:05:00Z",
  liquidatedAt: null,
};

export const mockPositionPnl: PositionPnL = {
  positionId: "pos-001",
  entryAmountUsd: 350.0,
  currentValueUsd: 375.0,
  feesEarnedUsd: 12.5,
  ilLossUsd: -2.0,
  netPnLUsd: 25.0,
  netPnLPercent: 7.14,
};
