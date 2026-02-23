import { useQuery } from '@tanstack/react-query'
import { fetchDashboard, fetchPools, type DashboardData, type PoolData } from '@/lib/api'

export function useDashboard(userId: string | undefined) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

export function usePools() {
  return useQuery<PoolData[]>({
    queryKey: ['pools'],
    queryFn: fetchPools,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
}
