// ─── api-sports / api-football v3 ─────────────────────────────────────────────
// Routes through Vite proxy (dev) or Vercel function (prod) to bypass CORS.
// Free tier: 100 req/day, no monthly cap.
// Key: VITE_API_FOOTBALL_KEY in .env

const BASE_URL    = '/api/apisports'  // Vite proxy (dev) or Vercel fn (prod)
const DAILY_LIMIT = 100

let dailyCallCount = 0
export function getApiCallCount(): number    { return dailyCallCount }
export function getRemainingCalls(): number  { return Math.max(0, DAILY_LIMIT - dailyCallCount) }

export const API_CONFIG = {
  season: parseInt(import.meta.env.VITE_FOOTBALL_SEASON ?? '2025', 10),
  watchedLeagues: (import.meta.env.VITE_WATCHED_LEAGUES ?? '2,3,39,140,78,135,61,94')
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => !isNaN(n)),
}

// International competitions use season = calendar year (e.g. WC 2026 → season 2026)
// Club leagues use VITE_FOOTBALL_SEASON (e.g. PL 2025/26 → season 2025)
const INTERNATIONAL_COMPETITION_IDS = new Set([
  1,   // FIFA World Cup
  4,   // UEFA European Championship
  9,   // Copa America
  5,   // UEFA Nations League
  6,   // FIFA Confederations Cup
  8,   // AFC Asian Cup
  10,  // CONCACAF Championship
])

export function resolveCompetitionSeason(leagueId: number): number {
  return INTERNATIONAL_COMPETITION_IDS.has(leagueId)
    ? new Date().getFullYear()
    : API_CONFIG.season
}

export function isInternationalCompetition(leagueId: number): boolean {
  return INTERNATIONAL_COMPETITION_IDS.has(leagueId)
}

// Ordered by prestige. Discovery tries each league until top-5 found.
export const DISCOVERY_LEAGUES: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1,   label: 'FIFA World Cup' },
  { id: 4,   label: 'UEFA Euro' },
  { id: 9,   label: 'Copa America' },
  { id: 5,   label: 'UEFA Nations League' },
  { id: 2,   label: 'UEFA Champions League' },
  { id: 15,  label: 'FIFA Club World Cup' },
  { id: 3,   label: 'UEFA Europa League' },
  { id: 848, label: 'UEFA Conference League' },
  { id: 39,  label: 'Premier League' },
  { id: 140, label: 'La Liga' },
  { id: 78,  label: 'Bundesliga' },
  { id: 135, label: 'Serie A' },
  { id: 61,  label: 'Ligue 1' },
  { id: 94,  label: 'Primeira Liga' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApiFixture {
  fixture: {
    id:     number
    date:   string
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
  form:   string
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

interface ApiResponse<T> {
  response: T
  errors:   unknown[]
  results:  number
  paging:   { current: number; total: number }
}

// ── HTTP client ────────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  endpoint: string,
  params:   Record<string, string | number>,
): Promise<T> {
  if (dailyCallCount >= DAILY_LIMIT * 0.8) {
    console.warn(`[API] Budget: ${dailyCallCount}/${DAILY_LIMIT} calls used`)
  }
  if (dailyCallCount >= DAILY_LIMIT) {
    throw new Error(`API_LIMIT_REACHED: ${DAILY_LIMIT} calls used today.`)
  }

  const url = new URL(BASE_URL + endpoint, window.location.origin)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  dailyCallCount++
  console.debug(`[API] #${dailyCallCount} ${endpoint}`, Object.fromEntries(url.searchParams))

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${endpoint} — ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as ApiResponse<T>

  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const errStr = JSON.stringify(json.errors)
    if (errStr !== '[]' && errStr !== '{}') {
      throw new Error(`API error on ${endpoint}: ${errStr}`)
    }
  }

  return json.response
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
