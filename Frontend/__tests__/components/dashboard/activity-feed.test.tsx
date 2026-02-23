import { render, screen } from '@testing-library/react'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import type { DashboardData } from '@/lib/api'

const mockActivities: DashboardData['recentActivity'] = [
  {
    type: 'INVESTMENT',
    status: 'CONFIRMED',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    details: { amount: '50000000000' },
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(), // 30 min ago
  },
  {
    type: 'LIQUIDATION',
    status: 'FAILED',
    txHash: null,
    details: {},
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(), // 2 hours ago
  },
  {
    type: 'WITHDRAWAL',
    status: 'PENDING',
    txHash: null,
    details: {},
    createdAt: new Date(Date.now() - 500).toISOString(), // just now
  },
]

describe('ActivityFeed', () => {
  it('renders empty state when no activities', () => {
    render(<ActivityFeed activities={[]} />)
    expect(screen.getByText('No recent activity.')).toBeInTheDocument()
  })

  it('renders activity type labels', () => {
    render(<ActivityFeed activities={mockActivities} />)
    expect(screen.getByText('Investment')).toBeInTheDocument()
    expect(screen.getByText('Liquidation')).toBeInTheDocument()
    expect(screen.getByText('Withdrawal')).toBeInTheDocument()
  })

  it('renders truncated tx hashes for activities that have them', () => {
    render(<ActivityFeed activities={mockActivities} />)
    expect(screen.getByText('0x1234...cdef')).toBeInTheDocument()
  })

  it('renders relative timestamps', () => {
    render(<ActivityFeed activities={mockActivities} />)
    expect(screen.getByText('30m ago')).toBeInTheDocument()
    expect(screen.getByText('2h ago')).toBeInTheDocument()
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('renders Recent Activity title', () => {
    render(<ActivityFeed activities={mockActivities} />)
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
  })
})
