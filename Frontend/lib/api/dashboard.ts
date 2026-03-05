import type { DashboardData } from "@/lib/types/dashboard";
import { apiGet } from "./client";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  userId currently comes from mock auth store.        │
 * │  Replace with real userId from auth context          │
 * │  (JWT / session) once wallet login is integrated.    │
 * │  Endpoint: GET /api/dashboard/{userId}               │
 * └──────────────────────────────────────────────────────┘
 */

export async function getDashboard(userId: string): Promise<DashboardData> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockDashboardData } = await import("@/lib/mock/dashboard");
    return mockDashboardData;
  }
  return apiGet<DashboardData>(`/api/dashboard/${userId}`);
}
