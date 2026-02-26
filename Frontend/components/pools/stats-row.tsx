"use client";

import { motion } from "motion/react";
import { AnimatedCounter } from "@/components/shared/animated-counter";

interface StatCard {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  subtitle: string;
  color: string;
}

const STATS: StatCard[] = [
  {
    label: "Total Pools",
    value: 24,
    decimals: 0,
    subtitle: "Across 2 chains",
    color: "text-ld-ink",
  },
  {
    label: "Combined TVL",
    value: 21.0,
    prefix: "$",
    suffix: "M",
    decimals: 1,
    subtitle: "Total value locked",
    color: "text-ld-primary",
  },
  {
    label: "Avg APR",
    value: 13.3,
    suffix: "%",
    decimals: 1,
    subtitle: "Weighted average",
    color: "text-ld-success",
  },
  {
    label: "24h Volume",
    value: 3.9,
    prefix: "$",
    suffix: "M",
    decimals: 1,
    subtitle: "Last 24 hours",
    color: "text-ld-ink",
  },
];

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

export function StatsRow() {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {STATS.map((stat) => (
        <motion.div
          key={stat.label}
          variants={cardVariants}
          className="rounded-[var(--ld-radius-sm)] bg-white p-5 shadow-[var(--shadow-card)]"
        >
          <div className="mb-1 font-body text-xs text-ld-slate">
            {stat.label}
          </div>
          <div className={`font-display text-2xl font-bold ${stat.color}`}>
            <AnimatedCounter
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              decimals={stat.decimals ?? 2}
              duration={1}
            />
          </div>
          <div className="mt-1 font-body text-[11px] text-ld-slate">
            {stat.subtitle}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
