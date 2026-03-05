"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "motion/react";

export function ProblemSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section ref={ref} className="bg-ld-light-1 py-[120px]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-[80px] px-10 lg:grid-cols-[0.55fr_0.45fr]">
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2 className="text-display mb-7">
            Managing liquidity
            <br />
            shouldn&apos;t be a
            <br />
            full-time job
          </h2>
          <p className="mb-4 text-lg font-light leading-[1.7] text-ld-slate">
            Today&apos;s liquidity providers face a brutal reality: monitoring
            positions across multiple DEXes, manually rebalancing when prices
            shift, and watching helplessly as{" "}
            <strong className="font-medium text-ld-primary">
              impermanent loss
            </strong>{" "}
            erodes their returns.
          </p>
          <p className="mb-4 text-lg font-light leading-[1.7] text-ld-slate">
            Most LP tools are confined to a single chain with no automated risk
            management.{" "}
            <strong className="font-medium text-ld-polkadot-pink">
              Cross-chain fragmentation
            </strong>{" "}
            means managing separate interfaces, separate wallets, separate
            strategies.
          </p>
          <p className="text-lg font-light leading-[1.7] text-ld-slate">
            The result? Hours of{" "}
            <strong className="font-medium text-ld-primary">
              manual rebalancing
            </strong>
            , missed exit opportunities, and capital efficiency that&apos;s a
            fraction of what it could be.
          </p>
        </motion.div>

        {/* Image */}
        <motion.div
          initial={{ clipPath: "inset(0 100% 0 0)", scale: 1.05 }}
          animate={
            isInView ? { clipPath: "inset(0 0% 0 0)", scale: 1 } : {}
          }
          transition={{
            duration: 1,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.2,
          }}
        >
          <Image
            src="/images/problem-editorial.png"
            alt="The complexity of manual LP management"
            width={600}
            height={400}
            className="rounded-[var(--ld-radius)] shadow-[var(--shadow-heavy)]"
          />
        </motion.div>
      </div>
    </section>
  );
}
