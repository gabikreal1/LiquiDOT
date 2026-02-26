import type { Activity } from "@/lib/types/activity";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  Activity endpoint not in original design doc.       │
 * │  Suggested: GET /api/users/{userId}/activities       │
 * │  Query params: ?type=&status=                        │
 * │  Response: Activity[] (see lib/types/activity.ts)    │
 * └──────────────────────────────────────────────────────┘
 */

export type ActivityTypeFilter = "ALL" | "INVESTMENT" | "WITHDRAWAL" | "LIQUIDATION" | "AUTO_REBALANCE" | "ERROR";
export type ActivityStatusFilter = "ALL" | "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";

export interface GetActivitiesParams {
  userId: string;
  type?: ActivityTypeFilter;
  status?: ActivityStatusFilter;
}

export async function getActivities(params: GetActivitiesParams): Promise<Activity[]> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockActivities } = await import("@/lib/mock/activity");
    let filtered = [...mockActivities];

    if (params.type && params.type !== "ALL") {
      filtered = filtered.filter((a) => a.type === params.type);
    }
    if (params.status && params.status !== "ALL") {
      filtered = filtered.filter((a) => a.status === params.status);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }

  const qs = new URLSearchParams();
  if (params.type && params.type !== "ALL") qs.set("type", params.type);
  if (params.status && params.status !== "ALL") qs.set("status", params.status);

  const { apiGet } = await import("./client");
  return apiGet<Activity[]>(`/api/dashboard/${params.userId}/activity?${qs.toString()}`);
}
