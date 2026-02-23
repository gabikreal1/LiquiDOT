"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { DashboardData } from "@/lib/api"

interface ActivityFeedProps {
  activities: DashboardData["recentActivity"]
}

const TYPE_LABELS: Record<string, string> = {
  INVESTMENT: "Investment",
  WITHDRAWAL: "Withdrawal",
  LIQUIDATION: "Liquidation",
  AUTO_REBALANCE: "Rebalance",
  ERROR: "Error",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SUBMITTED: "secondary",
  CONFIRMED: "default",
  FAILED: "destructive",
}

function truncateHash(hash: string | null): string {
  if (!hash) return ""
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString()
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No recent activity.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[activity.status] || "outline"} className="text-xs">
                    {TYPE_LABELS[activity.type] || activity.type}
                  </Badge>
                  {activity.txHash && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {truncateHash(activity.txHash)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatTime(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
