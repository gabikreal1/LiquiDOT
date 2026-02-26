"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  staggerContainerVariants,
  tableRowVariants,
  fadeUpVariants,
} from "@/lib/landing/motion-variants";

const TOKEN_COLORS: Record<string, string> = {
  xcDOT: "#E6007A",
  WGLMR: "#627EEA",
  USDC: "#2775CA",
  WETH: "#627EEA",
  WBTC: "#F7931A",
};

const POOLS = [
  { pair: "xcDOT / WGLMR", t0: "xcDOT", t1: "WGLMR", apr: "18.42%", tvl: "$2,340,000", vol: "$456,000", fee: "0.30%" },
  { pair: "xcDOT / USDC", t0: "xcDOT", t1: "USDC", apr: "14.87%", tvl: "$1,890,000", vol: "$312,000", fee: "0.30%" },
  { pair: "WGLMR / USDC", t0: "WGLMR", t1: "USDC", apr: "12.15%", tvl: "$5,120,000", vol: "$890,000", fee: "0.05%" },
  { pair: "WETH / USDC", t0: "WETH", t1: "USDC", apr: "11.20%", tvl: "$8,200,000", vol: "$1,240,000", fee: "0.30%" },
  { pair: "WBTC / USDC", t0: "WBTC", t1: "USDC", apr: "9.85%", tvl: "$3,450,000", vol: "$567,000", fee: "0.30%" },
];

export function PoolsPreview() {
  return (
    <section className="bg-ld-light-1 py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
        >
          <h2 className="text-display mb-3">Top performing pools</h2>
          <p className="mb-9 text-lg text-ld-slate">
            Live data from integrated DEXes. Updated every block.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="overflow-hidden rounded-[var(--ld-radius)] bg-white shadow-[var(--shadow-card)]"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Pool", "APR", "TVL", "Volume 24h", "Fee Tier"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-black/6 bg-ld-polkadot-pink/[0.015] px-6 py-4 text-left font-body text-xs font-medium uppercase tracking-[0.5px] text-ld-slate"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {POOLS.map((pool) => (
                <motion.tr
                  key={pool.pair}
                  variants={tableRowVariants}
                  className="border-b border-black/3 last:border-b-0 even:bg-black/[0.008]"
                >
                  <td className="px-6 py-[18px]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex">
                        <span
                          className="inline-block h-[22px] w-[22px] rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
                          style={{
                            backgroundColor:
                              TOKEN_COLORS[pool.t0] ?? "#6B8299",
                          }}
                        />
                        <span
                          className="-ml-2 inline-block h-[22px] w-[22px] rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
                          style={{
                            backgroundColor:
                              TOKEN_COLORS[pool.t1] ?? "#6B8299",
                          }}
                        />
                      </div>
                      <span className="font-display text-sm font-semibold text-ld-ink">
                        {pool.pair}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-[18px] font-mono text-sm font-medium text-ld-success">
                    {pool.apr}
                  </td>
                  <td className="px-6 py-[18px] font-mono text-sm">
                    {pool.tvl}
                  </td>
                  <td className="px-6 py-[18px] font-mono text-sm">
                    {pool.vol}
                  </td>
                  <td className="px-6 py-[18px] font-mono text-sm">
                    {pool.fee}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          <Link
            href="/pools"
            className="block py-5 text-center font-body text-sm font-medium text-ld-primary transition-colors hover:text-ld-primary/80"
          >
            Explore All Pools →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
