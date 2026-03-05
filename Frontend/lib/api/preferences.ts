import type { UserPreference } from "@/lib/types/preferences";
import { apiGet, apiPut } from "./client";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  Confirm UserPreference field names match API.       │
 * │  See lib/types/preferences.ts for the full shape.    │
 * │  Endpoints:                                          │
 * │    GET /api/users/{userId}/preferences               │
 * │    PUT /api/users/{userId}/preferences               │
 * └──────────────────────────────────────────────────────┘
 */

export async function getPreferences(
  userId: string
): Promise<UserPreference> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    const { mockPreferences } = await import("@/lib/mock/preferences");
    return mockPreferences;
  }
  return apiGet<UserPreference>(`/api/users/${userId}/preferences`);
}

export async function savePreferences(
  userId: string,
  data: UserPreference
): Promise<UserPreference> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
    return data;
  }
  return apiPut<UserPreference>(`/api/users/${userId}/preferences`, data);
}
