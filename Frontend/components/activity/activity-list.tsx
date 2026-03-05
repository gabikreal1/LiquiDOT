"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { formatRelativeTime } from "@/lib/utils/format";
import type { Activity } from "@/lib/types/activity";

const typeConfig: Record<
  string,
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  INVESTMENT: {
    label: "Investment",
    Icon: ArrowDownRight,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
  },
  WITHDRAWAL: {
    label: "Withdrawal",
    Icon: ArrowUpRight,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
  },
  LIQUIDATION: {
    label: "Liquidation",
    Icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
  AUTO_REBALANCE: {
    label: "Rebalance",
    Icon: RefreshCw,
    color: "text-purple-600",
    bg: "bg-purple-500/10",
  },
  ERROR: {
    label: "Error",
    Icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
};

function getDetailText(activity: Activity): string {
  const d = activity.details;
  if (d.amount && d.pool) return `${d.amount} → ${d.pool} pool`;
  if (d.amount) return `${d.amount}`;
  if (d.from && d.to) return `Moved from ${d.from} to ${d.to}`;
  if (d.reason) return String(d.reason);
  if (d.error) return String(d.error);
  return "";
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return "Today";
  if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDate(activities: Activity[]): [string, Activity[]][] {
  const groups = new Map<string, Activity[]>();

  for (const activity of activities) {
    const label = getDateLabel(activity.createdAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(activity);
    } else {
      groups.set(label, [activity]);
    }
  }

  return Array.from(groups.entries());
}

interface ActivityListProps {
  activities: Activity[];
}

export function ActivityList({ activities }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center rounded-xl border border-ld-gray/20 bg-white py-20"
      >
        <p className="text-body text-ld-slate">No activity matches your filters.</p>
      </motion.div>
    );
  }

  const groups = groupByDate(activities);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {groups.map(([dateLabel, items], groupIdx) => (
          <motion.div
            key={dateLabel}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.25,
              delay: groupIdx * 0.06,
              ease: "easeOut",
            }}
          >
            {/* Date header */}
            <h3 className="mb-3 text-sm font-semibold text-ld-slate">{dateLabel}</h3>

            {/* Items in this date group */}
            <div className="overflow-hidden rounded-xl border border-ld-gray/20 bg-white">
              {items.map((activity, i) => {
                const cfg = typeConfig[activity.type] ?? typeConfig.ERROR;
                const Icon = cfg.Icon;
                const detail = getDetailText(activity);
                const isFailed = activity.status === "FAILED";

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: groupIdx * 0.08 + i * 0.06,
                      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
                    }}
                    className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 ${
                      i < items.length - 1 ? "border-b border-ld-gray/10" : ""
                    } ${isFailed ? "animate-[failedPulse_0.8s_ease-out]" : ""}`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>

                    {/* Main content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <StatusBadge status={activity.status} variant="activity" />
                      </div>
                      {detail && (
                        <p className="truncate text-sm text-ld-slate">{detail}</p>
                      )}
                    </div>

                    {/* Tx hash */}
                    <div className="shrink-0 sm:text-right">
                      {activity.txHash ? (
                        <ExplorerLink hash={activity.txHash} chainId="moonbeam" chars={6} />
                      ) : (
                        <span className="font-mono text-sm text-ld-gray">—</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 text-xs text-ld-slate sm:w-24 sm:text-right">
                      {formatRelativeTime(activity.createdAt)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
