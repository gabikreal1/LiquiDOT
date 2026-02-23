import { fetchDashboard, registerUser, fetchPools, fetchHealth } from '@/lib/api'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

describe('API client', () => {
  describe('fetchDashboard', () => {
    it('calls correct endpoint with userId', async () => {
      const mockData = { user: { id: '123' }, positions: [], summary: {} }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await fetchDashboard('user-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/dashboard/user-123',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(result).toEqual(mockData)
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(fetchDashboard('bad-id')).rejects.toThrow('API error 404: Not Found')
    })
  })

  describe('registerUser', () => {
    it('sends POST with walletAddress', async () => {
      const mockUser = { id: '1', walletAddress: '0xabc', isActive: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })

      const result = await registerUser('0xabc')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ walletAddress: '0xabc' }),
        })
      )
      expect(result).toEqual(mockUser)
    })
  })

  describe('fetchPools', () => {
    it('calls /pools endpoint', async () => {
      const mockPools = [{ id: 'p1', poolAddress: '0x123' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPools,
      })

      const result = await fetchPools()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/pools',
        expect.any(Object)
      )
      expect(result).toEqual(mockPools)
    })
  })

  describe('fetchHealth', () => {
    it('calls /health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      })

      const result = await fetchHealth()
      expect(result).toEqual({ status: 'ok' })
    })
  })
})
