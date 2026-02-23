"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PositionStatusBadge } from "./position-status-badge"
import type { DashboardData } from "@/lib/api"

interface PositionsListProps {
  positions: DashboardData["positions"]
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function truncateHash(hash: string | null): string {
  if (!hash) return "-"
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export function PositionsList({ positions }: PositionsListProps) {
  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No positions yet. Deposit DOT and configure your strategy to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Positions</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Pool</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">P&L</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">AH Tx</th>
              <th className="pb-2">MB Tx</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const pnlColor = pos.pnlUsd >= 0 ? "text-green-500" : "text-red-500"
              const pnlSign = pos.pnlUsd >= 0 ? "+" : ""
              return (
                <tr key={pos.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{pos.poolName}</td>
                  <td className="py-3 pr-4">
                    <div>{pos.amountDot.toFixed(2)} DOT</div>
                    <div className="text-xs text-muted-foreground">{formatUsd(pos.currentValueUsd)}</div>
                  </td>
                  <td className={`py-3 pr-4 ${pnlColor}`}>
                    <div>{pnlSign}{formatUsd(pos.pnlUsd)}</div>
                    <div className="text-xs">{pnlSign}{pos.pnlPercent.toFixed(2)}%</div>
                  </td>
                  <td className="py-3 pr-4">
                    <PositionStatusBadge status={pos.status} />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{truncateHash(pos.assetHubTxHash)}</td>
                  <td className="py-3 font-mono text-xs">{truncateHash(pos.moonbeamTxHash)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
