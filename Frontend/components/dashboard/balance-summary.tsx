"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DashboardData } from "@/lib/api"

interface BalanceSummaryProps {
  data: DashboardData
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function BalanceSummary({ data }: BalanceSummaryProps) {
  const { summary, user } = data
  const pnlColor = summary.totalPnlUsd >= 0 ? "text-green-500" : "text-red-500"
  const pnlSign = summary.totalPnlUsd >= 0 ? "+" : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Portfolio Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold">{formatUsd(user.balanceUsd)}</p>
            <p className="text-xs text-muted-foreground">{user.balanceDot.toFixed(2)} DOT</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Invested</p>
            <p className="text-2xl font-bold">{formatUsd(summary.totalInvestedUsd)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-2xl font-bold">{formatUsd(summary.totalCurrentValueUsd)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-2xl font-bold ${pnlColor}`}>
              {pnlSign}{formatUsd(summary.totalPnlUsd)}
            </p>
            <p className={`text-xs ${pnlColor}`}>
              {pnlSign}{summary.totalPnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Badge variant="default">Active: {summary.activePositionCount}</Badge>
          {summary.pendingPositionCount > 0 && (
            <Badge variant="outline">Pending: {summary.pendingPositionCount}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
