"use client";

import { motion } from "motion/react";
import type { UserPreference } from "@/lib/types/preferences";

interface Preset {
  name: string;
  description: string;
  color: string;
  values: Partial<UserPreference>;
}

const PRESETS: Preset[] = [
  {
    name: "Conservative",
    description: "Low risk, stable returns, fewer positions",
    color: "#627EEA",
    values: {
      minApy: 5,
      defaultLowerRangePercent: -3,
      defaultUpperRangePercent: 8,
      lambdaRiskAversion: 0.8,
      maxPositions: 3,
    },
  },
  {
    name: "Balanced",
    description: "Moderate risk/reward, default selection",
    color: "#0D6B58",
    values: {
      minApy: 10,
      defaultLowerRangePercent: -5,
      defaultUpperRangePercent: 15,
      lambdaRiskAversion: 0.5,
      maxPositions: 6,
    },
  },
  {
    name: "Aggressive",
    description: "High risk tolerance, growth-focused",
    color: "#F5A623",
    values: {
      minApy: 20,
      defaultLowerRangePercent: -10,
      defaultUpperRangePercent: 30,
      lambdaRiskAversion: 0.2,
      maxPositions: 10,
    },
  },
];

interface PresetButtonsProps {
  selected: string | null;
  onSelect: (preset: Preset) => void;
}

export function PresetButtons({ selected, onSelect }: PresetButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      {PRESETS.map((preset) => {
        const isActive = selected === preset.name;
        return (
          <motion.button
            key={preset.name}
            onClick={() => onSelect(preset)}
            whileTap={{ scale: 0.98 }}
            className={`relative overflow-hidden rounded-xl border-2 p-5 text-left transition-all duration-250 ${
              isActive
                ? "border-ld-primary shadow-[0_0_0_1px_var(--ld-primary),0_4px_16px_rgba(13,107,88,0.1)]"
                : "border-transparent bg-white shadow-[var(--shadow-card)] hover:border-ld-primary/20"
            }`}
          >
            {/* Top accent bar */}
            <div
              className="absolute left-0 right-0 top-0 transition-all duration-250"
              style={{
                height: isActive ? 3 : 0,
                backgroundColor: preset.color,
              }}
            />

            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: preset.color }}
              />
              <span className="font-display text-[15px] font-semibold text-ld-ink">
                {preset.name}
              </span>
            </div>
            <p className="mb-4 text-xs text-ld-slate">{preset.description}</p>

            <div className="space-y-1.5 text-xs">
              <Row label="Min APY" value={`${preset.values.minApy}%`} />
              <Row label="Stop-Loss" value={`${preset.values.defaultLowerRangePercent}%`} />
              <Row label="Take-Profit" value={`+${preset.values.defaultUpperRangePercent}%`} />
              <Row label="Max Positions" value={`${preset.values.maxPositions}`} />
              <Row label="Risk Aversion" value={`${preset.values.lambdaRiskAversion}`} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ld-slate">{label}</span>
      <span className="font-mono font-medium text-ld-ink">{value}</span>
    </div>
  );
}
