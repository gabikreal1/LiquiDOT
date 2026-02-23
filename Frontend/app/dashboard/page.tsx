"use client"

import { useBackendUserContext } from "@/context/backend-user-context"
import { useWalletContext } from "@/context/wallet-context"
import { useDashboard } from "@/hooks/use-dashboard"
import { usePositionEvents } from "@/hooks/use-position-events"
import { BalanceSummary } from "@/components/dashboard/balance-summary"
import { PositionsList } from "@/components/dashboard/positions-list"
import { PoolAllocations } from "@/components/dashboard/pool-allocations"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardPage() {
  const { isConnected } = useWalletContext()
  const { userId } = useBackendUserContext()
  const { data, isLoading, error } = useDashboard(userId)

  // SSE for live updates
  usePositionEvents(userId)

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-muted-foreground">Connect your wallet to view your dashboard.</p>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive">Failed to load dashboard. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <BalanceSummary data={data} />

      <PositionsList positions={data.positions} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PoolAllocations pools={data.pools} />
        <ActivityFeed activities={data.recentActivity} />
      </div>
    </div>
  )
}
