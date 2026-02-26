"use client";

import { motion } from "motion/react";
import { Search } from "lucide-react";

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  minTvl: string;
  onMinTvlChange: (val: string) => void;
  minApr: string;
  onMinAprChange: (val: string) => void;
  chain: string;
  onChainChange: (val: string) => void;
  dex: string;
  onDexChange: (val: string) => void;
  onReset: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  minTvl,
  onMinTvlChange,
  minApr,
  onMinAprChange,
  chain,
  onChainChange,
  dex,
  onDexChange,
  onReset,
}: FilterBarProps) {
  const hasFilters =
    search || minTvl || minApr || chain || dex;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
      className="rounded-[var(--ld-radius-sm)] bg-white px-6 py-[18px] shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        {/* Search */}
        <div className="w-full sm:min-w-[200px] sm:flex-1">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ld-slate/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by token..."
              className="h-9 w-full rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 pl-9 pr-3 text-sm text-ld-ink outline-none transition-all duration-150 placeholder:text-ld-slate/50 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
            />
          </div>
        </div>

        {/* Min TVL */}
        <div className="w-full sm:w-[130px]">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Min TVL
          </label>
          <div className="relative">
            <input
              type="number"
              value={minTvl}
              onChange={(e) => onMinTvlChange(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 px-3 pr-8 text-sm text-ld-ink outline-none transition-all duration-150 placeholder:text-ld-slate/50 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ld-slate">
              USD
            </span>
          </div>
        </div>

        {/* Min APR */}
        <div className="w-full sm:w-[110px]">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Min APR
          </label>
          <div className="relative">
            <input
              type="number"
              value={minApr}
              onChange={(e) => onMinAprChange(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 px-3 pr-6 text-sm text-ld-ink outline-none transition-all duration-150 placeholder:text-ld-slate/50 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ld-slate">
              %
            </span>
          </div>
        </div>

        {/* Chain */}
        <div className="w-[calc(50%-6px)] sm:w-[140px]">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Chain
          </label>
          <select
            value={chain}
            onChange={(e) => onChainChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 px-3 text-sm text-ld-ink outline-none transition-all duration-150 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
          >
            <option value="">All Chains</option>
            <option value="asset-hub">Asset Hub</option>
            <option value="moonbeam">Moonbeam</option>
          </select>
        </div>

        {/* DEX */}
        <div className="w-[calc(50%-6px)] sm:w-[140px]">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            DEX
          </label>
          <select
            value={dex}
            onChange={(e) => onDexChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-[var(--ld-radius-xs)] border border-black/6 bg-ld-light-1 px-3 text-sm text-ld-ink outline-none transition-all duration-150 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
          >
            <option value="">All DEXes</option>
            <option value="algebra">Algebra</option>
            <option value="stellaswap">StellaSwap</option>
          </select>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={onReset}
            className="mb-1 text-xs text-ld-slate transition-colors hover:text-ld-primary"
          >
            Reset
          </button>
        )}
      </div>
    </motion.div>
  );
}
