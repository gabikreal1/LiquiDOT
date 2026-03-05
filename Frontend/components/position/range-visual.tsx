"use client";

import { motion } from "motion/react";
import type { PositionDetail } from "@/lib/types/position";

interface Props {
  position: PositionDetail;
}

export function RangeVisual({ position }: Props) {
  const absSl = Math.abs(position.lowerRangePercent);
  const tp = position.upperRangePercent;
  const entryPos = (absSl / (absSl + tp)) * 100;

  // Current price position on the range bar
  const priceDelta = position.currentPrice - position.entryPriceUsd;
  const pricePct = (priceDelta / position.entryPriceUsd) * 100;
  // Map pricePct into the SL..TP range
  const currentPos = entryPos + (pricePct / (absSl + tp)) * 100;
  const clampedCurrentPos = Math.max(2, Math.min(98, currentPos));

  return (
    <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-5 font-display text-[17px] font-semibold text-ld-ink">
        Position Range
      </h2>

      {/* Range bar */}
      <div className="rounded-xl bg-ld-light-1 p-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-ld-light-2">
          {/* SL zone */}
          <motion.div
            className="absolute left-0 top-0 h-full rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${entryPos}%` }}
            transition={{
              duration: 0.6,
              ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
            }}
            style={{
              background:
                "linear-gradient(90deg, rgba(229,57,53,0.3), rgba(229,57,53,0.08))",
            }}
          />
          {/* TP zone */}
          <motion.div
            className="absolute right-0 top-0 h-full rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${100 - entryPos}%` }}
            transition={{
              duration: 0.6,
              ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
            }}
            style={{
              background:
                "linear-gradient(90deg, rgba(0,200,83,0.05), rgba(0,200,83,0.25))",
            }}
          />

          {/* Entry marker */}
          <motion.div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ld-ink bg-white"
            style={{ left: `${entryPos}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.6,
              type: "spring",
              stiffness: 400,
              damping: 20,
            }}
          />

          {/* Current price marker */}
          <motion.div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#00C853] bg-white"
            initial={{ left: `${entryPos}%`, opacity: 0 }}
            animate={{ left: `${clampedCurrentPos}%`, opacity: 1 }}
            transition={{
              delay: 0.9,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
              damping: 25,
            }}
          />
        </div>

        {/* Labels */}
        <div className="mt-3 flex justify-between text-xs">
          <span className="font-mono font-medium text-[#E53935]">
            {position.lowerRangePercent}%
          </span>
          <span className="text-ld-slate">
            Entry ${position.entryPriceUsd.toFixed(2)}
          </span>
          <span className="font-mono font-medium text-[#00C853]">
            Current ${position.currentPrice.toFixed(2)}
          </span>
          <span className="font-mono font-medium text-[#00C853]">
            +{position.upperRangePercent}%
          </span>
        </div>
      </div>

      {/* Data rows */}
      <div className="mt-5 space-y-0">
        <DataRow label="Stop-Loss" value={`${position.lowerRangePercent}%`} />
        <DataRow label="Entry Price" value={`$${position.entryPriceUsd.toFixed(2)}`} />
        <DataRow label="Take-Profit" value={`+${position.upperRangePercent}%`} />
        <DataRow label="Lower Tick" value={String(position.lowerTick)} />
        <DataRow label="Upper Tick" value={`+${position.upperTick}`} />
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-black/4 py-2.5 last:border-0">
      <span className="font-body text-[13px] text-ld-slate">{label}</span>
      <span className="font-mono text-sm font-medium text-ld-ink">{value}</span>
    </div>
  );
}
