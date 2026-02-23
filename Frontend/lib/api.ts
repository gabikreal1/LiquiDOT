const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Dashboard
export interface DashboardData {
  user: {
    id: string;
    walletAddress: string;
    balanceDot: number;
    balanceUsd: number;
  };
  positions: Array<{
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
  }>;
  recentActivity: Array<{
    type: string;
    status: string;
    txHash: string | null;
    details: any;
    createdAt: string;
  }>;
  pools: Array<{
    id: string;
    name: string;
    apr: string;
    tvl: string;
    userAllocationUsd: number;
  }>;
  summary: {
    totalInvestedUsd: number;
    totalCurrentValueUsd: number;
    totalPnlUsd: number;
    totalPnlPercent: number;
    activePositionCount: number;
    pendingPositionCount: number;
  };
}

export function fetchDashboard(userId: string): Promise<DashboardData> {
  return fetchApi<DashboardData>(`/dashboard/${userId}`);
}

// Users
export interface UserData {
  id: string;
  walletAddress: string;
  isActive: boolean;
}

export function registerUser(walletAddress: string): Promise<UserData> {
  return fetchApi<UserData>('/users', {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
  });
}

// Pools
export interface PoolData {
  id: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  apr: string;
  tvl: string;
  volume24h: string;
  fee: number;
}

export function fetchPools(): Promise<PoolData[]> {
  return fetchApi<PoolData[]>('/pools');
}

// Health
export function fetchHealth(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>('/health');
}
