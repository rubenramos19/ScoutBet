// ─── API-Football HTTP Client ─────────────────────────────────────────────────
// Single place that knows about the external API (api-sports.io / RapidAPI).
// All other code imports `apiFetch` — never constructs URLs or sets headers.
//
// Handles:
//   • Auth header injection
//   • Retry with exponential backoff (audit A-04)
//   • Daily call counter with warning at 80 %
//   • Graceful mock-mode fallback when key is absent

const BASE_URL   = 'https://v3.football.api-sports.io'
const API_KEY    = import.meta.env.VITE_API_FOOTBALL_KEY
const DAILY_LIMIT = 100

// ── Daily call counter (resets on page reload — fine for personal SPA) ────────
let dailyCallCount = 0

export function getApiCallCount(): number { return dailyCallCount }
export function getRemainingCalls(): number { return Math.max(0, DAILY_LIMIT - dailyCallCount) }

// ── Runtime config ────────────────────────────────────────────────────────────
export const API_CONFIG = {
  season: parseInt(import.meta.env.VITE_FOOTBALL_SEASON ?? '2024', 10),

  /** Leagues fetched daily. Default covers the 8 top European competitions. */
  watchedLeagues: (import.meta.env.VITE_WATCHED_LEAGUES ?? '2,3,39,140,78,135,61,94')
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => !isNaN(n)),
}

// ── Raw API response shapes ───────────────────────────────────────────────────

export interface ApiFixture {
  fixture: {
    id:     number
    date:   string   // ISO 8601 UTC
    status: { short: string; long: string; elapsed: number | null }
    venue:  { name: string | null; city: string | null }
  }
  league: {
    id:      number
    name:    string
    country: string
    logo:    string
    round:   string
    season:  number
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
  }
}

export interface ApiTeamStats {
  team:   { id: number; name: string }
  league: { id: number; name: string; season: number }
  form:   string   // "WWDLW..." — most recent LAST
  fixtures: {
    played: { home: number; away: number; total: number }
    wins:   { home: number; away: number; total: number }
    draws:  { home: number; away: number; total: number }
    loses:  { home: number; away: number; total: number }
  }
  goals: {
    for: {
      average: { home: string; away: string; total: string }
      total:   { home: number; away: number; total: number }
    }
    against: {
      average: { home: string; away: string; total: string }
      total:   { home: number; away: number; total: number }
    }
  }
  clean_sheet:     { home: number; away: number; total: number }
  failed_to_score: { home: number; away: number; total: number }
  biggest: {
    streak: { wins: number; draws: number; loses: number }
  }
}

export interface ApiInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string }
  team:   { id: number; name: string; logo: string }
}

export interface ApiStandingRow {
  rank:      number
  team:      { id: number; name: string; logo: string }
  points:    number
  goalsDiff: number
  form:      string
  all:  { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
  home: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
  away: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
}

// ── Wrapper type returned by the API ─────────────────────────────────────────
interface ApiResponse<T> {
  response: T
  errors:   unknown[]
  results:  number
  paging:   { current: number; total: number }
}

// ── Core fetch with exponential-backoff retry (audit A-04) ───────────────────

interface FetchOptions {
  maxRetries?:    number
  retryDelayMs?:  number
}

export async function apiFetch<T>(
  endpoint: string,
  params:   Record<string, string | number>,
  opts:     FetchOptions = {},
): Promise<T> {
  if (!API_KEY) {
    throw new Error('API_KEY_MISSING: Set VITE_API_FOOTBALL_KEY in .env')
  }

  if (dailyCallCount >= DAILY_LIMIT * 0.8) {
    console.warn(
      `[ScoutBet] ⚠ API budget: ${dailyCallCount}/${DAILY_LIMIT} calls used today ` +
      `(${getRemainingCalls()} remaining)`
    )
  }

  if (dailyCallCount >= DAILY_LIMIT) {
    throw new Error(
      `API_LIMIT_REACHED: ${DAILY_LIMIT} calls used today. Resets at midnight UTC.`
    )
  }

  const url = new URL(`${BASE_URL}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const { maxRetries = 2, retryDelayMs = 800 } = opts
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 800ms, 1600ms, ...
      await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)))
      console.warn(`[API] Retry ${attempt}/${maxRetries} → ${endpoint}`)
    }

    try {
      dailyCallCount++
      console.debug(
        `[API] #${dailyCallCount} ${endpoint}`,
        Object.fromEntries(url.searchParams)
      )

      const res = await fetch(url.toString(), {
        headers: {
          'x-apisports-key': API_KEY,
          'Content-Type':    'application/json',
        },
        signal: AbortSignal.timeout(10_000),  // 10 s timeout
      })

      // Rate-limited — honour Retry-After header
      if (res.status === 429) {
        dailyCallCount-- // don't count throttled attempts
        const wait = parseInt(res.headers.get('Retry-After') ?? '60', 10)
        console.warn(`[API] Rate limited — waiting ${wait}s before retry`)
        await new Promise(r => setTimeout(r, wait * 1000))
        continue
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${endpoint}`)
      }

      const json = (await res.json()) as ApiResponse<T>

      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(`API error on ${endpoint}: ${JSON.stringify(json.errors)}`)
      }

      return json.response

    } catch (err) {
      dailyCallCount = Math.max(0, dailyCallCount - (attempt === 0 ? 0 : 1))
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxRetries) {
        console.warn(`[API] Attempt ${attempt + 1} failed:`, lastError.message)
      }
    }
  }

  throw lastError
}

/** Today's date as YYYY-MM-DD (UTC) — used as cache key and API param */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
