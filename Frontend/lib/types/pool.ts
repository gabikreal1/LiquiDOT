export interface PoolData {
  id: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  apr: string;
  tvl: string;
  volume24h: string;
  fee: number;
  chain: "asset-hub" | "moonbeam";
  dex: "algebra" | "stellaswap";
}

export interface PoolsResponse {
  pools: PoolData[];
  total: number;
  limit: number;
  offset: number;
}
