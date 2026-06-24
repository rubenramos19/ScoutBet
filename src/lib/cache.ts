// ─── In-Memory TTL Cache ──────────────────────────────────────────────────────
// Keeps API calls within the 100/day free tier budget (audit A-01).
// Keys are namespaced: "fixtures:2026-06-24", "stats:541:2:2024", etc.
// Reset on page reload — acceptable for a personal SPA.

interface CacheEntry<T> {
  data: T
  expiresAt: number  // unix ms
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  /** How many entries are live */
  get size(): number {
    return [...this.store.values()].filter(e => Date.now() <= e.expiresAt).length
  }

  /** Debug: list all live keys */
  keys(): string[] {
    return [...this.store.entries()]
      .filter(([, e]) => Date.now() <= e.expiresAt)
      .map(([k]) => k)
  }
}

// TTL constants (in ms) — tuned for 100 req/day budget
export const TTL = {
  FIXTURES_TODAY:   30 * 60 * 1000,   //  30 min — fixture list for today
  TEAM_STATS:        6 * 60 * 60 * 1000,   //   6 h  — team season stats
  H2H:              24 * 60 * 60 * 1000,   //  24 h  — H2H history (rarely changes)
  INJURIES:          1 * 60 * 60 * 1000,   //   1 h  — injuries can appear last minute
  STANDINGS:        24 * 60 * 60 * 1000,   //  24 h  — league table
  QUICK_REFRESH:     5 * 60 * 1000,        //   5 min — live score during game
} as const

export const apiCache = new TTLCache()
