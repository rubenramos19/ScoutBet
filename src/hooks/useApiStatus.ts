// ─── useApiStatus ─────────────────────────────────────────────────────────────
// Exposes runtime API state to the Sidebar.
// After TheSportsDB migration: no API key, no daily call limit.
// Interface kept identical so Sidebar.tsx requires no changes.

import { useState, useEffect } from 'react'
import { apiCache } from '@/lib/cache'

export interface ApiStatus {
  isMockMode:     boolean
  callsUsed:      number
  callsRemaining: number
  cacheSize:      number
  hasApiKey:      boolean
}

export function useApiStatus(): ApiStatus {
  // TheSportsDB is free — no key required and no documented call limit.
  const isMockMode = import.meta.env.VITE_USE_MOCK === 'true'

  const [status, setStatus] = useState<ApiStatus>({
    isMockMode,
    callsUsed:      0,
    callsRemaining: 9999,   // TheSportsDB: effectively unlimited
    cacheSize:      apiCache.size,
    hasApiKey:      true,   // no key needed — always "available"
  })

  useEffect(() => {
    const refresh = () => {
      setStatus({
        isMockMode,
        callsUsed:      0,
        callsRemaining: 9999,
        cacheSize:      apiCache.size,
        hasApiKey:      true,
      })
    }
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [isMockMode])

  return status
}
