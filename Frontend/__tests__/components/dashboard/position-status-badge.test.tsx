import { render, screen } from '@testing-library/react'
import { PositionStatusBadge } from '@/components/dashboard/position-status-badge'

describe('PositionStatusBadge', () => {
  it('renders "Active" for ACTIVE status', () => {
    render(<PositionStatusBadge status="ACTIVE" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders "Pending" for PENDING_EXECUTION status', () => {
    render(<PositionStatusBadge status="PENDING_EXECUTION" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders "Failed" for FAILED status', () => {
    render(<PositionStatusBadge status="FAILED" />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('renders "Liquidated" for LIQUIDATED status', () => {
    render(<PositionStatusBadge status="LIQUIDATED" />)
    expect(screen.getByText('Liquidated')).toBeInTheDocument()
  })

  it('renders "Liquidating" for LIQUIDATION_PENDING status', () => {
    render(<PositionStatusBadge status="LIQUIDATION_PENDING" />)
    expect(screen.getByText('Liquidating')).toBeInTheDocument()
  })

  it('renders "Out of Range" for OUT_OF_RANGE status', () => {
    render(<PositionStatusBadge status="OUT_OF_RANGE" />)
    expect(screen.getByText('Out of Range')).toBeInTheDocument()
  })

  it('renders raw status for unknown values', () => {
    render(<PositionStatusBadge status="UNKNOWN_STATUS" />)
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument()
  })
})
