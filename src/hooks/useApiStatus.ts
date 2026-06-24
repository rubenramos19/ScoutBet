// ─── useApiStatus ─────────────────────────────────────────────────────────────
// Exposes runtime API state to any component that needs it.
// Used by the Sidebar to show quota and mock-mode indicators.

import { useState, useEffect } from 'react'
import { getApiCallCount, getRemainingCalls } from '@/lib/apiFootball'
import { apiCache } from '@/lib/cache'

export interface ApiStatus {
  isMockMode:     boolean
  callsUsed:      number
  callsRemaining: number
  cacheSize:      number
  hasApiKey:      boolean
}

/**
 * Polls API status every 10 seconds.
 * Lightweight — only reads counters already in memory, no network calls.
 */
export function useApiStatus(): ApiStatus {
  const hasApiKey  = Boolean(import.meta.env.VITE_API_FOOTBALL_KEY?.trim())
  const isMockMode = import.meta.env.VITE_USE_MOCK === 'true' || !hasApiKey

  const [status, setStatus] = useState<ApiStatus>({
    isMockMode,
    callsUsed:      getApiCallCount(),
    callsRemaining: getRemainingCalls(),
    cacheSize:      apiCache.size,
    hasApiKey,
  })

  useEffect(() => {
    const refresh = () => {
      setStatus({
        isMockMode,
        callsUsed:      getApiCallCount(),
        callsRemaining: getRemainingCalls(),
        cacheSize:      apiCache.size,
        hasApiKey,
      })
    }

    // Update on mount and every 10 s
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [isMockMode, hasApiKey])

  return status
}
