"use client";

import { motion } from "motion/react";
import type { PositionPnL } from "@/lib/types/position";

interface Props {
  pnl: PositionPnL;
}

export function PnlBreakdown({ pnl }: Props) {
  const totalAbs =
    Math.abs(pnl.feesEarnedUsd) +
    Math.abs(pnl.currentValueUsd - pnl.entryAmountUsd) +
    Math.abs(pnl.ilLossUsd);

  const feePct = totalAbs > 0 ? (Math.abs(pnl.feesEarnedUsd) / totalAbs) * 100 : 33;
  const appreciationPct =
    totalAbs > 0
      ? (Math.abs(pnl.currentValueUsd - pnl.entryAmountUsd) / totalAbs) * 100
      : 33;
  const ilPct = totalAbs > 0 ? (Math.abs(pnl.ilLossUsd) / totalAbs) * 100 : 33;

  const pnlPositive = pnl.netPnLUsd >= 0;

  return (
    <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-5 font-display text-[17px] font-semibold text-ld-ink">
        P&L Breakdown
      </h2>

      {/* Stacked bar */}
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-[#00C853]"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ width: `${feePct}%`, transformOrigin: "left" }}
        />
        <motion.div
          className="h-full bg-[rgba(0,200,83,0.15)]"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          style={{ width: `${appreciationPct}%`, transformOrigin: "left" }}
        />
        <motion.div
          className="h-full bg-[#E53935]"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          style={{ width: `${ilPct}%`, transformOrigin: "left" }}
        />
      </div>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#00C853]" />
          <span className="text-ld-slate">Fees Earned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[rgba(0,200,83,0.15)]" />
          <span className="text-ld-slate">Price Appreciation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#E53935]" />
          <span className="text-ld-slate">IL Loss</span>
        </div>
      </div>

      {/* Data rows */}
      <div className="space-y-0">
        <DataRow label="Entry Value (USD)" value={`$${pnl.entryAmountUsd.toFixed(2)}`} />
        <DataRow label="Current Value (USD)" value={`$${pnl.currentValueUsd.toFixed(2)}`} />
        <DataRow
          label="Fees Earned (USD)"
          value={`+$${pnl.feesEarnedUsd.toFixed(2)}`}
          valueColor="text-[#00C853]"
        />
        <DataRow
          label="IL Loss (USD)"
          value={`-$${Math.abs(pnl.ilLossUsd).toFixed(2)}`}
          valueColor="text-[#E53935]"
        />
      </div>

      {/* Net P&L */}
      <div className="mt-4 flex items-center justify-between border-t-2 border-black/6 pt-4">
        <span className="font-display text-[15px] font-semibold text-ld-ink">
          Net P&L
        </span>
        <span
          className={`font-mono text-[22px] font-medium ${
            pnlPositive ? "text-[#00C853]" : "text-[#E53935]"
          }`}
        >
          {pnlPositive ? "+" : "-"}${Math.abs(pnl.netPnLUsd).toFixed(2)}
          <span className="ml-1.5 text-sm opacity-70">
            ({pnlPositive ? "+" : ""}
            {pnl.netPnLPercent.toFixed(2)}%)
          </span>
        </span>
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  valueColor = "text-ld-ink",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between border-b border-black/4 py-2.5 last:border-0">
      <span className="font-body text-[13px] text-ld-slate">{label}</span>
      <span className={`font-mono text-sm font-medium ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}
