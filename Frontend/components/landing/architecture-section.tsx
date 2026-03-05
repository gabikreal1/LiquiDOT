"use client";

import { motion } from "motion/react";
import {
  staggerContainerVariants,
  fadeUpVariants,
} from "@/lib/landing/motion-variants";

const ARCH_CARDS = [
  {
    title: "Custody Layer",
    desc: "Asset Hub Vault Contract holds user deposits with battle-tested vault patterns and emergency controls. Single source of truth for balances.",
    iconBg: "bg-ld-polkadot-pink/10",
    iconColor: "#E6007A",
    borderClass: "border-ld-polkadot-pink/12",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6007A" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Execution Engine",
    desc: "Moonbeam XCM Proxy handles all DEX interactions — token swaps, LP minting, position monitoring, and automated liquidations.",
    iconBg: "bg-ld-accent/12",
    iconColor: "#00E5A0",
    borderClass: "border-white/6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "Cross-Chain Messaging",
    desc: "Native Polkadot XCM carries assets and instructions between parachains. No bridge contracts, no wrapped tokens, no additional trust layer.",
    iconBg: "bg-[#627EEA]/12",
    iconColor: "#627EEA",
    borderClass: "border-white/6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#627EEA" strokeWidth="2" strokeLinecap="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
];

export function ArchitectureSection() {
  return (
    <section className="relative overflow-hidden border-t border-ld-polkadot-pink/8 bg-ld-dark py-[120px]">
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-15%" }}
        className="mx-auto max-w-[1240px] px-10"
      >
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            variants={fadeUpVariants}
            className="text-eyebrow mb-4 text-ld-polkadot-pink"
          >
            System Architecture
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-display text-ld-frost"
          >
            Cross-chain by design,
            <br />
            not by bridge
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="mx-auto mt-4 max-w-[600px] text-lg text-ld-slate"
          >
            LiquiDOT uses{" "}
            <span className="text-ld-polkadot-pink/70">
              Polkadot&apos;s native XCM
            </span>{" "}
            messaging to move assets between parachains. No bridges, no wrapped
            tokens, no trust assumptions.
          </motion.p>
        </div>

        {/* Video */}
        <motion.div
          variants={fadeUpVariants}
          className="mx-auto mb-12 max-w-[1100px] overflow-hidden rounded-[var(--ld-radius)] border border-ld-polkadot-pink/6 shadow-[0_0_60px_rgba(0,229,160,0.06),0_0_120px_rgba(230,0,122,0.03)]"
        >
          <video
            className="block w-full"
            autoPlay
            muted
            loop
            playsInline
          >
            <source
              src="/videos/architecture-flow.mp4"
              type="video/mp4"
            />
          </video>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={staggerContainerVariants}
          className="mx-auto grid max-w-[900px] grid-cols-1 gap-5 md:grid-cols-3"
        >
          {ARCH_CARDS.map((card) => (
            <motion.div
              key={card.title}
              variants={fadeUpVariants}
              className={`rounded-[var(--ld-radius-sm)] border bg-ld-dark-mid p-6 ${card.borderClass}`}
            >
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] ${card.iconBg}`}
              >
                {card.icon}
              </div>
              <h4 className="mb-1.5 font-display text-base font-semibold text-ld-frost">
                {card.title}
              </h4>
              <p className="text-[13px] leading-[1.55] text-ld-slate">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
