// ─── Typed localStorage helper ─────────────────────────────────────────────────
// All ScoutBet user data is stored locally — no backend required.
// Keys are namespaced under "scoutbet:" to avoid collisions.

const PREFIX = 'scoutbet:'

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw == null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (e) {
      console.warn('[storage] write failed:', e)
    }
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key)
  },

  has(key: string): boolean {
    return localStorage.getItem(PREFIX + key) !== null
  },
}

// ── Storage keys ───────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  BANKROLL:    'bankroll',
  SNAPSHOTS:   'snapshots',
  SAVED_BETS:  'saved_bets',
} as const
