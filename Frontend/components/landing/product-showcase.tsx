"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: "01",
    title: "Portfolio at a glance",
    desc: "See your total value, P&L, and active positions in one unified dashboard. Real-time updates via SSE keep you informed without refreshing.",
    image: "/images/product-dashboard.png",
    alt: "LiquiDOT Dashboard",
  },
  {
    num: "02",
    title: "Real-time position tracking",
    desc: "Monitor every LP position with live P&L, status badges, and direct links to on-chain transactions on both Asset Hub and Moonbeam.",
    image: "/images/product-strategy.png",
    alt: "Strategy Config",
  },
  {
    num: "03",
    title: "One-click strategy config",
    desc: "Set your risk tolerance, APY targets, allowed tokens, and asymmetric ranges. Choose a preset or fine-tune every parameter.",
    image: "/images/product-pools.png",
    alt: "Pool Explorer",
  },
];

// Map scroll progress to step with hold zones so each step lingers
// Thresholds define where steps transition — generous gaps between them
const STEP_THRESHOLDS = [0.36, 0.69]; // step 0→1 at 36%, step 1→2 at 69%

function progressToStep(progress: number): number {
  for (let i = STEP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (progress >= STEP_THRESHOLDS[i]) return i + 1;
  }
  return 0;
}

export function ProductShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    // Skip scroll-driven pinning when reduced motion is preferred
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      pin: true,
      scrub: 1.5,
      start: "top top",
      end: "+=250%",
      anticipatePin: 1,
      onUpdate: (self) => {
        const step = progressToStep(self.progress);
        setActiveStep(step);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-ld-light-2 py-[120px]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-[60px] px-10 lg:grid-cols-[0.4fr_0.6fr]">
        {/* Left: Steps text */}
        <div className="pt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="mb-2 font-display text-[48px] font-bold text-ld-accent/30">
                {STEPS[activeStep].num}
              </div>
              <h3 className="mb-3 font-display text-[28px] font-semibold tracking-[-0.5px] text-ld-ink">
                {STEPS[activeStep].title}
              </h3>
              <p className="text-base leading-[1.65] text-ld-slate">
                {STEPS[activeStep].desc}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Step indicators */}
          <div className="mt-10 flex gap-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === activeStep
                    ? "w-8 bg-ld-primary"
                    : i < activeStep
                      ? "w-4 bg-ld-primary/40"
                      : "w-1.5 bg-ld-slate/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right: Image stack */}
        <div className="relative">
          <div className="relative">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                className="absolute inset-0"
                style={{
                  position: i === 0 ? "relative" : "absolute",
                  top: i === 0 ? 0 : `${i * 40}px`,
                  left: `${i * 20}px`,
                  width: `${100 - i * 10}%`,
                  zIndex: i === activeStep ? 10 : 3 - i,
                }}
                animate={{
                  opacity: i === activeStep ? 1 : 0.3 - i * 0.1,
                  filter:
                    i === activeStep ? "blur(0px)" : `blur(${i * 2}px)`,
                }}
                transition={{ duration: 0.5 }}
              >
                <Image
                  src={step.image}
                  alt={step.alt}
                  width={800}
                  height={500}
                  className="rounded-[var(--ld-radius)] border border-black/6 shadow-[var(--shadow-heavy)]"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
