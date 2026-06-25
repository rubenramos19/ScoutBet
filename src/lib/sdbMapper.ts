// ─── TheSportsDB → Internal Game Mapper ───────────────────────────────────────
// Pure functions: SportsDbEvent → Game.
// No side-effects, no API calls.
// Stats/H2H/injuries are not available from the free tier — defaults are used.

import type {
  Game,
  GameStatus,
  TeamSummary,
  TeamStats,
  H2HRecord,
  GameStats,
} from '@/types'
import type { SportsDbEvent } from './theSportsDb'
import { calculateDataQualityScore } from './score'

// ── Status mapping ─────────────────────────────────────────────────────────────
// TheSportsDB uses codes similar to API-Football.

const STATUS_MAP: Record<string, GameStatus> = {
  NS:   'SCHEDULED',
  TBD:  'SCHEDULED',
  '1H': 'LIVE',
  HT:   'LIVE',
  '2H': 'LIVE',
  ET:   'LIVE',
  BT:   'LIVE',
  P:    'LIVE',
  SUSP: 'LIVE',
  LIVE: 'LIVE',
  FT:   'FINISHED',
  AET:  'FINISHED',
  PEN:  'FINISHED',
  WO:   'FINISHED',
  AWD:  'FINISHED',
  PST:  'POSTPONED',
  CANC: 'CANCELLED',
  ABD:  'CANCELLED',
}

export function mapSdbStatus(strStatus: string, strPostponed: string): GameStatus {
  if (strPostponed === 'yes') return 'POSTPONED'
  return STATUS_MAP[strStatus?.toUpperCase()] ?? 'SCHEDULED'
}

// ── League prestige (TheSportsDB IDs) ─────────────────────────────────────────
// Higher score → shown first in the dashboard top-5.

const LEAGUE_PRESTIGE: Record<string, number> = {
  '4429': 12,   // FIFA World Cup
  '4417': 11,   // UEFA European Championship
  '4418': 11,   // Copa America
  '4423': 10,   // FIFA Club World Cup
  '4480': 10,   // UEFA Champions League
  '4424': 9,    // UEFA Nations League
  '4328': 9,    // English Premier League
  '4335': 9,    // La Liga
  '4331': 8,    // Bundesliga
  '4332': 8,    // Serie A
  '4481': 8,    // UEFA Europa League
  '4334': 7,    // Ligue 1
  '4344': 6,    // Primeira Liga
  '4387': 6,    // MLS
}

export function sdbPrestigeScore(event: SportsDbEvent): number {
  const base   = LEAGUE_PRESTIGE[event.idLeague] ?? 4
  const status = mapSdbStatus(event.strStatus, event.strPostponed)
  // LIVE games get a slight boost to appear first among same-league games
  const bonus  = status === 'LIVE' ? 3 : status === 'SCHEDULED' ? 1 : 0
  return base + bonus
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

/** Empty stats — all numeric fields null (no invented defaults). */
function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    goalsForAvg:     null,
    goalsAgainstAvg: null,
    homeWinPct:      null,
    awayWinPct:      null,
    formLast5:       [],
    formLast10:      [],
    cleanSheets:     null,
    bttsPct:         null,
    over25Pct:       null,
    gamesAnalyzed:   0,
  }
}

function emptyH2H(): H2HRecord {
  return { homeWins: 0, draws: 0, awayWins: 0, last5: [], avgTotalGoals: null }
}

function deriveGameStats(home: TeamStats, away: TeamStats): GameStats {
  function avg(a: number | null, b: number | null): number | null {
    if (a == null || b == null) return null
    return parseFloat(((a + b) / 2).toFixed(1))
  }
  return {
    avgGoals:   avg(home.goalsForAvg,  away.goalsForAvg),
    bttsPct:    avg(home.bttsPct,      away.bttsPct),
    over25Pct:  avg(home.over25Pct,    away.over25Pct),
    homeWinPct: home.homeWinPct,
  }
}

// ── Main mapper ────────────────────────────────────────────────────────────────

export function mapSdbEvent(event: SportsDbEvent, rank: number): Game {
  const homeId = 'sdb-' + event.idHomeTeam
  const awayId = 'sdb-' + event.idAwayTeam

  const homeTeam: TeamSummary = {
    id:        homeId,
    name:      event.strHomeTeam,
    shortName: abbreviate(event.strHomeTeam),
    logoUrl:   event.strHomeTeamBadge ?? null,
  }
  const awayTeam: TeamSummary = {
    id:        awayId,
    name:      event.strAwayTeam,
    shortName: abbreviate(event.strAwayTeam),
    logoUrl:   event.strAwayTeamBadge ?? null,
  }

  const homeTeamStats = emptyTeamStats(homeId)
  const awayTeamStats = emptyTeamStats(awayId)
  const h2h           = emptyH2H()
  const stats         = deriveGameStats(homeTeamStats, awayTeamStats)
  const status        = mapSdbStatus(event.strStatus, event.strPostponed)

  // TheSportsDB omits the trailing Z on strTimestamp
  const isoDate = event.strTimestamp
    ? (event.strTimestamp.endsWith('Z') ? event.strTimestamp : event.strTimestamp + 'Z')
    : (event.dateEvent + 'T' + (event.strTime ?? '00:00:00') + 'Z')

  // Round label: prefer group (World Cup) over numeric round
  const round = event.strGroup
    ? 'Grupo ' + event.strGroup
    : event.intRound
      ? 'Ronda ' + event.intRound
      : 'Ronda'

  const partial: Omit<Game, 'dataQualityScore'> = {
    id:            'sdb-' + event.idEvent,
    fixtureId:     parseInt(event.idEvent, 10),
    date:          isoDate,
    status,
    league:        event.strLeague,
    leagueCountry: event.strCountry ?? '',
    leagueLogo:    event.strLeagueBadge ?? undefined,
    round,
    homeTeam,
    awayTeam,
    homeTeamStats,
    awayTeamStats,
    injuries:      [],
    playersInForm: [],
    h2h,
    stats,
    odds:          null,
    featuredRank:  rank > 0 ? rank : null,
    homeScore:     event.intHomeScore != null ? parseInt(event.intHomeScore, 10) : null,
    awayScore:     event.intAwayScore != null ? parseInt(event.intAwayScore, 10) : null,
    liveMinute:    null,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}
