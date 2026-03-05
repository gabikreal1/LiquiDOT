"use client";

import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion } from "motion/react";
import { History } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePositionSSE } from "@/lib/hooks/use-sse";
import {
  getActivities,
  type ActivityTypeFilter,
  type ActivityStatusFilter,
} from "@/lib/api/activity";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { ActivityList } from "@/components/activity/activity-list";
import { SummaryStrip } from "@/components/activity/summary-strip";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ActivityPage() {
  const { isAuthenticated, userId } = useAuthStore();
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>("ALL");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // SSE: invalidates activity cache on real-time events
  usePositionSSE(isAuthenticated ? userId : null);

  // Unfiltered query for summary strip counts
  const { data: allActivities } = useQuery({
    queryKey: ["activities", userId, "ALL", "ALL"],
    queryFn: () =>
      getActivities({ userId: userId ?? "", type: "ALL", status: "ALL" }),
    enabled: isAuthenticated && !!userId,
  });

  // Filtered query for the list
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activities", userId, typeFilter, statusFilter],
    queryFn: () =>
      getActivities({
        userId: userId ?? "",
        type: typeFilter,
        status: statusFilter,
      }),
    enabled: isAuthenticated && !!userId,
    placeholderData: keepPreviousData,
  });

  if (!hydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-h3 mb-4 text-ld-ink">Connect Your Wallet</h2>
          <p className="mb-6 text-body text-ld-slate">
            You need to connect your wallet to view activity history.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/">
              <Button className="bg-ld-primary text-white hover:bg-ld-primary/90">
                Connect Wallet
              </Button>
            </Link>
            <Link href="/" className="text-sm text-ld-slate hover:text-ld-ink">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-12 sm:px-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ld-accent/10">
            <History className="h-5 w-5 text-ld-primary" />
          </div>
          <h1 className="text-h2 text-ld-ink">Activity History</h1>
        </div>
        <p className="mt-1 text-body text-ld-slate">
          All transactions, rebalances, and system events.
        </p>
      </motion.div>

      {/* Summary Strip */}
      {allActivities && allActivities.length > 0 && (
        <div className="mb-6">
          <SummaryStrip activities={allActivities} />
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
        className="mb-6"
      >
        <ActivityFilters
          type={typeFilter}
          status={statusFilter}
          onTypeChange={setTypeFilter}
          onStatusChange={setStatusFilter}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl bg-ld-gray/10"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
            <p className="text-body text-red-600">
              Failed to load activity. Please try again.
            </p>
          </div>
        ) : (
          <ActivityList activities={data ?? []} />
        )}
      </motion.div>
    </div>
  );
}
