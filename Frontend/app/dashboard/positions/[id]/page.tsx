"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePositionSSE } from "@/lib/hooks/use-sse";
import { getPosition, getPositionPnl } from "@/lib/api/positions";
import { PositionHero } from "@/components/position/position-hero";
import { RangeVisual } from "@/components/position/range-visual";
import { PnlBreakdown } from "@/components/position/pnl-breakdown";
import { TransactionsCard } from "@/components/position/transactions-card";
import { DetailsCard } from "@/components/position/details-card";
import { PositionTimeline } from "@/components/position/position-timeline";

const cardVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId } = useAuthStore();

  usePositionSSE(userId);

  const { data: position, isLoading: posLoading } = useQuery({
    queryKey: ["position", id],
    queryFn: () => getPosition(id),
  });

  const { data: pnl, isLoading: pnlLoading } = useQuery({
    queryKey: ["position", id, "pnl"],
    queryFn: () => getPositionPnl(id),
  });

  if (posLoading || pnlLoading) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10">
        <div className="mb-6 h-6 w-40 animate-pulse rounded bg-ld-light-2" />
        <div className="mb-6 h-[220px] animate-pulse rounded-[20px] bg-ld-light-2" />
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-[300px] animate-pulse rounded-xl bg-ld-light-2" />
          <div className="h-[300px] animate-pulse rounded-xl bg-ld-light-2" />
        </div>
        <div className="h-[250px] animate-pulse rounded-xl bg-ld-light-2" />
      </div>
    );
  }

  if (!position || !pnl) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-xl bg-red-50 py-16"
        >
          <p className="mb-2 text-lg font-medium text-red-700">
            Position not found
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-red-600 underline"
          >
            Back to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10"
    >
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-ld-slate transition-colors hover:text-ld-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Hero */}
        <motion.div variants={cardVariants} className="mb-6">
          <PositionHero position={position} />
        </motion.div>

        {/* Row 1: Range + P&L */}
        <motion.div
          variants={cardVariants}
          className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <RangeVisual position={position} />
          <PnlBreakdown pnl={pnl} />
        </motion.div>

        {/* Row 2: Transactions + Details */}
        <motion.div
          variants={cardVariants}
          className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <TransactionsCard position={position} />
          <DetailsCard position={position} />
        </motion.div>

        {/* Timeline */}
        <motion.div variants={cardVariants}>
          <PositionTimeline position={position} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
