"use client";

import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { formatRelativeTime } from "@/lib/utils/format";
import type { DashboardActivity } from "@/lib/types/dashboard";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

interface ActivityConfig {
  label: string;
  color: string;
  icon: typeof TrendingUp;
}

const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  INVESTMENT: { label: "Investment", color: "#0D6B58", icon: TrendingUp },
  LIQUIDATION: { label: "Liquidation", color: "#E53935", icon: AlertTriangle },
  WITHDRAWAL: { label: "Withdrawal", color: "#F5A623", icon: ArrowUpFromLine },
  AUTO_REBALANCE: { label: "Rebalance", color: "#627EEA", icon: RefreshCw },
  ERROR: { label: "Error", color: "#E53935", icon: AlertTriangle },
};

function getDetail(activity: DashboardActivity): string {
  const d = activity.details;
  if (d.amount && d.pool) return `${d.amount} → ${d.pool} pool`;
  if (d.amount) return `${d.amount}`;
  if (d.reason) return String(d.reason);
  if (d.from && d.to) return `${d.from} → ${d.to}`;
  return "";
}

interface ActivityFeedProps {
  activities: DashboardActivity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-ld-slate">No recent activity</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[290px]">
      <div className="flex flex-col gap-1 pr-3">
        {activities.map((activity, i) => {
          const config = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.ERROR;
          const Icon = config.icon;
          const detail = getDetail(activity);

          return (
            <motion.div
              key={`${activity.type}-${activity.createdAt}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: i * 0.05,
                ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
              }}
              className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ld-light-1"
            >
              {/* Icon */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: config.color }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-display text-[13px] font-semibold text-ld-ink">
                    {config.label}
                  </span>
                  <StatusBadge
                    status={activity.status}
                    variant="activity"
                    className="scale-90"
                  />
                </div>
                {detail && (
                  <p className="text-[13px] text-ld-slate">{detail}</p>
                )}
                <div className="mt-1 flex items-center gap-3">
                  {activity.txHash && (
                    <ExplorerLink
                      chainId="moonbeam"
                      hash={activity.txHash}
                      className="text-[11px]"
                    />
                  )}
                  <span className="font-mono text-[11px] text-ld-slate/60">
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
