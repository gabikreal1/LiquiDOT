export interface DashboardUser {
  id: string;
  walletAddress: string;
  balanceDot: number;
  balanceUsd: number;
}

export interface DashboardPosition {
  id: string;
  poolName: string;
  status: string;
  amountDot: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  assetHubTxHash: string | null;
  moonbeamTxHash: string | null;
  createdAt: string;
  executedAt: string | null;
}

export interface DashboardActivity {
  type: string;
  status: string;
  txHash: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardPool {
  id: string;
  name: string;
  apr: string;
  tvl: string;
  userAllocationUsd: number;
}

export interface DashboardSummary {
  totalInvestedUsd: number;
  totalCurrentValueUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  activePositionCount: number;
  pendingPositionCount: number;
}

export interface DashboardData {
  user: DashboardUser;
  positions: DashboardPosition[];
  recentActivity: DashboardActivity[];
  pools: DashboardPool[];
  summary: DashboardSummary;
}
