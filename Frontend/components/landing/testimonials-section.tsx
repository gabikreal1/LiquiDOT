"use client";

import Image from "next/image";
import { motion } from "motion/react";
import {
  staggerContainerVariants,
  fadeUpVariants,
} from "@/lib/landing/motion-variants";

const TESTIMONIALS = [
  {
    quote:
      "LiquiDOT's asymmetric ranges changed how I think about LP risk. I set -3% stop-loss with +15% take-profit on my xcDOT positions and haven't manually touched them in weeks.",
    name: "Mei Chen",
    role: "DeFi Analyst, Moonbeam Foundation",
    avatar: "/images/avatar-1.png",
    borderColor: "border-t-ld-polkadot-pink/15",
  },
  {
    quote:
      "The cross-chain architecture is what sold me. No bridges, no wrapped tokens — just native XCM. As a protocol engineer, I trust the security model. As an LP, I trust the automation.",
    name: "Karim Osman",
    role: "Protocol Engineer, Parity Technologies",
    avatar: "/images/avatar-2.png",
    borderColor: "border-t-ld-primary/15",
  },
  {
    quote:
      "We moved $400K in LP positions to LiquiDOT. The smart rebalancing alone saved us an estimated $2,800 in unnecessary gas fees in the first month. The stop-loss protection is peace of mind.",
    name: "Adaeze Okonkwo",
    role: "VP Operations, Polkadot DeFi Fund",
    avatar: "/images/avatar-3.png",
    borderColor: "border-t-ld-polkadot-pink/12",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-ld-light-2 py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <h2 className="text-display mb-12">
          Trusted by LPs
          <br />
          across Polkadot
        </h2>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-15%" }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUpVariants}
              className={`rounded-[var(--ld-radius)] border-t-2 bg-white p-8 shadow-[var(--shadow-card)] ${t.borderColor}`}
            >
              <div className="relative mb-6 min-h-[100px] pl-5 text-[15px] font-light italic leading-[1.7] text-ld-ink">
                <span className="absolute left-0 top-1 h-6 w-[3px] rounded-sm bg-gradient-to-b from-ld-polkadot-pink/25 to-ld-polkadot-pink/5" />
                &ldquo;{t.quote}&rdquo;
              </div>
              <div className="flex items-center gap-3.5">
                <Image
                  src={t.avatar}
                  alt={t.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
                <div>
                  <div className="font-display text-sm font-semibold">
                    {t.name}
                  </div>
                  <div className="text-xs text-ld-slate">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
