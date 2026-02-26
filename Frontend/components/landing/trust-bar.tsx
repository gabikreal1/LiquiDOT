"use client";

import { motion } from "motion/react";
import {
  staggerContainerVariants,
  trustLogoVariants,
} from "@/lib/landing/motion-variants";

const LOGOS = [
  {
    name: "Polkadot",
    color: "#E6007A",
    opacity: 0.55,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" style={{ color: "#E6007A" }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="4" r="2" fill="currentColor" />
        <circle cx="12" cy="20" r="2" fill="currentColor" />
        <circle cx="4" cy="12" r="2" fill="currentColor" />
        <circle cx="20" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Asset Hub",
    color: undefined,
    opacity: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
  },
  {
    name: "Moonbeam",
    color: undefined,
    opacity: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M7 9l5 3 5-3M7 15l5-3 5 3" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    name: "Algebra",
    color: undefined,
    opacity: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12a8 8 0 0116 0" />
        <path d="M8 12a4 4 0 018 0" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "StellaSwap",
    color: undefined,
    opacity: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l8 6v8l-8 6-8-6V8l8-6z" />
        <path d="M12 8v8" />
      </svg>
    ),
  },
];

export function TrustBar() {
  return (
    <section className="border-b border-black/4 bg-ld-light-1 py-12">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-center gap-8 px-10 sm:flex-row sm:gap-12">
        <span className="whitespace-nowrap text-xs font-medium uppercase tracking-[1px] text-ld-slate">
          Built on
        </span>
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-12%" }}
          className="flex flex-wrap items-center justify-center gap-10"
        >
          {LOGOS.map((logo) => (
            <motion.div
              key={logo.name}
              variants={trustLogoVariants}
              className="flex items-center gap-2 transition-opacity duration-200 hover:!opacity-70"
              style={{ opacity: logo.opacity }}
            >
              <span style={{ color: logo.color }}>{logo.icon}</span>
              <span
                className="font-display text-sm font-medium text-ld-ink"
                style={logo.color ? { color: logo.color } : undefined}
              >
                {logo.name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
