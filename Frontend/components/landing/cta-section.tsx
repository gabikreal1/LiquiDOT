"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  staggerContainerVariants,
  ctaVariants,
} from "@/lib/landing/motion-variants";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-ld-polkadot-pink/8 bg-ld-dark py-[120px] text-center">
      {/* Background image */}
      <img
        src="/images/cta-atmosphere.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      {/* Radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(230,0,122,0.04)_0%,transparent_70%)]" />

      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-20%" }}
        className="relative z-10 mx-auto max-w-[1240px] px-10"
      >
        <motion.h2
          variants={ctaVariants}
          className="text-display mb-5 text-ld-frost"
          style={{ fontSize: "clamp(40px, 5vw, 72px)" }}
        >
          Ready to put your
          <br />
          liquidity to work?
        </motion.h2>
        <motion.p
          variants={ctaVariants}
          className="mb-9 text-lg text-ld-slate"
        >
          Connect your wallet and start earning in minutes.
        </motion.p>
        <motion.div variants={ctaVariants}>
          <Link
            href="/dashboard"
            className="inline-block rounded-xl bg-ld-accent px-12 py-[18px] font-body text-[17px] font-medium text-ld-dark transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(0,229,160,0.3)]"
          >
            Connect Wallet
          </Link>
        </motion.div>
        <motion.p
          variants={ctaVariants}
          className="mt-5 text-xs text-ld-slate"
        >
          Supports: Talisman · SubWallet ·{" "}
          <span className="text-ld-polkadot-pink/50">Polkadot.js</span> ·
          MetaMask
        </motion.p>
      </motion.div>
    </section>
  );
}
