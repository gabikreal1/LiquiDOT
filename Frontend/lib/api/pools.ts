import type { PoolData, PoolsResponse } from "@/lib/types/pool";
import { apiGet } from "./client";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  Confirm query param names match your API:           │
 * │  GET /api/pools?limit=&offset=&sort=&order=          │
 * │       &minTvl=&minApr=&token=&chain=&dex=            │
 * │  GET /api/pools/top?limit=5                          │
 * │  GET /api/pools/search?token={symbol}                │
 * └──────────────────────────────────────────────────────┘
 */

export interface GetPoolsParams {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
  minTvl?: number;
  minApr?: number;
  token?: string;
  chain?: string;
  dex?: string;
}

export async function getPools(
  params?: GetPoolsParams
): Promise<PoolsResponse> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPools } = await import("@/lib/mock/pools");
    let filtered = [...mockPools];

    // Apply filters
    if (params?.token) {
      const q = params.token.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.token0Symbol.toLowerCase().includes(q) ||
          p.token1Symbol.toLowerCase().includes(q)
      );
    }
    if (params?.minTvl) {
      filtered = filtered.filter(
        (p) => parseFloat(p.tvl) >= params.minTvl!
      );
    }
    if (params?.minApr) {
      filtered = filtered.filter(
        (p) => parseFloat(p.apr) >= params.minApr!
      );
    }
    if (params?.chain) {
      filtered = filtered.filter((p) => p.chain === params.chain);
    }
    if (params?.dex) {
      filtered = filtered.filter((p) => p.dex === params.dex);
    }

    // Apply sorting
    const sortKey = params?.sort ?? "apr";
    const sortOrder = params?.order ?? "desc";
    filtered.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case "apr":
          aVal = parseFloat(a.apr);
          bVal = parseFloat(b.apr);
          break;
        case "tvl":
          aVal = parseFloat(a.tvl);
          bVal = parseFloat(b.tvl);
          break;
        case "volume24h":
          aVal = parseFloat(a.volume24h);
          bVal = parseFloat(b.volume24h);
          break;
        case "fee":
          aVal = a.fee;
          bVal = b.fee;
          break;
        case "pool":
          return sortOrder === "asc"
            ? `${a.token0Symbol}/${a.token1Symbol}`.localeCompare(
                `${b.token0Symbol}/${b.token1Symbol}`
              )
            : `${b.token0Symbol}/${b.token1Symbol}`.localeCompare(
                `${a.token0Symbol}/${a.token1Symbol}`
              );
        case "chain":
          return sortOrder === "asc"
            ? a.chain.localeCompare(b.chain)
            : b.chain.localeCompare(a.chain);
        default:
          aVal = parseFloat(a.apr);
          bVal = parseFloat(b.apr);
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    const total = filtered.length;
    const limit = params?.limit ?? 10;
    const offset = params?.offset ?? 0;
    const paged = filtered.slice(offset, offset + limit);

    return { pools: paged, total, limit, offset };
  }

  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.minTvl) searchParams.set("minTvl", String(params.minTvl));
  if (params?.minApr) searchParams.set("minApr", String(params.minApr));
  if (params?.token) searchParams.set("token", params.token);
  if (params?.chain) searchParams.set("chain", params.chain);
  if (params?.dex) searchParams.set("dex", params.dex);

  const qs = searchParams.toString();
  return apiGet<PoolsResponse>(`/api/pools${qs ? `?${qs}` : ""}`);
}

export async function getTopPools(limit = 5): Promise<PoolData[]> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPools } = await import("@/lib/mock/pools");
    return [...mockPools]
      .sort((a, b) => parseFloat(b.apr) - parseFloat(a.apr))
      .slice(0, limit);
  }
  return apiGet<PoolData[]>(`/api/pools/top?limit=${limit}`);
}

export async function searchPools(token: string): Promise<PoolData[]> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPools } = await import("@/lib/mock/pools");
    return mockPools.filter(
      (p) =>
        p.token0Symbol.toLowerCase().includes(token.toLowerCase()) ||
        p.token1Symbol.toLowerCase().includes(token.toLowerCase())
    );
  }
  return apiGet<PoolData[]>(
    `/api/pools/search?token=${encodeURIComponent(token)}`
  );
}
