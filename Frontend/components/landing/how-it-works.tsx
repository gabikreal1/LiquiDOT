"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: "01",
    title: "Deposit DOT",
    titleSuffix: (
      <span className="ml-1 inline-block h-2 w-2 rounded-full bg-ld-polkadot-pink align-middle" />
    ),
    desc: "Deposit DOT to the Asset Hub vault. Your funds stay in Polkadot's most secure custody layer until they're actively working in a pool.",
    visual: "image" as const,
    imageSrc: "/images/step-deposit-ui.png",
    imageAlt: "Deposit interface",
  },
  {
    num: "02",
    title: "Configure Strategy",
    titleSuffix: null,
    desc: "Set your risk tolerance, APY targets, allowed tokens, and asymmetric stop-loss/take-profit ranges. Or pick a preset — Conservative, Balanced, or Aggressive.",
    visual: "image" as const,
    imageSrc: "/images/step-strategy-ui.png",
    imageAlt: "Strategy configuration",
  },
  {
    num: "03",
    title: "Auto-LP Positions",
    titleSuffix: null,
    desc: "LiquiDOT's Investment Decision Worker continuously evaluates pools, scores them for risk-adjusted yield, and mints LP positions that match your strategy.",
    visual: "svg" as const,
  },
  {
    num: "04",
    title: "Earn & Protect",
    titleSuffix: null,
    desc: "Stop-loss and take-profit trigger automatically when prices breach your thresholds. Smart rebalancing only fires when profitable after gas costs. You earn while you sleep.",
    visual: "pnl" as const,
  },
];

// Map progress to step with generous hold zones between transitions
// 4 steps: each gets ~25% of scroll, transitions happen at these thresholds
const STEP_THRESHOLDS = [0.27, 0.52, 0.76]; // step 0→1, 1→2, 2→3

function progressToStep(progress: number): number {
  for (let i = STEP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (progress >= STEP_THRESHOLDS[i]) return i + 1;
  }
  return 0;
}

function PoolMatchingSvg() {
  return (
    <div className="flex items-center justify-center">
      <svg width="320" height="200" viewBox="0 0 320 200" fill="none" className="max-w-full">
        <rect x="20" y="20" width="120" height="50" rx="10" fill="#F8FAF9" stroke="#0D6B58" strokeWidth="1.5" />
        <text x="80" y="42" textAnchor="middle" fill="#1A2332" fontFamily="var(--font-display)" fontSize="11" fontWeight="600">Your Strategy</text>
        <text x="80" y="58" textAnchor="middle" fill="#6B8299" fontFamily="var(--font-body)" fontSize="10">8% min APY · -5/+10</text>
        <rect x="180" y="10" width="120" height="40" rx="8" fill="#F8FAF9" stroke="#00E5A0" strokeWidth="1.5" />
        <text x="240" y="34" textAnchor="middle" fill="#0D6B58" fontFamily="var(--font-mono)" fontSize="10">xcDOT/WGLMR 18%</text>
        <rect x="180" y="60" width="120" height="40" rx="8" fill="#F8FAF9" stroke="#00E5A0" strokeWidth="1" />
        <text x="240" y="84" textAnchor="middle" fill="#0D6B58" fontFamily="var(--font-mono)" fontSize="10">xcDOT/USDC 14%</text>
        <rect x="180" y="110" width="120" height="40" rx="8" fill="#F8FAF9" stroke="rgba(0,0,0,0.1)" strokeWidth="1" strokeDasharray="4 2" />
        <text x="240" y="134" textAnchor="middle" fill="#6B8299" fontFamily="var(--font-mono)" fontSize="10">WGLMR/USDC 5%</text>
        <line x1="140" y1="45" x2="180" y2="30" stroke="#00E5A0" strokeWidth="1.5" />
        <line x1="140" y1="45" x2="180" y2="80" stroke="#00E5A0" strokeWidth="1" />
        <line x1="140" y1="45" x2="180" y2="130" stroke="#ccc" strokeWidth="1" strokeDasharray="4 2" />
        <text x="160" y="170" textAnchor="middle" fill="#6B8299" fontFamily="var(--font-body)" fontSize="9">Filtered by APY, TVL, risk score</text>
        <circle cx="174" cy="28" r="4" fill="#00E5A0" />
        <circle cx="174" cy="78" r="4" fill="#00E5A0" opacity="0.6" />
        <circle cx="174" cy="128" r="4" fill="#ccc" opacity="0.4" />
      </svg>
    </div>
  );
}

