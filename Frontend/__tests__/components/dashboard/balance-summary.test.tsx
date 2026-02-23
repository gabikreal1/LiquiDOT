import { render, screen } from '@testing-library/react'
import { BalanceSummary } from '@/components/dashboard/balance-summary'
import type { DashboardData } from '@/lib/api'

const mockData: DashboardData = {
  user: {
    id: 'user-1',
    walletAddress: '0x1234',
    balanceDot: 150.5,
    balanceUsd: 1053.50,
  },
  positions: [],
  recentActivity: [],
  pools: [],
  summary: {
    totalInvestedUsd: 500,
    totalCurrentValueUsd: 550,
    totalPnlUsd: 50,
    totalPnlPercent: 10,
    activePositionCount: 2,
    pendingPositionCount: 1,
  },
}

describe('BalanceSummary', () => {
  it('renders portfolio overview title', () => {
    render(<BalanceSummary data={mockData} />)
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument()
  })

  it('displays DOT balance', () => {
    render(<BalanceSummary data={mockData} />)
    expect(screen.getByText('150.50 DOT')).toBeInTheDocument()
  })

  it('displays active position count', () => {
    render(<BalanceSummary data={mockData} />)
    expect(screen.getByText('Active: 2')).toBeInTheDocument()
  })

  it('displays pending count when > 0', () => {
    render(<BalanceSummary data={mockData} />)
    expect(screen.getByText('Pending: 1')).toBeInTheDocument()
  })

  it('hides pending badge when count is 0', () => {
    const noPending = {
      ...mockData,
      summary: { ...mockData.summary, pendingPositionCount: 0 },
    }
    render(<BalanceSummary data={noPending} />)
    expect(screen.queryByText(/Pending/)).not.toBeInTheDocument()
  })

  it('shows positive P&L with green styling and + sign', () => {
    render(<BalanceSummary data={mockData} />)
    const pnlElement = screen.getByText('+10.00%')
    expect(pnlElement).toBeInTheDocument()
    expect(pnlElement.className).toContain('text-green-500')
  })

  it('shows negative P&L with red styling', () => {
    const negativeData = {
      ...mockData,
      summary: { ...mockData.summary, totalPnlUsd: -25, totalPnlPercent: -5 },
    }
    render(<BalanceSummary data={negativeData} />)
    const pnlElement = screen.getByText('-5.00%')
    expect(pnlElement).toBeInTheDocument()
    expect(pnlElement.className).toContain('text-red-500')
  })
})
