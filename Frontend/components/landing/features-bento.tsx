"use client";

import Image from "next/image";
import { motion } from "motion/react";
import {
  staggerContainerVariants,
  bentoCardVariants,
} from "@/lib/landing/motion-variants";

const FEATURES = [
  {
    title: "Stop-Loss & Take-Profit",
    desc: "Set asymmetric exit thresholds. When price breaches your range, positions auto-liquidate. 24/7 monitoring means you never miss an exit.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px] text-ld-primary">
        <path d="M12 22V8M5 12l7-4 7 4M5 16l7-4 7 4" />
      </svg>
    ),
    image: "/images/feature-stoploss-range.png",
    imageAlt: "Stop-loss and take-profit range",
    size: "large" as const,
    iconBg: "bg-ld-primary/8",
  },
  {
    title: "Asymmetric Ranges",
    desc: "Express directional views. Set -5% stop-loss with +15% take-profit, or any combination. Different downside and upside percentages for tailored risk.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px] text-ld-primary">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    image: "/images/feature-asymmetric.png",
    imageAlt: "Asymmetric range configurations",
    size: "tall" as const,
    iconBg: "bg-ld-primary/8",
  },
  {
    title: "Smart Rebalancing",
    desc: "Only rebalances when profitable after gas costs. Cost-benefit analysis on every action prevents wasteful transactions in volatile markets.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px] text-ld-primary">
        <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
        <polyline points="21 3 21 9 15 9" />
        <polyline points="3 21 3 15 9 15" />
      </svg>
    ),
    size: "normal" as const,
    iconBg: "bg-ld-primary/8",
  },
  {
    title: "Cross-Chain via XCM",
    desc: (
      <>
        Native{" "}
        <span className="font-medium text-ld-polkadot-pink">Polkadot</span>{" "}
        messaging. No bridges. No wrapped tokens. Your assets move between
        parachains using the protocol&apos;s own cross-chain standard.
      </>
    ),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E6007A" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px]">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    size: "normal" as const,
    iconBg: "bg-ld-polkadot-pink/6",
  },
  {
    title: "Risk-Adjusted Scoring",
    desc: "IL risk factored into every APY calculation. Pools scored by TVL depth, age, and token trust — not just headline rates.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px] text-ld-primary">
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </svg>
    ),
    size: "normal" as const,
    iconBg: "bg-ld-primary/8",
  },
  {
    title: "Secure Custody",
    desc: (
      <>
        Funds held on Asset Hub —{" "}
        <span className="font-medium text-ld-polkadot-pink">
          Polkadot&apos;s
        </span>{" "}
        most secure parachain. Only moved when actively providing liquidity.
        Emergency pause available.
      </>
    ),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#E6007A" strokeWidth="2" strokeLinecap="round" className="h-[22px] w-[22px]">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    size: "normal" as const,
    iconBg: "bg-ld-polkadot-pink/8",
  },
];

export function FeaturesBento() {
  return (
    <section className="bg-ld-light-2 py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <h2 className="text-display mb-4">
          Built for serious
          <br />
          liquidity providers
        </h2>
        <p className="mb-14 max-w-[560px] text-lg text-ld-slate">
          Every feature designed to maximize yield while minimizing risk.
        </p>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          style={{ gridAutoRows: "auto" }}
        >
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              variants={bentoCardVariants}
              className={`group relative overflow-hidden rounded-[var(--ld-radius)] bg-white p-8 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)] ${
                feature.size === "large"
                  ? "md:col-span-2"
                  : feature.size === "tall"
                    ? "row-span-2"
                    : ""
              }`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconBg}`}
              >
                {feature.icon}
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold tracking-[-0.3px]">
                {feature.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-ld-slate">
                {feature.desc}
              </p>
              {feature.image && (
                <Image
                  src={feature.image}
                  alt={feature.imageAlt ?? ""}
                  width={500}
                  height={feature.size === "tall" ? 400 : 200}
                  className={`mt-5 rounded-[10px] ${
                    feature.size === "large"
                      ? "max-h-[200px] object-contain"
                      : "w-full"
                  }`}
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
