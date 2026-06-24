const BASE_URL    = 'https://v3.football.api-sports.io'
const API_KEY     = import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined
const DAILY_LIMIT = 100

let dailyCallCount = 0
export function getApiCallCount(): number { return dailyCallCount }
export function getRemainingCalls(): number { return Math.max(0, DAILY_LIMIT - dailyCallCount) }

export const API_CONFIG = {
  season: parseInt(import.meta.env.VITE_FOOTBALL_SEASON ?? '2025', 10),
  watchedLeagues: (import.meta.env.VITE_WATCHED_LEAGUES ?? '2,3,39,140,78,135,61,94')
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => !isNaN(n)),
}

if (typeof window !== 'undefined') {
  console.info(
    '[ScoutBet] API config — key: ' + (API_KEY ? 'SET' : 'MISSING') +
    ' | mock: ' + (import.meta.env.VITE_USE_MOCK ?? 'false') +
    ' | season: ' + API_CONFIG.season +
    ' | leagues: ' + API_CONFIG.watchedLeagues.join(',')
  )
}

// International competitions use season = calendar year (e.g. World Cup 2026 -> season 2026)
// Club leagues use VITE_FOOTBALL_SEASON (e.g. Premier League 2025/26 -> season 2025)
// Add an ID here when a new global tournament is added to DISCOVERY_LEAGUES.
const INTERNATIONAL_COMPETITION_IDS = new Set([
  1,   // FIFA World Cup
  4,   // UEFA European Championship
  9,   // Copa America
  5,   // UEFA Nations League
  6,   // FIFA Confederations Cup
  8,   // AFC Asian Cup
  10,  // CONCACAF Championship
])

/**
 * Returns the correct API-Football season param for a given competition.
 * Club leagues  -> VITE_FOOTBALL_SEASON (e.g. 2025)
 * International -> current calendar year (e.g. 2026)
 * No hardcoded years anywhere else in the codebase.
 */
export function resolveCompetitionSeason(leagueId: number): number {
  return INTERNATIONAL_COMPETITION_IDS.has(leagueId)
    ? new Date().getFullYear()
    : API_CONFIG.season
}

export function isInternationalCompetition(leagueId: number): boolean {
  return INTERNATIONAL_COMPETITION_IDS.has(leagueId)
}

// Ordered by prestige. No season field — resolved at runtime via resolveCompetitionSeason().
// To add a competition: append here and, if single-year international, add ID above.
export const DISCOVERY_LEAGUES: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1,   label: 'FIFA World Cup' },
  { id: 4,   label: 'UEFA Euro' },
  { id: 9,   label: 'Copa America' },
  { id: 5,   label: 'UEFA Nations League' },
  { id: 2,   label: 'UEFA Champions League' },
  { id: 15,  label: 'FIFA Club World Cup' },
  { id: 3,   label: 'UEFA Europa League' },
  { id: 39,  label: 'Premier League' },
  { id: 140, label: 'La Liga' },
  { id: 78,  label: 'Bundesliga' },
  { id: 135, label: 'Serie A' },
  { id: 61,  label: 'Ligue 1' },
  { id: 94,  label: 'Primeira Liga' },
]

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
      '[ScoutBet] API budget: ' + dailyCallCount + '/' + DAILY_LIMIT +
      ' calls used today (' + getRemainingCalls() + ' remaining)'
    )
  }

  if (dailyCallCount >= DAILY_LIMIT) {
    throw new Error(
      'API_LIMIT_REACHED: ' + DAILY_LIMIT + ' calls used today. Resets at midnight UTC.'
    )
  }

  const url = new URL(BASE_URL + endpoint)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const { maxRetries = 2, retryDelayMs = 800 } = opts
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt - 1)))
      console.warn('[API] Retry ' + attempt + '/' + maxRetries + ' -> ' + endpoint)
    }

    try {
      dailyCallCount++
      console.debug('[API] #' + dailyCallCount + ' ' + endpoint, Object.fromEntries(url.searchParams))

      const res = await fetch(url.toString(), {
        headers: {
          'x-apisports-key': API_KEY,
          'Content-Type':    'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.status === 429) {
        dailyCallCount--
        const wait = parseInt(res.headers.get('Retry-After') ?? '60', 10)
        console.warn('[API] Rate limited — waiting ' + wait + 's')
        await new Promise(r => setTimeout(r, wait * 1000))
        continue
      }

      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' ' + res.statusText + ' — ' + endpoint)
      }

      const json = (await res.json()) as ApiResponse<T>

      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error('API error on ' + endpoint + ': ' + JSON.stringify(json.errors))
      }

      return json.response

    } catch (err) {
      dailyCallCount = Math.max(0, dailyCallCount - (attempt === 0 ? 0 : 1))
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        console.warn('[API] Attempt ' + (attempt + 1) + ' failed:', lastError.message)
      }
    }
  }

  throw lastError
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
