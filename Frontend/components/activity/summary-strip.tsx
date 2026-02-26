"use client";

import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import type { Activity } from "@/lib/types/activity";

interface MetricConfig {
  label: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  count: (items: Activity[]) => number;
}

const metrics: MetricConfig[] = [
  {
    label: "Investments",
    Icon: ArrowDownRight,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    count: (items) => items.filter((a) => a.type === "INVESTMENT").length,
  },
  {
    label: "Rebalances",
    Icon: RefreshCw,
    color: "text-purple-600",
    bg: "bg-purple-500/10",
    count: (items) => items.filter((a) => a.type === "AUTO_REBALANCE").length,
  },
  {
    label: "Withdrawals",
    Icon: ArrowUpRight,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    count: (items) => items.filter((a) => a.type === "WITHDRAWAL").length,
  },
  {
    label: "Liquidations",
    Icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-500/10",
    count: (items) => items.filter((a) => a.type === "LIQUIDATION").length,
  },
  {
    label: "Confirmed",
    Icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-500/10",
    count: (items) => items.filter((a) => a.status === "CONFIRMED").length,
  },
  {
    label: "Failed",
    Icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-500/10",
    count: (items) => items.filter((a) => a.status === "FAILED").length,
  },
];

interface SummaryStripProps {
  activities: Activity[];
}

export function SummaryStrip({ activities }: SummaryStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl bg-ld-dark p-5"
    >
      {/* Top accent gradient */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ld-accent to-ld-primary" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {metrics.map((m, i) => {
          const Icon = m.Icon;
          const count = m.count(activities);

          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.35,
                delay: 0.1 + i * 0.06,
                ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
              }}
              className="flex items-center gap-3"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.bg}`}
              >
                <Icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <div>
                <AnimatedCounter
                  value={count}
                  duration={0.6}
                  decimals={0}
                  className="text-lg font-bold text-white"
                />
                <p className="text-xs text-ld-frost/60">{m.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
