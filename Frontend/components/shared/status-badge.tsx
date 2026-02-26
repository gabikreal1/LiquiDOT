"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const positionStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  PENDING_EXECUTION: {
    label: "Pending",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  },
  ACTIVE: {
    label: "Active",
    className: "border-green-500/30 bg-green-500/10 text-green-600",
  },
  OUT_OF_RANGE: {
    label: "Out of Range",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  },
  LIQUIDATION_PENDING: {
    label: "Liquidating",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  },
  LIQUIDATED: {
    label: "Liquidated",
    className: "border-gray-400/30 bg-gray-400/10 text-gray-500",
  },
  FAILED: {
    label: "Failed",
    className: "border-red-500/30 bg-red-500/10 text-red-600",
  },
};

const activityStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "border-green-500/30 bg-green-500/10 text-green-600",
  },
  FAILED: {
    label: "Failed",
    className: "border-red-500/30 bg-red-500/10 text-red-600",
  },
};

interface StatusBadgeProps {
  status: string;
  variant?: "position" | "activity";
  className?: string;
}

export function StatusBadge({
  status,
  variant = "position",
  className,
}: StatusBadgeProps) {
  const config =
    variant === "position"
      ? positionStatusConfig[status]
      : activityStatusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
