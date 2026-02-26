"use client";

import { motion } from "motion/react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PositionDetail } from "@/lib/types/position";
import { format } from "date-fns";

const TOKEN_COLORS: Record<string, string> = {
  xcDOT: "#E6007A",
  WGLMR: "#627EEA",
  USDC: "#2775CA",
  USDT: "#26A17B",
  WETH: "#627EEA",
  WBTC: "#F7931A",
  DAI: "#F5AC37",
  GLMR: "#627EEA",
};

const CHAIN_NAMES: Record<number, string> = {
  1284: "Moonbeam",
  1287: "Moonbase Alpha",
};

const metricVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

interface Props {
  position: PositionDetail;
}

export function PositionHero({ position }: Props) {
  const tokens = position.poolName.split("/");
  const t0 = tokens[0] ?? "";
  const t1 = tokens[1] ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
      }}
      className="relative overflow-hidden rounded-[20px] bg-[#0B1426] p-9 shadow-[var(--shadow-heavy)]"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[#E6007A]/6 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-[#00E5A0]/4 blur-[60px]" />

      {/* Top row */}
      <div className="relative mb-8 flex flex-wrap items-center gap-4">
        {/* Token dots */}
        <div className="flex">
          <span
            className="inline-block h-11 w-11 rounded-full border-[3px] border-white/10"
            style={{ backgroundColor: TOKEN_COLORS[t0] ?? "#6B8299" }}
          />
          <span
            className="-ml-3.5 inline-block h-11 w-11 rounded-full border-[3px] border-white/10"
            style={{ backgroundColor: TOKEN_COLORS[t1] ?? "#6B8299" }}
          />
        </div>

        <div>
          <h1 className="font-display text-[28px] font-bold text-[#E8ECF1]">
            {position.poolName}
          </h1>
          <p className="text-[13px] text-[#6B8299]">
            {position.dexName} DEX · {CHAIN_NAMES[position.chainId] ?? position.chainId} ({position.chainId})
            {position.moonbeamPositionId != null && ` · Position #${position.moonbeamPositionId}`}
          </p>
        </div>

        <div className="ml-auto">
          <StatusBadge
            status={position.status}
            variant="position"
            className="text-[13px]"
          />
        </div>
      </div>

      {/* Metric cards */}
      <motion.div
        className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5"
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.06, delayChildren: 0.2 }}
      >
        <motion.div variants={metricVariants} className="rounded-xl border border-white/6 bg-white/4 px-3 py-3 sm:px-[18px] sm:py-4">
          <div className="mb-1 font-body text-[11px] text-white/40">Amount Invested</div>
          <div className="font-mono text-base font-medium text-[#E8ECF1]">
            {position.amountDot.toFixed(2)} DOT
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-white/30">
            (${(position.amountDot * position.entryPriceUsd).toFixed(2)})
          </div>
        </motion.div>

        <motion.div variants={metricVariants} className="rounded-xl border border-white/6 bg-white/4 px-3 py-3 sm:px-[18px] sm:py-4">
          <div className="mb-1 font-body text-[11px] text-white/40">Chain</div>
          <div className="font-mono text-base font-medium text-[#E8ECF1]">
            {CHAIN_NAMES[position.chainId] ?? "Unknown"}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-white/30">
            ({position.chainId})
          </div>
        </motion.div>

        <motion.div variants={metricVariants} className="rounded-xl border border-white/6 bg-white/4 px-3 py-3 sm:px-[18px] sm:py-4">
          <div className="mb-1 font-body text-[11px] text-white/40">Entry Price</div>
          <div className="font-mono text-base font-medium text-[#E8ECF1]">
            ${position.entryPriceUsd.toFixed(2)}
          </div>
        </motion.div>

        <motion.div variants={metricVariants} className="rounded-xl border border-white/6 bg-white/4 px-3 py-3 sm:px-[18px] sm:py-4">
          <div className="mb-1 font-body text-[11px] text-white/40">Created</div>
          <div className="font-mono text-base font-medium text-[#E8ECF1]">
            {format(new Date(position.createdAt), "MMM d, yyyy")}
          </div>
        </motion.div>

        <motion.div variants={metricVariants} className="rounded-xl border border-white/6 bg-white/4 px-3 py-3 sm:px-[18px] sm:py-4">
          <div className="mb-1 font-body text-[11px] text-white/40">Executed</div>
          <div className="font-mono text-base font-medium text-[#E8ECF1]">
            {position.executedAt
              ? format(new Date(position.executedAt), "MMM d, yyyy")
              : "—"}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
