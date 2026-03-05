"use client";

import { motion } from "motion/react";
import {
  staggerContainerVariants,
  chainCardVariants,
} from "@/lib/landing/motion-variants";

const CHAINS = [
  {
    name: "Asset Hub",
    role: "Custody Layer",
    roleColor: "#E6007A",
    desc: "Secure DOT deposit and accounting. Battle-tested vault contract with emergency controls. Your funds' home base.",
    status: "LIVE",
    statusClass: "text-ld-success bg-ld-success/10",
    cardClass: "border-l-[3px] border-l-ld-polkadot-pink shadow-[var(--shadow-card)] bg-white",
    iconBg: "bg-ld-polkadot-pink/8",
    opacity: 1,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E6007A" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
  },
  {
    name: "Moonbeam",
    role: "Execution Layer",
    roleColor: "#0D6B58",
    desc: "LP position management on Algebra DEX and StellaSwap Pulsar. Token swaps, minting, monitoring, and automated liquidations.",
    status: "LIVE",
    statusClass: "text-ld-success bg-ld-success/10",
    cardClass: "border-l-[3px] border-l-ld-primary shadow-[var(--shadow-card)] bg-white",
    iconBg: "bg-[#627EEA]/10",
    opacity: 1,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#627EEA" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M7 9l5 3 5-3M7 15l5-3 5 3" />
      </svg>
    ),
  },
  {
    name: "Hydration",
    role: "Multi-Asset DEX",
    roleColor: "#F5A623",
    desc: "Omnipool integration for efficient multi-asset liquidity provision with single-sided deposits.",
    status: "COMING SOON",
    statusClass: "text-ld-warm bg-ld-warm/10",
    cardClass: "opacity-65 border border-dashed border-black/10 bg-white/60",
    iconBg: "bg-ld-warm/8",
    opacity: 0.65,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20" />
      </svg>
    ),
  },
  {
    name: "Astar",
    role: "WASM + EVM dApp Hub",
    roleColor: "#6B8299",
    desc: "Multi-VM environment supporting both WASM and EVM smart contracts for maximum DEX coverage.",
    status: "PLANNED",
    statusClass: "text-ld-slate bg-ld-slate/10",
    cardClass: "opacity-45 border border-dashed border-black/6 bg-white/40",
    iconBg: "bg-ld-slate/8",
    opacity: 0.45,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B8299" strokeWidth="2">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
        <line x1="12" y1="22" x2="12" y2="15.5" />
      </svg>
    ),
  },
];

export function ChainsSection() {
  return (
    <section className="bg-ld-light-2 py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="text-eyebrow mb-3 text-ld-polkadot-pink">
          Cross-Chain Coverage
        </div>
        <h2 className="text-display mb-3">
          Multiple chains,
          <br />
          one interface
        </h2>
        <p className="mb-12 text-lg text-ld-slate">
          Manage liquidity across Polkadot&apos;s ecosystem from a single
          dashboard.
        </p>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-15%" }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          {CHAINS.map((chain, i) => (
            <motion.div
              key={chain.name}
              variants={chainCardVariants(chain.opacity, i * 0.1)}
              className={`relative rounded-[var(--ld-radius)] p-8 ${chain.cardClass}`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${chain.iconBg}`}
                >
                  {chain.icon}
                </div>
                <h3 className="font-display text-xl font-semibold">
                  {chain.name}
                </h3>
              </div>
              <span
                className={`absolute right-6 top-6 rounded-[6px] px-2.5 py-0.5 text-[11px] font-medium ${chain.statusClass}`}
              >
                {chain.status}
              </span>
              <div
                className="mb-2 text-[13px] font-medium"
                style={{ color: chain.roleColor }}
              >
                {chain.role}
              </div>
              <p className="text-sm leading-[1.6] text-ld-slate">
                {chain.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
