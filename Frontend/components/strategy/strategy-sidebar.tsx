"use client";

import { motion } from "motion/react";
import type { UserPreference } from "@/lib/types/preferences";

interface StrategySidebarProps {
  values: UserPreference;
}

export function StrategySidebar({ values }: StrategySidebarProps) {
  const riskPos = (1 - (values.lambdaRiskAversion ?? 0.5)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.2,
        ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
      }}
      className="sticky top-20 space-y-4"
    >
      {/* Strategy Preview (Dark Card) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1426] p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#E6007A]/8 blur-[60px]" />

        <h3 className="relative mb-4 font-display text-sm font-semibold text-white/60">
          Strategy Preview
        </h3>

        <div className="relative space-y-2">
          <SidebarRow label="APY Target" value={`${values.minApy?.toFixed(2) ?? "0.00"}%`} />
          <SidebarRow
            label="Stop-Loss"
            value={`${values.defaultLowerRangePercent ?? -5}%`}
            valueColor="text-[#E53935]"
          />
          <SidebarRow
            label="Take-Profit"
            value={`+${values.defaultUpperRangePercent ?? 10}%`}
            valueColor="text-[#00C853]"
          />
          <SidebarRow
            label="Max Positions"
            value={`${values.maxPositions ?? 6}`}
          />
          <SidebarRow
            label="Risk Aversion"
            value={`${(values.lambdaRiskAversion ?? 0.5).toFixed(2)}`}
            valueColor="text-[#E6007A]"
          />
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-3 font-display text-sm font-semibold text-ld-ink">
          How Strategy Works
        </h3>
        <p className="text-xs leading-relaxed text-ld-slate">
          LiquiDOT evaluates pools on a regular interval based on your check
          frequency. Pools are scored by risk-adjusted yield, filtered by your
          criteria, and positions are opened automatically. Stop-loss and
          take-profit triggers protect your capital. Rebalancing only fires
          when the net benefit exceeds gas costs.
        </p>
      </div>

      {/* Risk Scale */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-3 font-display text-sm font-semibold text-ld-ink">
          Risk Profile
        </h3>
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#00C853] via-[#F5A623] to-[#E53935]">
          <motion.div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ld-ink bg-white"
            animate={{ left: `${riskPos}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-[#00C853]">Low Risk</span>
          <span className="font-mono text-ld-ink">
            {values.lambdaRiskAversion?.toFixed(2) ?? "0.50"}
          </span>
          <span className="text-[#E53935]">High Risk</span>
        </div>
      </div>
    </motion.div>
  );
}

function SidebarRow({
  label,
  value,
  valueColor = "text-[#E8ECF1]",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between rounded-lg bg-white/4 px-3 py-2">
      <span className="text-xs text-white/40">{label}</span>
      <span className={`font-mono text-[13px] ${valueColor}`}>{value}</span>
    </div>
  );
}
