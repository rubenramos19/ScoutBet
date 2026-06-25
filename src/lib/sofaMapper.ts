// ─── SofaScore → Game Mapper ──────────────────────────────────────────────────
// Pure functions only. No side-effects, no API calls.
// All statistics are calculated locally from raw match results.
//
// Rule: if data is insufficient, return null — NEVER return invented defaults.

import type {
  Game,
  GameStatus,
  TeamSummary,
  TeamStats,
  H2HRecord,
  GameStats,
  PlayerInForm,
  FormResult,
} from '@/types'
import type {
  SofaEvent,
  SofaH2H,
  SofaLineup,
  SofaLineupPlayer,
  SofaTeamSeasonStats,
} from './sofaScore'
import { calculateDataQualityScore } from './score'

// ── Status mapping ─────────────────────────────────────────────────────────────

function mapStatus(code: number, type: string): GameStatus {
  if (type === 'inprogress') return 'LIVE'
  if (type === 'finished')   return 'FINISHED'
  if (type === 'notstarted') return 'SCHEDULED'
  if (type === 'postponed')  return 'POSTPONED'
  if (type === 'canceled')   return 'CANCELLED'
  // Fallback by code
  if (code === 0)  return 'SCHEDULED'
  if (code === 7)  return 'FINISHED'
  if (code === 31) return 'POSTPONED'
  if (code === 40) return 'CANCELLED'
  return 'SCHEDULED'
}

// ── League prestige scoring (SofaScore uniqueTournament IDs) ──────────────────
// Higher score → shown first in the dashboard top-5.

const LEAGUE_PRESTIGE: Record<number, number> = {
  16:    12,   // FIFA World Cup
  17338: 12,   // FIFA World Cup 2026 (may differ from 16)
  1:     11,   // UEFA Champions League
  17:    10,   // UEFA European Championship
  133:   10,   // Copa America
  679:   9,    // UEFA Conference League
  7:     9,    // UEFA Europa League
  8:     9,    // English Premier League
  238:   8,    // La Liga
  35:    8,    // Bundesliga
  23:    8,    // Serie A
  34:    7,    // Ligue 1
  244:   7,    // Primeira Liga
  242:   7,    // MLS
  11:    8,    // Copa Libertadores
}

export function sofaPrestigeScore(event: SofaEvent): number {
  const utId  = event.tournament.uniqueTournament?.id ?? 0
  const base  = LEAGUE_PRESTIGE[utId] ?? 4
  const status = mapStatus(event.status.code, event.status.type)
  const bonus  = status === 'LIVE' ? 3 : status === 'SCHEDULED' ? 1 : 0
  return base + bonus
}

// ── Team name helpers ──────────────────────────────────────────────────────────

function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

// ── Flag emoji from ISO 3166-1 alpha-2 ────────────────────────────────────────

function flagEmoji(alpha2?: string): string {
  if (!alpha2 || alpha2.length !== 2) return '🏆'
  // Regional Indicator Symbol Letters: 🇦 = U+1F1E6, offset from 'A' = 65
  const cp = [...alpha2.toUpperCase()].map(c => 0x1F1A5 + c.charCodeAt(0))
  return String.fromCodePoint(...cp)
}

// ── Core team stats calculator ─────────────────────────────────────────────────
// Input:  events from GET /team/{teamId}/events/last/0
// Output: TeamStats with all fields calculated from real match results
//         or null for fields that cannot be calculated.

