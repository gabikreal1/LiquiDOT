"use client";

import type { PoolData } from "@/lib/types/pool";

function computeRiskScore(pool: PoolData): number {
  const tvl = parseFloat(pool.tvl);
  const volume = parseFloat(pool.volume24h);
  const apr = parseFloat(pool.apr);

  // Heuristic: lower TVL = higher risk, high APR = higher risk, low volume ratio = higher risk
  let score = 0;

  // TVL factor (0-35): pools < $1M are risky
  if (tvl < 500_000) score += 35;
  else if (tvl < 1_000_000) score += 25;
  else if (tvl < 3_000_000) score += 15;
  else if (tvl < 5_000_000) score += 8;
  else score += 3;

  // APR factor (0-35): very high APR suggests volatility
  if (apr > 20) score += 35;
  else if (apr > 15) score += 22;
  else if (apr > 10) score += 12;
  else if (apr > 5) score += 5;
  else score += 2;

  // Volume/TVL ratio (0-30): low ratio = low liquidity utilization
  const ratio = volume / tvl;
  if (ratio < 0.05) score += 25;
  else if (ratio < 0.1) score += 15;
  else if (ratio < 0.2) score += 8;
  else score += 3;

  return Math.min(score, 100);
}

interface RiskScoreBarProps {
  pool: PoolData;
}

export function RiskScoreBar({ pool }: RiskScoreBarProps) {
  const score = computeRiskScore(pool);

  let color: string;
  let label: string;

  if (score < 35) {
    color = "#22C55E"; // green
    label = "Low";
  } else if (score <= 60) {
    color = "#F59E0B"; // amber
    label = "Med";
  } else {
    color = "#EF4444"; // red
    label = "High";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-9 overflow-hidden rounded-full bg-ld-light-2">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="font-body text-[11px] font-medium"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
