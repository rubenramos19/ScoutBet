// ─── SofaScore Unofficial API Client ─────────────────────────────────────────
// Endpoints confirmed working: 2026-06-25.
// No API key required. Browser-like headers required to avoid 403.
// All public functions return null on error — never throw, never fake data.
//
// Rate-limit notes:
//   - No documented limit, but excessive polling may trigger soft blocks.
//   - TTL cache ensures each endpoint is only called once per session window.

import { apiCache, TTL } from '@/lib/cache'

const BASE = 'https://api.sofascore.com/api/v1'

const HEADERS: HeadersInit = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://www.sofascore.com/',
  'Origin':          'https://www.sofascore.com',
}

// ── TypeScript interfaces for SofaScore responses ─────────────────────────────

export interface SofaTeam {
  id: number
  name: string
  slug?: string
  shortName?: string
  nameCode?: string
  country?: { alpha2?: string; name?: string; slug?: string }
  teamColors?: { primary?: string; secondary?: string }
  national?: boolean
  ranking?: number
}

export interface SofaTournamentDetails {
  id: number
  name: string
  slug?: string
  uniqueTournament: { id: number; name: string; slug?: string }
  category?: { id?: number; name?: string; slug?: string }
  isGroup?: boolean
  groupName?: string
}

export interface SofaScoreValue {
  current?: number
  display?: number
  period1?: number
  period2?: number
  normaltime?: number
}

export interface SofaEvent {
  id: number
  customId?: string
  slug?: string
  tournament: SofaTournamentDetails
  season: { id: number; name: string; year?: string }
  roundInfo?: { round?: number; name?: string }
  status: { code: number; description: string; type: string }
  homeTeam: SofaTeam
  awayTeam: SofaTeam
  homeScore: SofaScoreValue
  awayScore: SofaScoreValue
  startTimestamp: number
  venue?: {
    id?: number
    name?: string
    city?: { name: string }
    country?: { name: string }
    capacity?: number
  }
  /** 1 = home win, 2 = draw, 3 = away win */
  winnerCode?: number
}

export interface SofaH2H {
  teamDuel: { homeWins: number; awayWins: number; draws: number }
  managerDuel?: { homeWins: number; awayWins: number; draws: number }
}

export interface SofaTeamSeasonStats {
  goalsScored?:             number
  goalsConceded?:           number
  cleanSheets?:             number
  assists?:                 number
  avgRating?:               number
  yellowCards?:             number
  redCards?:                number
  matches?:                 number
  shots?:                   number
  shotsOnTarget?:           number
  averageBallPossession?:   number
  bigChances?:              number
  corners?:                 number
  [key: string]: number | string | undefined
}

export interface SofaPlayerStatistics {
  minutesPlayed?:            number
  rating?:                   number
  goals?:                    number
  goalAssist?:               number
  yellowCard?:               number
  redCard?:                  number
  totalPass?:                number
  accuratePass?:             number
  saves?:                    number
  touches?:                  number
  totalShot?:                number
  onTargetScoringAttempt?:   number
}

export interface SofaLineupPlayer {
  player: {
    id: number
    name: string
    shortName?: string
    position?: string
    jerseyNumber?: string
    height?: number
    country?: { name?: string; alpha2?: string }
  }
  position?: string
  jerseyNumber?: string
  substitute: boolean
  statistics?: SofaPlayerStatistics
  captain?: boolean
}

export interface SofaLineup {
  confirmed: boolean
  home?: {
    players?: SofaLineupPlayer[]
    formation?: string
    missingPlayers?: Array<{
      player: { id: number; name: string }
      type: { name: string }
      reason?: { name: string }
    }>
  }
  away?: {
    players?: SofaLineupPlayer[]
    formation?: string
    missingPlayers?: Array<{
      player: { id: number; name: string }
      type: { name: string }
      reason?: { name: string }
    }>
  }
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

async function sofaFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(BASE + path, { headers: HEADERS })
    if (!res.ok) {
      console.warn(`[SofaScore] HTTP ${res.status} — ${path}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[SofaScore] Network error — ${path}:`, err)
    return null
  }
}

// ── Scheduled events for a date ────────────────────────────────────────────────
// GET /sport/football/scheduled-events/{YYYY-MM-DD}
// Returns all football events for the given date.

export async function getScheduledEvents(date: string): Promise<SofaEvent[]> {
  const key = `sofa:events:${date}`
  const cached = apiCache.get<SofaEvent[]>(key)
  if (cached) return cached

  const data = await sofaFetch<{ events?: SofaEvent[] }>(
    `/sport/football/scheduled-events/${date}`
  )
  const events = data?.events ?? []
  apiCache.set(key, events, TTL.FIXTURES_TODAY)
  return events
}

// ── Team's last 15 events (home + away combined) ───────────────────────────────
// GET /team/{teamId}/events/last/0
// Returns up to 15 finished events. Used to calculate form and stats locally.

export async function getTeamLastEvents(teamId: number): Promise<SofaEvent[]> {
  const key = `sofa:team:${teamId}:last`
  const cached = apiCache.get<SofaEvent[]>(key)
  if (cached) return cached

  const data = await sofaFetch<{ events?: SofaEvent[] }>(
    `/team/${teamId}/events/last/0`
  )
  const events = data?.events ?? []
  apiCache.set(key, events, TTL.TEAM_STATS)
  return events
}

// ── Aggregate H2H between the two teams in an event ───────────────────────────
// GET /event/{eventId}/h2h
// Returns { teamDuel: { homeWins, awayWins, draws } }.
// Does NOT return individual match results.

export async function getEventH2H(eventId: number): Promise<SofaH2H | null> {
  const key = `sofa:h2h:${eventId}`
  const cached = apiCache.get<SofaH2H>(key)
  if (cached) return cached

  const data = await sofaFetch<SofaH2H>(`/event/${eventId}/h2h`)
  if (!data?.teamDuel) return null
  apiCache.set(key, data, TTL.H2H)
  return data
}

// ── Team season statistics from a specific tournament/season ──────────────────
// GET /team/{teamId}/unique-tournament/{utId}/season/{seasonId}/statistics/overall
// Returns rich stats: goalsScored, cleanSheets, avgRating, etc.

export async function getTeamSeasonStats(
  teamId: number,
  uniqueTournamentId: number,
  seasonId: number,
): Promise<SofaTeamSeasonStats | null> {
  const key = `sofa:stats:${teamId}:${uniqueTournamentId}:${seasonId}`
  const cached = apiCache.get<SofaTeamSeasonStats>(key)
  if (cached) return cached

  const data = await sofaFetch<{ statistics?: SofaTeamSeasonStats }>(
    `/team/${teamId}/unique-tournament/${uniqueTournamentId}/season/${seasonId}/statistics/overall`
  )
  const stats = data?.statistics ?? null
  if (stats) apiCache.set(key, stats, TTL.TEAM_STATS)
  return stats
}

// ── Event lineups ─────────────────────────────────────────────────────────────
// GET /event/{eventId}/lineups
// Returns starting XI + substitutes with per-player statistics (if confirmed).

export async function getEventLineups(eventId: number): Promise<SofaLineup | null> {
  const key = `sofa:lineups:${eventId}`
  const cached = apiCache.get<SofaLineup>(key)
  if (cached) return cached

  const data = await sofaFetch<SofaLineup>(`/event/${eventId}/lineups`)
  if (!data) return null
  // Cache longer if confirmed (won't change), shorter if not yet announced
  const ttl = data.confirmed ? TTL.TEAM_STATS : TTL.INJURIES
  apiCache.set(key, data, ttl)
  return data
}
