"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExplorerLink } from "@/components/shared/explorer-link";
import type { DashboardPosition } from "@/lib/types/dashboard";

const TOKEN_COLORS: Record<string, string> = {
  xcDOT: "#E6007A",
  WGLMR: "#627EEA",
  USDC: "#2775CA",
  USDT: "#26A17B",
  WETH: "#627EEA",
  WBTC: "#F7931A",
  DAI: "#F5AC37",
};

const FILTERS = ["All", "Active", "Pending", "Liquidated"] as const;
type Filter = (typeof FILTERS)[number];

const filterMap: Record<Filter, string[]> = {
  All: [],
  Active: ["ACTIVE", "OUT_OF_RANGE"],
  Pending: ["PENDING_EXECUTION", "LIQUIDATION_PENDING"],
  Liquidated: ["LIQUIDATED"],
};

function getTokens(poolName: string) {
  const parts = poolName.split("/");
  return { t0: parts[0] ?? "", t1: parts[1] ?? "" };
}

interface PositionsTableProps {
  positions: DashboardPosition[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const [filter, setFilter] = useState<Filter>("All");

  const filtered =
    filter === "All"
      ? positions
      : positions.filter((p) => filterMap[filter].includes(p.status));

  return (
    <div>
      {/* Filter chips */}
      <div className="mb-4 flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          >
            {f === filter && (
              <motion.div
                layoutId="positionFilter"
                className="absolute inset-0 rounded-md bg-ld-primary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 ${
                f === filter ? "text-white" : "text-ld-slate hover:text-ld-ink"
              }`}
            >
              {f}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center"
        >
          <p className="mb-2 text-sm text-ld-ink">No positions yet.</p>
          <Link
            href="/dashboard/strategy"
            className="text-sm text-ld-primary hover:text-ld-accent"
          >
            Configure your strategy to get started →
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Pool
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Amount
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Value
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    P&L
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="wait">
                  {filtered.map((pos, i) => {
                    const { t0, t1 } = getTokens(pos.poolName);
                    const pnlPositive = pos.pnlUsd >= 0;

                    return (
                      <motion.tr
                        key={pos.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: i * 0.03,
                        }}
                        className="cursor-pointer border-b border-black/4 transition-colors duration-150 last:border-0 hover:bg-[rgba(13,107,88,0.02)]"
                        onClick={() => {
                          window.location.href = `/dashboard/positions/${pos.id}`;
                        }}
                      >
                        {/* Pool */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex">
                              <span
                                className="inline-block h-6 w-6 rounded-full border-2 border-white"
                                style={{
                                  backgroundColor:
                                    TOKEN_COLORS[t0] ?? "#6B8299",
                                }}
                              />
                              <span
                                className="-ml-2 inline-block h-6 w-6 rounded-full border-2 border-white"
                                style={{
                                  backgroundColor:
                                    TOKEN_COLORS[t1] ?? "#6B8299",
                                }}
                              />
                            </div>
                            <span className="font-display text-sm font-semibold text-ld-ink">
                              {pos.poolName}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 font-mono text-[13px] text-ld-ink">
                          {pos.amountDot.toFixed(2)} DOT
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3 font-mono text-[13px] text-ld-ink">
                          ${pos.currentValueUsd.toFixed(2)}
                        </td>

                        {/* P&L */}
                        <td className="px-4 py-3">
                          <div
                            className={`font-mono text-[13px] font-medium ${
                              pnlPositive
                                ? "text-[#00C853]"
                                : "text-[#E53935]"
                            }`}
                          >
                            {pnlPositive ? "+" : ""}
                            {pos.pnlPercent.toFixed(2)}%
                          </div>
                          <div
                            className={`font-mono text-[11px] ${
                              pnlPositive
                                ? "text-[#00C853]/60"
                                : "text-[#E53935]/60"
                            }`}
                          >
                            {pnlPositive ? "+" : ""}$
                            {pos.pnlUsd.toFixed(2)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={pos.status} variant="position" />
                        </td>

                        {/* Transactions */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {pos.assetHubTxHash ? (
                              <ExplorerLink
                                chainId="asset-hub"
                                hash={pos.assetHubTxHash}
                                className="text-[11px]"
                              />
                            ) : (
                              <span className="text-[11px] text-ld-slate/40">
                                —
                              </span>
                            )}
                            {pos.moonbeamTxHash ? (
                              <ExplorerLink
                                chainId="moonbeam"
                                hash={pos.moonbeamTxHash}
                                className="text-[11px]"
                              />
                            ) : (
                              <span className="text-[11px] text-ld-slate/40">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="flex flex-col gap-3 md:hidden">
            <AnimatePresence mode="wait">
              {filtered.map((pos, i) => {
                const { t0, t1 } = getTokens(pos.poolName);
                const pnlPositive = pos.pnlUsd >= 0;

                return (
                  <motion.div
                    key={pos.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: i * 0.03,
                    }}
                    className="cursor-pointer rounded-xl border border-black/6 bg-ld-light-1 p-4"
                    onClick={() => {
                      window.location.href = `/dashboard/positions/${pos.id}`;
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          <span
                            className="inline-block h-5 w-5 rounded-full border-2 border-white"
                            style={{
                              backgroundColor: TOKEN_COLORS[t0] ?? "#6B8299",
                            }}
                          />
                          <span
                            className="-ml-1.5 inline-block h-5 w-5 rounded-full border-2 border-white"
                            style={{
                              backgroundColor: TOKEN_COLORS[t1] ?? "#6B8299",
                            }}
                          />
                        </div>
                        <span className="font-display text-sm font-semibold">
                          {pos.poolName}
                        </span>
                      </div>
                      <StatusBadge status={pos.status} variant="position" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-ld-slate">Amount </span>
                        <span className="font-mono">
                          {pos.amountDot.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ld-slate">Value </span>
                        <span className="font-mono">
                          ${pos.currentValueUsd.toFixed(2)}
                        </span>
                      </div>
                      <div
                        className={`font-mono font-medium ${
                          pnlPositive ? "text-[#00C853]" : "text-[#E53935]"
                        }`}
                      >
                        {pnlPositive ? "+" : ""}
                        {pos.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