export function calculateTeamStats(
  events: SofaEvent[],
  teamId: number,
): TeamStats {
  const finished = events.filter(e => e.status.type === 'finished')

  if (finished.length === 0) {
    return {
      teamId:          String(teamId),
      goalsForAvg:     null,
      goalsAgainstAvg: null,
      homeWinPct:      null,
      awayWinPct:      null,
      formLast5:       [],
      formLast10:      [],
      cleanSheets:     null,
      bttsPct:         null,
      over25Pct:       null,
      over15Pct:       null,
      under25Pct:      null,
      avgRating:       null,
      gamesAnalyzed:   0,
    }
  }

  // Build match rows with goals and home/away context
  const rows = finished.map(e => {
    const isHome       = e.homeTeam.id === teamId
    const goalsFor     = isHome ? (e.homeScore.current ?? 0) : (e.awayScore.current ?? 0)
    const goalsAgainst = isHome ? (e.awayScore.current ?? 0) : (e.homeScore.current ?? 0)
    const total        = goalsFor + goalsAgainst

    let result: FormResult
    if      (goalsFor > goalsAgainst) result = 'W'
    else if (goalsFor < goalsAgainst) result = 'L'
    else                              result = 'D'

    return { goalsFor, goalsAgainst, total, isHome, result }
  })

  // SofaScore last/0 returns oldest-first → reverse for most-recent-first form
  const byRecency = [...rows].reverse()

  const formLast5:  FormResult[] = byRecency.slice(0, 5).map(r => r.result)
  const formLast10: FormResult[] = byRecency.slice(0, 10).map(r => r.result)

  const n              = rows.length
  const goalsFor       = rows.reduce((s, r) => s + r.goalsFor,     0)
  const goalsAgainst   = rows.reduce((s, r) => s + r.goalsAgainst, 0)
  const bttsCount      = rows.filter(r => r.goalsFor > 0 && r.goalsAgainst > 0).length
  const over25Count    = rows.filter(r => r.total >= 3).length
  const over15Count    = rows.filter(r => r.total >= 2).length
  const under25Count   = rows.filter(r => r.total <= 2).length
  const cleanSheetCnt  = rows.filter(r => r.goalsAgainst === 0).length

  const homeGames = rows.filter(r => r.isHome)
  const awayGames = rows.filter(r => !r.isHome)
  const homeWins  = homeGames.filter(r => r.result === 'W').length
  const awayWins  = awayGames.filter(r => r.result === 'W').length

  return {
    teamId:          String(teamId),
    goalsForAvg:     parseFloat((goalsFor     / n).toFixed(2)),
    goalsAgainstAvg: parseFloat((goalsAgainst / n).toFixed(2)),
    homeWinPct:      homeGames.length > 0 ? Math.round((homeWins / homeGames.length) * 100) : null,
    awayWinPct:      awayGames.length > 0 ? Math.round((awayWins / awayGames.length) * 100) : null,
    formLast5,
    formLast10,
    cleanSheets:     Math.round((cleanSheetCnt / n) * 100),
    bttsPct:         Math.round((bttsCount     / n) * 100),
    over25Pct:       Math.round((over25Count   / n) * 100),
    over15Pct:       Math.round((over15Count   / n) * 100),
    under25Pct:      Math.round((under25Count  / n) * 100),
    avgRating:       null,  // populated by mergeWithSeasonStats if available
    gamesAnalyzed:   n,
  }
}

// ── Merge form-based stats with season statistics ─────────────────────────────
// Season stats (goals/game, clean sheets, avgRating) are more reliable
// for the full season than the last 15 games.

export function mergeWithSeasonStats(
  base: TeamStats,
  season: SofaTeamSeasonStats | null,
): TeamStats {
  if (!season) return base

  const m = season.matches
  return {
    ...base,
    goalsForAvg: (season.goalsScored != null && m)
      ? parseFloat((season.goalsScored / m).toFixed(2))
      : base.goalsForAvg,
    goalsAgainstAvg: (season.goalsConceded != null && m)
      ? parseFloat((season.goalsConceded / m).toFixed(2))
      : base.goalsAgainstAvg,
    cleanSheets: (season.cleanSheets != null && m)
      ? Math.round((season.cleanSheets / m) * 100)
      : base.cleanSheets,
    avgRating: season.avgRating ?? base.avgRating,
  }
}

// ── Derive combined game stats from home + away TeamStats ─────────────────────

