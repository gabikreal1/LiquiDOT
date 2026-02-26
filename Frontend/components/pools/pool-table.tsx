"use client";

import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { TokenPairDots } from "@/components/shared/token-pair-dots";
import { RiskScoreBar } from "./risk-score-bar";
import type { PoolData } from "@/lib/types/pool";

const CHAIN_DOT_COLORS: Record<string, string> = {
  "asset-hub": "#E6007A",
  moonbeam: "#627EEA",
};

const CHAIN_LABELS: Record<string, string> = {
  "asset-hub": "Asset Hub",
  moonbeam: "Moonbeam",
};

const DEX_LABELS: Record<string, string> = {
  algebra: "Algebra",
  stellaswap: "StellaSwap",
};

interface SortConfig {
  key: string;
  order: "asc" | "desc";
}

interface PoolTableProps {
  pools: PoolData[];
  sort: SortConfig;
  onSort: (key: string) => void;
  isFetching: boolean;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = currentSort.key === sortKey;

  return (
    <th
      className={`cursor-pointer select-none px-4 py-3 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate transition-colors hover:text-ld-ink ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <ArrowUp
            className={`h-2.5 w-2.5 -mb-0.5 transition-colors duration-150 ${
              isActive && currentSort.order === "asc"
                ? "text-ld-primary"
                : "text-ld-slate/25"
            }`}
          />
          <ArrowDown
            className={`h-2.5 w-2.5 transition-colors duration-150 ${
              isActive && currentSort.order === "desc"
                ? "text-ld-primary"
                : "text-ld-slate/25"
            }`}
          />
        </span>
      </span>
    </th>
  );
}

function formatTvl(tvl: string): string {
  const n = parseFloat(tvl);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatFee(fee: number): string {
  return `${(fee / 10_000).toFixed(2)}%`;
}

export function PoolTable({ pools, sort, onSort, isFetching }: PoolTableProps) {
  return (
    <div className="relative overflow-hidden rounded-[var(--ld-radius-sm)] bg-white shadow-[var(--shadow-card)]">
      {/* Fetching indicator */}
      {isFetching && (
        <div className="absolute left-0 right-0 top-0 z-20 h-0.5 overflow-hidden bg-ld-accent/20">
          <motion.div
            className="h-full bg-ld-primary"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ width: "40%" }}
          />
        </div>
      )}

      <div
        className="transition-opacity duration-200"
        style={{ opacity: isFetching ? 0.5 : 1 }}
      >
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/6 bg-[rgba(230,0,122,0.012)]">
                <SortHeader
                  label="Pool"
                  sortKey="pool"
                  currentSort={sort}
                  onSort={onSort}
                  className="w-[24%]"
                />
                <SortHeader
                  label="APR"
                  sortKey="apr"
                  currentSort={sort}
                  onSort={onSort}
                  className="w-[11%]"
                />
                <SortHeader
                  label="TVL"
                  sortKey="tvl"
                  currentSort={sort}
                  onSort={onSort}
                  className="w-[14%]"
                />
                <SortHeader
                  label="Volume 24h"
                  sortKey="volume24h"
                  currentSort={sort}
                  onSort={onSort}
                  className="hidden w-[14%] lg:table-cell"
                />
                <SortHeader
                  label="Fee"
                  sortKey="fee"
                  currentSort={sort}
                  onSort={onSort}
                  className="w-[9%]"
                />
                <SortHeader
                  label="Chain"
                  sortKey="chain"
                  currentSort={sort}
                  onSort={onSort}
                  className="w-[13%]"
                />
                <th className="hidden w-[15%] px-4 py-3 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate lg:table-cell">
                  Risk
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {pools.map((pool, i) => (
                  <motion.tr
                    key={pool.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: i * 0.04,
                      ease: [0.19, 1, 0.22, 1],
                    }}
                    whileTap={{ scale: 0.995, backgroundColor: "rgba(13,107,88,0.03)" }}
                    className="cursor-pointer border-b border-black/4 transition-colors duration-150 last:border-0 hover:bg-[rgba(13,107,88,0.015)]"
                  >
                    {/* Pool */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <TokenPairDots
                          token0={pool.token0Symbol}
                          token1={pool.token1Symbol}
                          className="text-sm"
                        />
                        <span className="rounded bg-ld-light-2 px-1.5 py-0.5 text-[10px] text-ld-slate">
                          {DEX_LABELS[pool.dex] ?? pool.dex}
                        </span>
                      </div>
                    </td>

                    {/* APR */}
                    <td className="px-4 py-3.5 font-mono text-sm font-medium text-ld-success">
                      {parseFloat(pool.apr).toFixed(2)}%
                    </td>

                    {/* TVL */}
                    <td className="px-4 py-3.5 font-mono text-[13px] text-ld-ink">
                      {formatTvl(pool.tvl)}
                    </td>

                    {/* Volume 24h */}
                    <td className="hidden px-4 py-3.5 font-mono text-[13px] text-ld-ink lg:table-cell">
                      {formatTvl(pool.volume24h)}
                    </td>

                    {/* Fee */}
                    <td className="px-4 py-3.5 font-mono text-[13px] text-ld-slate">
                      {formatFee(pool.fee)}
                    </td>

                    {/* Chain */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              CHAIN_DOT_COLORS[pool.chain] ?? "#6B8299",
                          }}
                        />
                        <span className="font-body text-xs text-ld-ink">
                          {CHAIN_LABELS[pool.chain] ?? pool.chain}
                        </span>
                      </div>
                    </td>

                    {/* Risk */}
                    <td className="hidden px-4 py-3.5 lg:table-cell">
                      <RiskScoreBar pool={pool} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile card layout */}
        <div className="flex flex-col gap-3 p-4 md:hidden">
          <AnimatePresence mode="popLayout">
            {pools.map((pool, i) => (
              <motion.div
                key={pool.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.25,
                  delay: i * 0.03,
                  ease: "easeOut",
                }}
                className="cursor-pointer rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 p-4 transition-colors hover:bg-[rgba(13,107,88,0.015)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <TokenPairDots
                    token0={pool.token0Symbol}
                    token1={pool.token1Symbol}
                  />
                  <span className="font-mono text-sm font-medium text-ld-success">
                    {parseFloat(pool.apr).toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-ld-slate">TVL </span>
                    <span className="font-mono text-ld-ink">
                      {formatTvl(pool.tvl)}
                    </span>
                  </div>
                  <div>
                    <span className="text-ld-slate">Volume </span>
                    <span className="font-mono text-ld-ink">
                      {formatTvl(pool.volume24h)}
                    </span>
                  </div>
                  <div>
                    <span className="text-ld-slate">Fee </span>
                    <span className="font-mono text-ld-ink">
                      {formatFee(pool.fee)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          CHAIN_DOT_COLORS[pool.chain] ?? "#6B8299",
                      }}
                    />
                    <span className="text-ld-ink">
                      {CHAIN_LABELS[pool.chain] ?? pool.chain}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
