import type { PositionDetail, PositionPnL } from "@/lib/types/position";
import { apiGet } from "./client";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  Confirm response shape matches PositionDetail and   │
 * │  PositionPnL types in lib/types/position.ts.         │
 * │  Endpoints:                                          │
 * │    GET /api/positions/{id}                           │
 * │    GET /api/positions/{id}/pnl                       │
 * └──────────────────────────────────────────────────────┘
 */

export async function getPosition(id: string): Promise<PositionDetail> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPosition } = await import("@/lib/mock/positions");
    return mockPosition;
  }
  return apiGet<PositionDetail>(`/api/positions/${id}`);
}

export async function getPositionPnl(id: string): Promise<PositionPnL> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPositionPnl } = await import("@/lib/mock/positions");
    return mockPositionPnl;
  }
  return apiGet<PositionPnL>(`/api/positions/${id}/pnl`);
}
