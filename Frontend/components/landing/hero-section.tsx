"use client";

import { Suspense, lazy } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  heroContainerVariants,
  heroItemVariants,
  floatingCardVariants,
} from "@/lib/landing/motion-variants";

const HeroPlanet = lazy(() =>
  import("./hero-planet").then((m) => ({ default: m.HeroPlanet }))
);

function HeroFallback() {
  return <div className="aspect-[4/3] w-full" />;
}

export function HeroSection() {
  return (
    <section className="hero-section relative overflow-hidden bg-ld-dark pt-[140px] pb-[100px]">
      {/* Background video */}
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-60"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/videos/hero-particles.mp4" type="video/mp4" />
      </video>

      {/* Radial gradient overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(230,0,122,0.04)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(13,107,88,0.06)_0%,transparent_50%)]" />

      <div className="relative z-10 mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-[60px] px-10 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left: Text */}
        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={heroItemVariants}
            className="text-eyebrow mb-6 text-ld-accent"
          >
            Automated LP Management
          </motion.div>

          <motion.h1
            variants={heroItemVariants}
            className="mb-7 font-display text-[clamp(52px,7vw,112px)] font-bold leading-[0.92] tracking-[-3px] text-ld-frost"
          >
            Your liquidity,
            <br />
            on autopilot
          </motion.h1>

          <motion.p
            variants={heroItemVariants}
            className="mb-9 max-w-[480px] text-lg font-light leading-[1.7] text-ld-slate"
          >
            Deposit DOT. Set your strategy. LiquiDOT optimizes your LP positions
            across Polkadot parachains — with stop-loss, take-profit, and
            automated rebalancing.
          </motion.p>

          <motion.div
            variants={heroItemVariants}
            className="mb-10 flex gap-4"
          >
            <Link
              href="/dashboard"
              className="rounded-[10px] bg-ld-accent px-8 py-3.5 font-body text-[15px] font-medium text-ld-dark transition-shadow hover:shadow-[0_0_30px_rgba(0,229,160,0.3)]"
            >
              Launch App
            </Link>
            <Link
              href="/pools"
              className="rounded-[10px] border border-white/20 bg-transparent px-8 py-3.5 font-body text-[15px] font-normal text-ld-frost transition-colors hover:border-white/40"
            >
              View Pools →
            </Link>
          </motion.div>

          <motion.div
            variants={heroItemVariants}
            className="flex items-center gap-8"
          >
            <div>
              <div className="font-mono text-sm font-medium text-ld-frost">
                $2.4M+
              </div>
              <div className="mt-0.5 text-xs text-ld-slate">
                Total Value Locked
              </div>
            </div>
            <span className="h-1 w-1 rounded-full bg-ld-polkadot-pink/40" />
            <div>
              <div className="font-mono text-sm font-medium text-ld-frost">
                12+
              </div>
              <div className="mt-0.5 text-xs text-ld-slate">Active Pools</div>
            </div>
            <span className="h-1 w-1 rounded-full bg-ld-polkadot-pink/40" />
            <div>
              <div className="font-mono text-sm font-medium text-ld-frost">
                24/7
              </div>
              <div className="mt-0.5 text-xs text-ld-slate">Monitored</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right: 3D Planet or fallback */}
        <div className="relative">
          <Suspense fallback={<HeroFallback />}>
            <div className="aspect-[4/3] w-full">
              <HeroPlanet />
            </div>
          </Suspense>

          {/* Floating card */}
          <motion.div
            variants={floatingCardVariants}
            initial="hidden"
            animate="visible"
            className="absolute -bottom-5 -left-[30px] z-20 flex items-center gap-4 rounded-xl border border-ld-polkadot-pink/15 bg-ld-dark-mid/85 px-5 py-4 shadow-[0_0_30px_rgba(230,0,122,0.06)] backdrop-blur-[16px]"
          >
            <span className="font-display text-sm font-semibold text-ld-frost">
              xcDOT/WGLMR
            </span>
            <span className="font-mono text-[13px] text-ld-success">
              +7.14%
            </span>
            <span className="rounded-[6px] bg-ld-success/12 px-2.5 py-0.5 text-[11px] font-medium text-ld-success">
              Active
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
