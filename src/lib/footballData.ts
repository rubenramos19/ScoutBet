// ─── Football-Data.org v4 API ─────────────────────────────────────────────────
// Free tier: WC, CL, PL, BL1, SA, PD, FL1, PPL, DED, BSA, EC, ELC
// Rate limit: 10 req/min — no daily cap
// CORS: native browser support, no proxy needed
// Token: VITE_FOOTBALL_DATA_TOKEN in .env

import { apiCache, TTL } from '@/lib/cache'

const FD_BASE = '/api/fd'

// All competitions included in free tier
export const FD_FREE_COMPETITIONS = 'WC,CL,PL,BL1,SA,PD,FL1,PPL,DED,BSA,EC,ELC'

function fdToken(): string {
  return import.meta.env.VITE_FOOTBALL_DATA_TOKEN ?? ''
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FDTeam {
  id:        number
  name:      string
  shortName: string
  tla:       string
  crest:     string
}

export interface FDScore {
  winner:   'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  duration: string
  fullTime: { home: number | null; away: number | null }
  halfTime: { home: number | null; away: number | null }
}

export interface FDMatch {
  id:          number
  competition: { id: number; code: string; name: string; emblem?: string }
  season:      { id: number; startDate: string; endDate: string; currentMatchday: number | null }
  utcDate:     string
  status:      string
  matchday:    number | null
  stage:       string
  group:       string | null
  homeTeam:    FDTeam
  awayTeam:    FDTeam
  score:       FDScore
}

export interface FDH2HResponse {
  aggregates: {
    numberOfMatches: number
    totalGoals:      number
    homeTeam: { id: number; name: string; wins: number; draws: number; losses: number }
    awayTeam: { id: number; name: string; wins: number; draws: number; losses: number }
  }
  matches: FDMatch[]
}

// ── HTTP client ────────────────────────────────────────────────────────────────

async function fdGet<T>(path: string): Promise<T | null> {
  const token = fdToken()
  if (!token) {
    console.warn('[FD] VITE_FOOTBALL_DATA_TOKEN não configurado')
    return null
  }
  const url = FD_BASE + path
  try {
    const res = await fetch(url, {
      headers: {
        'X-Auth-Token': token,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[FD] ${res.status} ${path} — ${body.slice(0, 200)}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn(`[FD] ${path}:`, err)
    return null
  }
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Endpoints ──────────────────────────────────────────────────────────────────

/** All scheduled/live matches today across free-tier competitions */
export async function getFDTodayMatches(date: string): Promise<FDMatch[]> {
  const cacheKey = `fd:matches:${date}`
  const cached = apiCache.get<FDMatch[]>(cacheKey)
  if (cached) return cached

  const data = await fdGet<{ matches: FDMatch[] }>(
    `/matches?dateFrom=${date}&dateTo=${date}&competitions=${FD_FREE_COMPETITIONS}`
  )
  const matches = data?.matches ?? []
  console.log(`[FD] ${matches.length} partidas para ${date}`)
  apiCache.set(cacheKey, matches, TTL.FIXTURES_TODAY)
  return matches
}

/** Last ≤10 finished matches for a team (used to calculate form stats) */
export async function getFDTeamLastMatches(teamId: number): Promise<FDMatch[]> {
  const cacheKey = `fd:team:${teamId}:last`
  const cached = apiCache.get<FDMatch[]>(cacheKey)
  if (cached) return cached

  await delay(200)
  const data = await fdGet<{ matches: FDMatch[] }>(
    `/teams/${teamId}/matches?status=FINISHED&limit=10`
  )
  const matches = data?.matches ?? []
  console.log(`[FD] team ${teamId} → ${matches.length} jogos anteriores`)
  apiCache.set(cacheKey, matches, TTL.TEAM_STATS)
  return matches
}

/** Head-to-head history for a specific match */
export async function getFDMatchH2H(matchId: number): Promise<FDH2HResponse | null> {
  const cacheKey = `fd:h2h:${matchId}`
  const cached = apiCache.get<FDH2HResponse>(cacheKey)
  if (cached) return cached

  await delay(150)
  const data = await fdGet<FDH2HResponse>(`/matches/${matchId}/head2head?limit=10`)
  if (!data?.aggregates) return null
  apiCache.set(cacheKey, data, TTL.H2H)
  return data
}
