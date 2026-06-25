// ─── ESPN Public API ──────────────────────────────────────────────────────────
// No API key required. CORS open (direct browser fetch works).
// Primary use: FIFA World Cup 2026 fixtures + team stats.
// api-sports free plan blocks season 2026; ESPN is the free alternative.
//
// Endpoints used:
//   scoreboard  : /apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD
//   team sched  : /apis/site/v2/sports/soccer/fifa.world/teams/{id}/schedule?season=YYYY
//   event summary: /apis/site/v2/sports/soccer/fifa.world/summary?event={id}

import { apiCache, TTL } from '@/lib/cache'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const ESPN_LEAGUE = 'fifa.world'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ESPNTeam {
  id:               string
  displayName:      string
  shortDisplayName: string
  abbreviation:     string
  logo:             string
  color:            string
}

export interface ESPNRecord {
  name:    string   // "Home", "Away", "All Splits", ...
  type:    string   // "home", "away", "total"
  summary: string   // "W-D-L" e.g. "2-1-0"
}

export interface ESPNCompetitor {
  id:       string
  homeAway: 'home' | 'away'
  score:    string   // "0", "2", etc.
  winner:   boolean
  /** Form string: most-recent-LAST, e.g. "WDLWW" */
  form:     string | null
  records:  ESPNRecord[]
  team:     ESPNTeam
}

export interface ESPNStatusType {
  id:          string
  name:        string   // "STATUS_SCHEDULED", "STATUS_IN_PROGRESS", "STATUS_FINAL", ...
  state:       'pre' | 'in' | 'post'
  completed:   boolean
  description: string
  detail:      string
  shortDetail: string
}

export interface ESPNStatus {
  clock:        number
  displayClock: string
  period:       number
  type:         ESPNStatusType
}

export interface ESPNVenue {
  id:       string
  fullName: string
  address:  { city: string; country: string }
}

export interface ESPNCompetition {
  id:          string
  date:        string
  startDate:   string
  status:      ESPNStatus
  venue?:      ESPNVenue
  competitors: ESPNCompetitor[]
  notes?:      Array<{ type: string; headline: string }>
}

export interface ESPNEvent {
  id:           string
  uid:          string
  date:         string
  name:         string
  shortName:    string
  season: {
    year:  number
    type:  number
    slug:  string  // "group-stage", "round-of-16", "quarterfinals", ...
  }
  competitions: ESPNCompetition[]
}

export interface ESPNScoreboard {
  leagues: Array<{
    id:     string
    name:   string
    season: { year: number }
    entries?: unknown[]
  }>
  events: ESPNEvent[]
}

// Team schedule — one entry per event the team has played
export interface ESPNScheduleEvent {
  id:   string
  date: string
  competitions: Array<{
    id:          string
    date:        string
    status:      ESPNStatus
    competitors: Array<{
      id:       string
      homeAway: 'home' | 'away'
      score:    { value: number; displayValue: string } | string
      winner:   boolean
      team:     { id: string; displayName: string }
    }>
  }>
}

export interface ESPNTeamSchedule {
  team:   ESPNTeam
  events: ESPNScheduleEvent[]
}

// Event summary — boxscore + team stats for a single event
export interface ESPNStatItem {
  name:         string
  abbreviation?: string
  displayValue: string
  label?:       string
}

export interface ESPNBoxscoreTeam {
  team:       ESPNTeam
  statistics: ESPNStatItem[]
}

export interface ESPNSummary {
  boxscore?: {
    teams?: ESPNBoxscoreTeam[]
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function espnGet<T>(path: string, cacheKey: string, ttl: number): Promise<T | null> {
  const cached = apiCache.get<T>(cacheKey)
  if (cached) return cached

  const url = `${ESPN_BASE}/${ESPN_LEAGUE}${path}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[ESPN] ${res.status} GET ${url}`)
      return null
    }
    const data = await res.json() as T
    apiCache.set(cacheKey, data, ttl)
    return data
  } catch (err) {
    console.warn(`[ESPN] fetch error ${url}:`, err)
    return null
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * All WC events for a given date (YYYY-MM-DD).
 * Typically 4–8 events per day during the group stage.
 */
export async function getESPNScoreboard(date: string): Promise<ESPNScoreboard | null> {
  const espnDate = date.replace(/-/g, '')  // YYYYMMDD
  return espnGet<ESPNScoreboard>(
    `/scoreboard?dates=${espnDate}`,
    `espn:scoreboard:${date}`,
    TTL.FIXTURES_TODAY,
  )
}

/**
 * All WC events the team has played (or will play) in the given season.
 * Used to compute real goals/game, BTTS%, over2.5% from completed matches.
 */
export async function getESPNTeamSchedule(
  teamId: string,
  season = 2026,
): Promise<ESPNTeamSchedule | null> {
  return espnGet<ESPNTeamSchedule>(
    `/teams/${teamId}/schedule?season=${season}`,
    `espn:team:${teamId}:schedule:${season}`,
    TTL.TEAM_STATS,
  )
}

/**
 * Live + post-match boxscore stats for a single event.
 * Contains: possession %, shots on target, corners, fouls, etc.
 */
export async function getESPNEventSummary(eventId: string): Promise<ESPNSummary | null> {
  return espnGet<ESPNSummary>(
    `/summary?event=${eventId}`,
    `espn:summary:${eventId}`,
    TTL.FIXTURES_TODAY,
  )
}