export function deriveGameStats(home: TeamStats, away: TeamStats): GameStats {
  function avg(a: number | null, b: number | null): number | null {
    if (a === null || b === null) return null
    return parseFloat(((a + b) / 2).toFixed(1))
  }
  return {
    avgGoals:   avg(home.goalsForAvg,  away.goalsForAvg),
    bttsPct:    avg(home.bttsPct,      away.bttsPct),
    over25Pct:  avg(home.over25Pct,    away.over25Pct),
    homeWinPct: home.homeWinPct,
  }
}

// ── H2H mapper ────────────────────────────────────────────────────────────────
// SofaScore only provides aggregate wins/draws/losses — no individual matches.

export function mapSofaH2H(h2h: SofaH2H): H2HRecord {
  const { homeWins, awayWins, draws } = h2h.teamDuel
  return {
    homeWins,
    awayWins,
    draws,
    totalGames:    homeWins + draws + awayWins,
    last5:         [],   // not available from aggregate endpoint
    avgTotalGoals: null, // not available without individual match data
  }
}

// ── Featured players from confirmed lineups ───────────────────────────────────
// Returns up to 6 starters sorted by rating.
// If lineup is not confirmed, returns empty array.

export function mapFeaturedPlayers(
  lineup: SofaLineup,
  homeTeamName: string,
  awayTeamName: string,
): PlayerInForm[] {
  if (!lineup.confirmed) return []

  const players: PlayerInForm[] = []

  function extract(
    sidePlayers: SofaLineupPlayer[] | undefined,
    teamName: string,
  ): void {
    if (!sidePlayers?.length) return
    for (const p of sidePlayers) {
      if (p.substitute) continue
      if (!p.statistics?.rating) continue
      players.push({
        player:       p.player.name,
        team:         teamName,
        goalsLast5:   null,   // incidents endpoint not available
        assistsLast5: null,
        goalsSeason:  null,   // requires separate player stats call
        assistsSeason: null,
        ratingAvg:    p.statistics.rating,
        position:     p.player.position ?? p.position ?? null,
        jerseyNumber: p.player.jerseyNumber ?? p.jerseyNumber ?? null,
      })
    }
  }

  extract(lineup.home?.players, homeTeamName)
  extract(lineup.away?.players, awayTeamName)

  return players
    .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))
    .slice(0, 6)
}

// ── Main event mapper ─────────────────────────────────────────────────────────
// Combines a SofaEvent with pre-computed stats into a full Game object.

export function mapSofaEvent(
  event: SofaEvent,
  rank: number,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HRecord,
  players: PlayerInForm[],
): Game {
  const homeTeam: TeamSummary = {
    id:        String(event.homeTeam.id),
    name:      event.homeTeam.name,
    shortName: event.homeTeam.nameCode || abbreviate(event.homeTeam.name),
    logoUrl:   null,
    logoEmoji: flagEmoji(event.homeTeam.country?.alpha2),
  }
  const awayTeam: TeamSummary = {
    id:        String(event.awayTeam.id),
    name:      event.awayTeam.name,
    shortName: event.awayTeam.nameCode || abbreviate(event.awayTeam.name),
    logoUrl:   null,
    logoEmoji: flagEmoji(event.awayTeam.country?.alpha2),
  }

  const stats  = deriveGameStats(homeStats, awayStats)
  const status = mapStatus(event.status.code, event.status.type)
  const date   = new Date(event.startTimestamp * 1000).toISOString()

  const round  = event.roundInfo?.name
    ?? (event.roundInfo?.round != null ? `Ronda ${event.roundInfo.round}` : 'Ronda')

  const league = event.tournament.uniqueTournament?.name ?? event.tournament.name

  const partial: Omit<Game, 'dataQualityScore'> = {
    id:            `sofa-${event.id}`,
    fixtureId:     event.id,
    date,
    status,
    league,
    leagueCountry: event.tournament.category?.name ?? '',
    round,
    homeTeam,
    awayTeam,
    homeTeamStats: homeStats,
    awayTeamStats: awayStats,
    injuries:      [],
    playersInForm: players,
    h2h,
    stats,
    odds:          null,
    featuredRank:  rank,
    homeScore:     event.homeScore.current ?? null,
    awayScore:     event.awayScore.current ?? null,
    liveMinute:    null,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}
