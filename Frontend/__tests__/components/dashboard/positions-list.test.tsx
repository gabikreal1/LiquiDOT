import { render, screen } from '@testing-library/react'
import { PositionsList } from '@/components/dashboard/positions-list'
import type { DashboardData } from '@/lib/api'

const mockPositions: DashboardData['positions'] = [
  {
    id: 'pos-1',
    poolName: 'xcDOT/WGLMR',
    status: 'ACTIVE',
    amountDot: 50,
    currentValueUsd: 375,
    pnlUsd: 25,
    pnlPercent: 7.14,
    assetHubTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    moonbeamTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    createdAt: '2026-02-01T12:00:00Z',
    executedAt: '2026-02-01T12:05:00Z',
  },
  {
    id: 'pos-2',
    poolName: 'xcDOT/USDC',
    status: 'PENDING_EXECUTION',
    amountDot: 30,
    currentValueUsd: 210,
    pnlUsd: -5,
    pnlPercent: -2.33,
    assetHubTxHash: null,
    moonbeamTxHash: null,
    createdAt: '2026-02-02T10:00:00Z',
    executedAt: null,
  },
]

describe('PositionsList', () => {
  it('renders empty state when no positions', () => {
    render(<PositionsList positions={[]} />)
    expect(screen.getByText(/No positions yet/)).toBeInTheDocument()
  })

  it('renders positions table with pool names', () => {
    render(<PositionsList positions={mockPositions} />)
    expect(screen.getByText('xcDOT/WGLMR')).toBeInTheDocument()
    expect(screen.getByText('xcDOT/USDC')).toBeInTheDocument()
  })

  it('displays DOT amounts', () => {
    render(<PositionsList positions={mockPositions} />)
    expect(screen.getByText('50.00 DOT')).toBeInTheDocument()
    expect(screen.getByText('30.00 DOT')).toBeInTheDocument()
  })

  it('truncates transaction hashes', () => {
    render(<PositionsList positions={mockPositions} />)
    expect(screen.getByText('0x1234...cdef')).toBeInTheDocument()
    expect(screen.getByText('0xabcd...7890')).toBeInTheDocument()
  })

  it('shows dash for null tx hashes', () => {
    render(<PositionsList positions={mockPositions} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows positive P&L in green', () => {
    render(<PositionsList positions={mockPositions} />)
    expect(screen.getByText('+7.14%')).toBeInTheDocument()
  })

  it('shows negative P&L in red', () => {
    render(<PositionsList positions={mockPositions} />)
    expect(screen.getByText('-2.33%')).toBeInTheDocument()
  })
})
