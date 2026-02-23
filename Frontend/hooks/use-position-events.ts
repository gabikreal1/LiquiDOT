"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function usePositionEvents(userId: string | undefined) {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!userId) return

    const url = `${API_BASE}/api/positions/user/${userId}/events`
    const es = new EventSource(url)
    eventSourceRef.current = es

    const handleMessage = () => {
      // Invalidate dashboard cache to trigger refetch on any position event
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] })
    }

    es.addEventListener('CREATED', handleMessage)
    es.addEventListener('EXECUTED', handleMessage)
    es.addEventListener('LIQUIDATED', handleMessage)
    es.addEventListener('FAILED', handleMessage)
    es.addEventListener('STATUS_CHANGE', handleMessage)

    es.onerror = () => {
      // EventSource auto-reconnects on error
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [userId, queryClient])
}
