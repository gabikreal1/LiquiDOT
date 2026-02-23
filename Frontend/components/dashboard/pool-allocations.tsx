"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import type { DashboardData } from "@/lib/api"

interface PoolAllocationsProps {
  pools: DashboardData["pools"]
}

const COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(280, 65%, 60%)",
  "hsl(300, 76%, 72%)",
  "hsl(330, 80%, 60%)",
  "hsl(200, 80%, 50%)",
  "hsl(160, 60%, 45%)",
]

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function PoolAllocations({ pools }: PoolAllocationsProps) {
  const allocated = pools.filter((p) => p.userAllocationUsd > 0)

  if (allocated.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pool Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No active pool allocations.</p>
        </CardContent>
      </Card>
    )
  }

  const chartData = allocated.map((p) => ({
    name: p.name,
    value: p.userAllocationUsd,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pool Allocations</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, value }) => `${name}: ${formatUsd(value)}`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatUsd(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