function PnlCard() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-[300px] rounded-[var(--ld-radius)] bg-white p-7 shadow-[var(--shadow-card)]">
        <div className="mb-4 font-display text-base font-semibold">
          P&L Summary
        </div>
        <div className="mb-2.5 flex justify-between">
          <span className="text-[13px] text-ld-slate">Fees Earned</span>
          <span className="font-mono text-[13px] text-ld-success">
            +$12.50
          </span>
        </div>
        <div className="mb-2.5 flex justify-between">
          <span className="text-[13px] text-ld-slate">IL Loss</span>
          <span className="font-mono text-[13px] text-ld-danger">
            -$2.00
          </span>
        </div>
        <div className="my-3.5 h-px bg-black/6" />
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold">
            Net P&L
          </span>
          <span className="font-mono text-lg font-medium text-ld-success">
            +$25.00 (+7.14%)
          </span>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !sectionRef.current) return;

    // Skip scroll-driven pinning when reduced motion is preferred
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      pin: true,
      scrub: 1.5,
      start: "top top",
      end: "+=350%",
      anticipatePin: 1,
      onUpdate: (self) => {
        const step = progressToStep(self.progress);
        setActiveStep(step);
      },
    });

    return () => {
      trigger.kill();
    };
  }, [isMobile]);

  // Mobile: simple stacked layout
  if (isMobile) {
    return (
      <section className="bg-ld-light-1 py-[120px]">
        <div className="mx-auto max-w-[1240px] px-10">
          <h2 className="text-display mb-3">
            Four steps to
            <br />
            automated yield
          </h2>
          <p className="mb-16 text-lg text-ld-slate">
            From deposit to earnings in under five minutes.
          </p>
          <div className="flex flex-col gap-20">
            {STEPS.map((step) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
                className="grid grid-cols-1 gap-8"
              >
                <div>
                  <div className="mb-2 font-display text-[64px] font-bold leading-none text-ld-accent/20">
                    {step.num}
                  </div>
                  <h3 className="mb-3 font-display text-[28px] font-semibold tracking-[-0.5px]">
                    {step.title}
                    {step.titleSuffix}
                  </h3>
                  <p className="text-base leading-[1.7] text-ld-slate">
                    {step.desc}
                  </p>
                </div>
                <div>
                  {step.visual === "image" && step.imageSrc && (
                    <Image
                      src={step.imageSrc}
                      alt={step.imageAlt ?? ""}
                      width={380}
                      height={475}
                      className="max-w-[380px] rounded-[var(--ld-radius)] shadow-[var(--shadow-card)]"
                    />
                  )}
                  {step.visual === "svg" && <PoolMatchingSvg />}
                  {step.visual === "pnl" && <PnlCard />}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Desktop: pinned scroll-driven
  return (
    <section ref={sectionRef} className="relative bg-ld-light-1">
      <div className="flex min-h-screen items-center">
        <div className="mx-auto max-w-[1240px] px-10 py-[120px]">
          <div className="mb-16">
            <h2 className="text-display mb-3">
              Four steps to
              <br />
              automated yield
            </h2>
            <p className="text-lg text-ld-slate">
              From deposit to earnings in under five minutes.
            </p>
          </div>

          {/* Progress indicators */}
          <div className="mb-12 flex items-center gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-xs font-medium transition-all duration-500 ${
                    i <= activeStep
                      ? "border-ld-accent bg-ld-accent text-ld-dark"
                      : "border-ld-accent/30 text-ld-slate"
                  }`}
                >
                  {step.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-0.5 w-12 rounded-full bg-ld-frost">
                    <div
                      className="h-full rounded-full bg-ld-accent transition-all duration-500"
                      style={{
                        width: i < activeStep ? "100%" : "0%",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Active step content */}
          <div className="grid grid-cols-1 items-center gap-[60px] lg:grid-cols-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-${activeStep}`}
                initial={{ opacity: 0, x: activeStep % 2 === 0 ? -60 : 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              >
                <div className="mb-2 font-display text-[64px] font-bold leading-none text-ld-accent/20">
                  {STEPS[activeStep].num}
                </div>
                <h3 className="mb-3 font-display text-[28px] font-semibold tracking-[-0.5px]">
                  {STEPS[activeStep].title}
                  {STEPS[activeStep].titleSuffix}
                </h3>
                <p className="max-w-[460px] text-base leading-[1.7] text-ld-slate">
                  {STEPS[activeStep].desc}
                </p>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`visual-${activeStep}`}
                initial={{
                  opacity: 0,
                  x: activeStep % 2 === 0 ? 80 : -80,
                  scale: 0.9,
                }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              >
                {STEPS[activeStep].visual === "image" &&
                  STEPS[activeStep].imageSrc && (
                    <Image
                      src={STEPS[activeStep].imageSrc!}
                      alt={STEPS[activeStep].imageAlt ?? ""}
                      width={380}
                      height={475}
                      className="max-w-[380px] rounded-[var(--ld-radius)] shadow-[var(--shadow-card)]"
                    />
                  )}
                {STEPS[activeStep].visual === "svg" && <PoolMatchingSvg />}
                {STEPS[activeStep].visual === "pnl" && <PnlCard />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
