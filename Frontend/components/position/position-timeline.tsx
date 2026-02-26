"use client";

import { motion } from "motion/react";
import { format } from "date-fns";
import type { PositionDetail } from "@/lib/types/position";

interface TimelineEvent {
  title: string;
  description: string;
  timestamp: string | null;
  color: string;
  isActive?: boolean;
}

function buildTimeline(position: PositionDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      title: "Created",
      description: "Position created with initial parameters",
      timestamp: position.createdAt,
      color: "#0D6B58",
    },
    {
      title: "Submitted to Asset Hub",
      description: "Withdrawal initiated from wallet",
      timestamp: position.createdAt,
      color: "#E6007A",
    },
    {
      title: "XCM Sent",
      description: "Cross-chain message dispatched",
      timestamp: position.createdAt,
      color: "#E6007A",
    },
  ];

  if (position.executedAt) {
    events.push({
      title: "Executed on Moonbeam",
      description: `LP position minted on ${position.dexName} DEX`,
      timestamp: position.executedAt,
      color: "#00C853",
    });
  }

  if (position.status === "LIQUIDATED" && position.liquidatedAt) {
    events.push({
      title: "Liquidated",
      description: "Position liquidated and funds returned",
      timestamp: position.liquidatedAt,
      color: "#E53935",
    });
  } else if (position.executedAt) {
    events.push({
      title: "Actively Earning",
      description: "Position monitoring live. Currently in-range.",
      timestamp: position.executedAt,
      color: "#00E5A0",
      isActive: true,
    });
  }

  return events;
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
    },
  },
};

interface Props {
  position: PositionDetail;
}

export function PositionTimeline({ position }: Props) {
  const events = buildTimeline(position);

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      transition={{ staggerChildren: 0.12 }}
      className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
    >
      <h2 className="mb-6 font-display text-[17px] font-semibold text-ld-ink">
        Position Timeline
      </h2>

      <div className="relative pl-10">
        {/* Vertical line */}
        <motion.div
          className="absolute left-[15px] top-2 w-px bg-black/6"
          initial={{ height: 0 }}
          whileInView={{ height: "calc(100% - 16px)" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
        />

        <div className="space-y-6">
          {events.map((event, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="relative"
            >
              {/* Dot */}
              <div
                className="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${event.color}20` }}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: event.color,
                    boxShadow: event.isActive
                      ? `0 0 6px ${event.color}`
                      : "none",
                    animation: event.isActive
                      ? "pulse 2s ease-in-out infinite"
                      : "none",
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <div className="font-display text-[13px] font-semibold text-ld-ink">
                  {event.title}
                </div>
                <p className="mt-0.5 text-xs text-ld-slate">
                  {event.description}
                </p>
                <span className="mt-1 block text-[11px] text-ld-slate/60">
                  {event.timestamp
                    ? format(
                        new Date(event.timestamp),
                        "MMM d, yyyy · h:mm a"
                      )
                    : "—"}
                  {event.isActive && " (ongoing)"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
