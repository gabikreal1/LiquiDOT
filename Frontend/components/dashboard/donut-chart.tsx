"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import type { DashboardPool } from "@/lib/types/dashboard";

const COLORS = ["#0D6B58", "#00E5A0", "#E6007A", "#627EEA", "#F5A623", "#2775CA"];

interface DonutChartProps {
  pools: DashboardPool[];
}

export function DonutChart({ pools }: DonutChartProps) {
  const allocated = pools.filter((p) => p.userAllocationUsd > 0);
  const total = allocated.reduce((s, p) => s + p.userAllocationUsd, 0);

  const segments = useMemo(() => {
    if (total === 0) return [];
    const circumference = 2 * Math.PI * 70;
    let offset = 0;
    return allocated.map((pool, i) => {
      const pct = pool.userAllocationUsd / total;
      const dashLength = pct * circumference;
      const seg = {
        pool,
        color: COLORS[i % COLORS.length],
        dasharray: `${dashLength} ${circumference - dashLength}`,
        dashoffset: -offset,
        pct,
      };
      offset += dashLength;
      return seg;
    });
  }, [allocated, total]);

  if (allocated.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-ld-slate">No active allocations</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      {/* SVG Donut */}
      <div className="relative h-[180px] w-[180px] shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="#F3F5F4"
            strokeWidth="24"
          />
          {/* Data segments */}
          {segments.map((seg, i) => (
            <motion.circle
              key={seg.pool.id}
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={seg.color}
              strokeWidth="24"
              strokeLinecap="round"
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.8,
                delay: i * 0.2,
                ease: "easeOut",
              }}
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[22px] font-bold text-ld-ink">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.pool.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.8 + i * 0.08,
              ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
            }}
            className="flex items-center gap-2.5"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-sm text-ld-ink">{seg.pool.name}</span>
            <span className="font-mono text-xs text-ld-slate">
              ${seg.pool.userAllocationUsd.toLocaleString()}
            </span>
            <span className="font-mono text-[10px] text-ld-slate/60">
              {(seg.pct * 100).toFixed(0)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
