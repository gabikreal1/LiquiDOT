"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/*
 * ┌──────────────────────────────────────────────────────┐
 * │  BACKEND MATE:                                       │
 * │  This hook will connect to the SSE endpoint at       │
 * │  GET /api/positions/user/{userId}/events             │
 * │  and invalidate dashboard queries on events like     │
 * │  CREATED, EXECUTED, LIQUIDATED, FAILED,              │
 * │  STATUS_CHANGE.                                      │
 * │                                                      │
 * │  For now it's a no-op in mock mode.                  │
 * └──────────────────────────────────────────────────────┘
 */

export function usePositionSSE(userId: string | null) {
  const queryClient = useQueryClient();
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  useEffect(() => {
    if (!userId || isMock) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const eventSource = new EventSource(
      `${baseUrl}/api/positions/user/${userId}/events`
    );

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      queryClient.invalidateQueries({ queryKey: ["activities", userId] });
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [userId, isMock, queryClient]);
}
