"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Settings } from "lucide-react";
import type { UserPreference } from "@/lib/types/preferences";

function formatInterval(seconds: number): string {
  if (seconds >= 3600) return `${seconds / 3600}h`;
  if (seconds >= 60) return `${seconds / 60}m`;
  return `${seconds}s`;
}

interface StrategyStripProps {
  strategy: UserPreference;
}

export function StrategyStrip({ strategy }: StrategyStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.08,
        ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
      }}
      className="flex flex-wrap items-center gap-4 rounded-xl border-l-[3px] border-ld-polkadot-pink bg-white px-6 py-5 shadow-[var(--shadow-card)]"
    >
      {/* Label */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ld-polkadot-pink/10">
          <Settings className="h-4 w-4 text-ld-polkadot-pink" />
        </div>
        <span className="font-display text-[15px] font-semibold text-ld-ink">
          Active Strategy: Balanced
        </span>
      </div>

      {/* Param chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="Min APY" value={`${strategy.minApy}%`} />
        <Chip
          label="SL/TP"
          value={`${strategy.defaultLowerRangePercent}% / +${strategy.defaultUpperRangePercent}%`}
        />
        <Chip label="Max Positions" value={String(strategy.maxPositions)} />
        <Chip
          label="Auto-Invest"
          value={strategy.autoInvestEnabled ? "ON" : "OFF"}
        />
        <Chip
          label="Check Interval"
          value={formatInterval(strategy.investmentCheckIntervalSeconds)}
        />
      </div>

      {/* Edit link */}
      <Link
        href="/dashboard/strategy"
        className="ml-auto text-sm font-medium text-ld-primary transition-colors hover:text-ld-accent"
      >
        Edit Strategy →
      </Link>
    </motion.div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-ld-light-2 px-2.5 py-1 text-xs">
      <span className="text-ld-slate">{label}:</span>
      <span className="font-mono font-medium text-ld-ink">{value}</span>
    </span>
  );
}
