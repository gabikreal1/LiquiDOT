"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useAuthStore } from "@/lib/store/auth-store";
import { getDashboard } from "@/lib/api/dashboard";
import { usePositionSSE } from "@/lib/hooks/use-sse";
import { PortfolioCard } from "@/components/dashboard/portfolio-card";
import { StrategyStrip } from "@/components/dashboard/strategy-strip";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { ChainStatus } from "@/components/dashboard/chain-status";
import { VaultPanel } from "@/components/wallet/vault-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { mockPreferences } from "@/lib/mock/preferences";

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export default function DashboardPage() {
  const { userId } = useAuthStore();
  const [vaultOpen, setVaultOpen] = useState(false);

  // SSE placeholder
  usePositionSSE(userId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => getDashboard(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10">
        <div className="mb-8 h-8 w-48 animate-pulse rounded bg-ld-light-2" />
        <div className="mb-6 h-[240px] animate-pulse rounded-[20px] bg-ld-light-2" />
        <div className="mb-6 h-16 animate-pulse rounded-xl bg-ld-light-2" />
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-[320px] animate-pulse rounded-xl bg-ld-light-2" />
          <div className="h-[320px] animate-pulse rounded-xl bg-ld-light-2" />
        </div>
        <div className="h-[300px] animate-pulse rounded-xl bg-ld-light-2" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-xl bg-red-50 py-16"
        >
          <p className="mb-2 text-lg font-medium text-red-700">
            Failed to load dashboard
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-red-600 underline"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Page header */}
      <motion.div variants={sectionVariants} className="mb-8">
        <h1 className="font-display text-[32px] font-bold tracking-[-0.5px] text-ld-ink">
          Dashboard
        </h1>
      </motion.div>

      {/* Portfolio Overview */}
      <motion.div variants={sectionVariants} className="mb-6">
        <PortfolioCard
          data={data}
          onDeposit={() => setVaultOpen(true)}
          onWithdraw={() => setVaultOpen(true)}
        />
      </motion.div>

      {/* Strategy Strip */}
      <motion.div variants={sectionVariants} className="mb-6">
        <StrategyStrip strategy={mockPreferences} />
      </motion.div>

      {/* Mid row: Chart + Activity */}
      <motion.div
        variants={sectionVariants}
        className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
            Pool Allocations
          </h2>
          <DonutChart pools={data.pools} />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
            Recent Activity
          </h2>
          <ActivityFeed activities={data.recentActivity} />
        </div>
      </motion.div>

      {/* Positions Table */}
      <motion.div
        variants={sectionVariants}
        className="mb-6 rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
      >
        <h2 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
          Positions
        </h2>
        <PositionsTable positions={data.positions} />
      </motion.div>

      {/* Chain Status */}
      <motion.div variants={sectionVariants}>
        <ChainStatus />
      </motion.div>

      {/* Vault Deposit/Withdraw Dialog */}
      <Dialog open={vaultOpen} onOpenChange={setVaultOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vault</DialogTitle>
            <DialogDescription>
              Deposit or withdraw DOT from the LiquiDOT vault on Asset Hub.
            </DialogDescription>
          </DialogHeader>
          <VaultPanel />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
