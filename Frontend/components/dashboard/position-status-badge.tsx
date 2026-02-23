"use client"

import { Badge } from "@/components/ui/badge"

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_EXECUTION: { label: "Pending", variant: "outline" },
  ACTIVE: { label: "Active", variant: "default" },
  OUT_OF_RANGE: { label: "Out of Range", variant: "secondary" },
  LIQUIDATION_PENDING: { label: "Liquidating", variant: "secondary" },
  LIQUIDATED: { label: "Liquidated", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
}

export function PositionStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "outline" as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
