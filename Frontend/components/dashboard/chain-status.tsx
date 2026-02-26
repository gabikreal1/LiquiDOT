"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface ChainInfo {
  name: string;
  color: string;
  status: "live" | "degraded" | "down";
}

const CHAINS: ChainInfo[] = [
  { name: "Asset Hub", color: "#E6007A", status: "live" },
  { name: "Moonbeam", color: "#627EEA", status: "live" },
  { name: "XCM Bridge", color: "#00E5A0", status: "live" },
];

export function ChainStatus() {
  const [lastSync, setLastSync] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.35,
        delay: 0.3,
        ease: "easeOut",
      }}
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-6 py-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-center gap-6">
        {CHAINS.map((chain) => (
          <div key={chain.name} className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${chain.color}15` }}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: chain.color }}
              />
            </div>
            <div>
              <div className="font-display text-[13px] font-semibold text-ld-ink">
                {chain.name}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      chain.status === "live"
                        ? "#00C853"
                        : chain.status === "degraded"
                          ? "#F5A623"
                          : "#E53935",
                    boxShadow:
                      chain.status === "live"
                        ? "0 0 6px rgba(0,200,83,0.5)"
                        : "none",
                    animation:
                      chain.status === "live"
                        ? "pulse 3s ease-in-out infinite"
                        : "none",
                  }}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#00C853]">
                  Live
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="font-mono text-[11px] text-ld-slate">
        Last sync: {lastSync}s ago
      </span>
    </motion.div>
  );
}
