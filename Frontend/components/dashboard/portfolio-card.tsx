"use client";

import { motion } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import type { DashboardData } from "@/lib/types/dashboard";

const metricVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
};

interface PortfolioCardProps {
  data: DashboardData;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export function PortfolioCard({ data, onDeposit, onWithdraw }: PortfolioCardProps) {
  const { user, summary } = data;
  const pnlPositive = summary.totalPnlUsd >= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
      }}
      className="relative overflow-hidden rounded-[20px] bg-[#0B1426] p-5 shadow-[var(--shadow-heavy)] sm:p-9"
    >
      {/* Gradient overlays */}
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[#E6007A]/8 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00E5A0]/6 blur-[60px]" />

      {/* Top row: Balance + P&L */}
      <div className="relative mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="mb-1 font-body text-xs text-white/40">
            Available Balance
          </div>
          <div className="font-display text-[32px] font-bold leading-none text-white sm:text-[48px]">
            <AnimatedCounter
              value={user.balanceDot}
              suffix=" DOT"
              decimals={2}
              duration={1.2}
            />
          </div>
          <div className="mt-2 font-mono text-sm text-white/40">
            (<AnimatedCounter
              value={user.balanceUsd}
              prefix="$"
              decimals={2}
              duration={1}
            />)
          </div>
          {/* Deposit / Withdraw buttons */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onDeposit}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              <ArrowDownToLine className="h-3 w-3" />
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              <ArrowUpFromLine className="h-3 w-3" />
              Withdraw
            </button>
          </div>
        </div>

        <div className="text-right">
          <div className="mb-1 font-body text-xs text-white/40">
            Total P&L
          </div>
          <div
            className={`font-mono text-[20px] font-medium sm:text-[28px] ${
              pnlPositive ? "text-[#00C853]" : "text-[#E53935]"
            }`}
          >
            <AnimatedCounter
              value={summary.totalPnlUsd}
              prefix={pnlPositive ? "+$" : "-$"}
              decimals={2}
              duration={1}
            />
          </div>
          <div
            className={`mt-1 font-mono text-sm ${
              pnlPositive ? "text-[#00C853]/70" : "text-[#E53935]/70"
            }`}
          >
            ({pnlPositive ? "+" : ""}
            {summary.totalPnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Metric sub-cards */}
      <motion.div
        className="relative grid grid-cols-2 gap-3 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={metricVariants}
          className="rounded-xl border border-white/6 bg-white/4 px-4 py-3"
        >
          <div className="mb-1 font-body text-[11px] text-white/40">
            Available
          </div>
          <div className="font-mono text-lg font-medium text-[#E0E8F0]">
            <AnimatedCounter
              value={user.balanceDot}
              suffix=" DOT"
              decimals={2}
              duration={1}
            />
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-white/30">
            (${user.balanceUsd.toLocaleString()})
          </div>
        </motion.div>

        <motion.div
          variants={metricVariants}
          className="rounded-xl border border-white/6 bg-white/4 px-4 py-3"
        >
          <div className="mb-1 font-body text-[11px] text-white/40">
            Total Invested
          </div>
          <div className="font-mono text-lg font-medium text-[#E0E8F0]">
            <AnimatedCounter
              value={summary.totalInvestedUsd}
              prefix="$"
              decimals={2}
              duration={1}
            />
          </div>
        </motion.div>

        <motion.div
          variants={metricVariants}
          className="rounded-xl border border-white/6 bg-white/4 px-4 py-3"
        >
          <div className="mb-1 font-body text-[11px] text-white/40">
            Current Value
          </div>
          <div className="font-mono text-lg font-medium text-[#E0E8F0]">
            <AnimatedCounter
              value={summary.totalCurrentValueUsd}
              prefix="$"
              decimals={2}
              duration={1}
            />
          </div>
        </motion.div>

        <motion.div
          variants={metricVariants}
          className="rounded-xl border border-white/6 bg-white/4 px-4 py-3"
        >
          <div className="mb-1 font-body text-[11px] text-white/40">
            Total P&L
          </div>
          <div
            className={`font-mono text-lg font-medium ${
              pnlPositive ? "text-[#00C853]" : "text-[#E53935]"
            }`}
          >
            <AnimatedCounter
              value={Math.abs(summary.totalPnlUsd)}
              prefix={pnlPositive ? "+$" : "-$"}
              decimals={2}
              duration={1}
            />
          </div>
          <div
            className={`mt-0.5 font-mono text-[11px] ${
              pnlPositive ? "text-[#00C853]/60" : "text-[#E53935]/60"
            }`}
          >
            {pnlPositive ? "+" : ""}
            {summary.totalPnlPercent.toFixed(2)}%
          </div>
        </motion.div>
      </motion.div>

      {/* Status indicators */}
      <div className="relative mt-4 flex gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C853] shadow-[0_0_6px_rgba(0,200,83,0.5)]" />
          <span className="font-body text-xs text-white/50">
            Active: {summary.activePositionCount}
          </span>
        </div>
        {summary.pendingPositionCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#F5A623] shadow-[0_0_6px_rgba(245,166,35,0.5)]" />
            <span className="font-body text-xs text-white/50">
              Pending: {summary.pendingPositionCount}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
