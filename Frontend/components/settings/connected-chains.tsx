"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";

interface ChainCardData {
  name: string;
  badge: string;
  badgeColor: string;
  iconBg: string;
  iconText: string;
  opacity: string;
  status: "live" | "coming" | "planned";
}

const chains: ChainCardData[] = [
  {
    name: "Asset Hub",
    badge: "LIVE",
    badgeColor: "border-green-500/30 bg-green-500/10 text-green-600",
    iconBg: "bg-ld-polkadot-pink/10",
    iconText: "text-ld-polkadot-pink",
    opacity: "opacity-100",
    status: "live",
  },
  {
    name: "Moonbeam",
    badge: "LIVE",
    badgeColor: "border-green-500/30 bg-green-500/10 text-green-600",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-600",
    opacity: "opacity-100",
    status: "live",
  },
  {
    name: "Hydration",
    badge: "COMING SOON",
    badgeColor: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
    iconBg: "bg-ld-slate/10",
    iconText: "text-ld-slate",
    opacity: "opacity-60",
    status: "coming",
  },
  {
    name: "Astar",
    badge: "PLANNED",
    badgeColor: "border-gray-400/30 bg-gray-400/10 text-gray-500",
    iconBg: "bg-ld-slate/10",
    iconText: "text-ld-slate",
    opacity: "opacity-45",
    status: "planned",
  },
];

const staggerDelay: Record<string, number> = {
  live: 0,
  coming: 0.15,
  planned: 0.25,
};

export function ConnectedChains() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
    >
      <h3 className="mb-4 text-lg font-semibold text-ld-ink">Connected Chains</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {chains.map((chain) => (
          <motion.div
            key={chain.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              delay: 0.2 + staggerDelay[chain.status],
              ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
            }}
            className={`flex items-center gap-3 rounded-xl border border-ld-gray/20 bg-white p-4 shadow-sm ${chain.opacity}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${chain.iconBg}`}
            >
              <span className={`text-sm font-bold ${chain.iconText}`}>
                {chain.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ld-ink">{chain.name}</p>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-medium ${chain.badgeColor}`}
            >
              {chain.badge}
            </Badge>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
