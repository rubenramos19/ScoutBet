// ─── Football-Data.org → Game Mapper ─────────────────────────────────────────
// Pure functions only. No side-effects, no API calls.
// Stats calculated locally from match history.
// Rule: null when data insufficient — never invent defaults.

import type {
  Game, GameStatus, TeamSummary,
  TeamStats, H2HRecord, GameStats,
  PlayerInForm, FormResult,
} from '@/types'
import type { FDMatch, FDH2HResponse } from '@/lib/footballData'
import { calculateDataQualityScore } from '@/lib/score'

// ── Competition prestige (higher = shown first) ───────────────────────────────

const PRESTIGE: Record<string, number> = {
  WC:  13,   // FIFA World Cup
  EC:  12,   // UEFA European Championship
  CL:  11,   // UEFA Champions League
  PL:  10,   // Premier League
  SA:   9,   // Serie A
  PD:   9,   // La Liga
  BL1:  8,   // Bundesliga
  FL1:  8,   // Ligue 1
  DED:  7,   // Eredivisie
  PPL:  7,   // Primeira Liga
  BSA:  6,   // Brasileirão
  ELC:  5,   // Championship
}

export function fdPrestigeScore(m: FDMatch): number {
  const base   = PRESTIGE[m.competition.code] ?? 3
  const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED'
  return base + (isLive ? 3 : 0)
}

// ── Status mapping ─────────────────────────────────────────────────────────────

function mapStatus(s: string): GameStatus {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE'
  if (s === 'FINISHED' || s === 'AWARDED') return 'FINISHED'
  if (s === 'POSTPONED') return 'POSTPONED'
  if (s === 'CANCELLED' || s === 'SUSPENDED') return 'CANCELLED'
  return 'SCHEDULED'   // SCHEDULED, TIMED
}

// ── TLA → flag emoji ──────────────────────────────────────────────────────────

const TLA_TO_ALPHA2: Record<string, string> = {
  ECU:'EC', GER:'DE', CIV:'CI', CUW:'CW', JPN:'JP', SWE:'SE',
  TUN:'TN', NED:'NL', MAR:'MA', MAS:'MA', ENG:'GB', FRA:'FR',
  ESP:'ES', BRA:'BR', ARG:'AR', POR:'PT', ITA:'IT', USA:'US',
  MEX:'MX', URU:'UY', COL:'CO', CHI:'CL', PER:'PE', AUS:'AU',
  SEN:'SN', GHA:'GH', CMR:'CM', NGA:'NG', IRN:'IR', KOR:'KR',
  KSA:'SA', QAT:'QA', BEL:'BE', DEN:'DK', CRO:'HR', SUI:'CH',
  POL:'PL', SRB:'RS', CAN:'CA', WAL:'GB', SCO:'GB',
}

function flagEmoji(tla: string): string {
  const a2 = TLA_TO_ALPHA2[tla?.toUpperCase() ?? '']
  if (!a2) return '🏆'
  const cp = [...a2.toUpperCase()].map(c => 0x1F1A5 + c.charCodeAt(0))
  return String.fromCodePoint(...cp)
}

// ── Core stats calculator ──────────────────────────────────────────────────────
// Input:  last N finished matches from /teams/{id}/matches
// Output: TeamStats with all fields calculated from real results, null if no data

export function calculateFDTeamStats(
  matches: FDMatch[],
  teamId: number,
): TeamStats {
  const finished = matches.filter(m =>
    (m.status === 'FINISHED' || m.status === 'AWARDED') &&
    m.score.fullTime.home !== null &&
    m.score.fullTime.away !== null &&
    (m.homeTeam.id === teamId || m.awayTeam.id === teamId)
  )

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
      gamesAnalyzed:   0,
    }
  }

  // FD returns matches sorted by date ascending → most recent last
  const rows = finished.map(m => {
    const isHome       = m.homeTeam.id === teamId
    const goalsFor     = isHome ? m.score.fullTime.home! : m.score.fullTime.away!
    const goalsAgainst = isHome ? m.score.fullTime.away! : m.score.fullTime.home!
    const total        = goalsFor + goalsAgainst

    let result: FormResult
    if      (m.score.winner === null)                              result = 'D'
    else if (m.score.winner === 'DRAW')                           result = 'D'
    else if (m.score.winner === 'HOME_TEAM' && isHome)            result = 'W'
    else if (m.score.winner === 'AWAY_TEAM' && !isHome)           result = 'W'
    else                                                           result = 'L'

    return { goalsFor, goalsAgainst, total, isHome, result }
  })

  // Most-recent-first for form arrays
  const byRecency = [...rows].reverse()

  const formLast5:  FormResult[] = byRecency.slice(0, 5).map(r => r.result)
  const formLast10: FormResult[] = byRecency.slice(0, 10).map(r => r.result)

  const n            = rows.length
  const goalsFor     = rows.reduce((s, r) => s + r.goalsFor,     0)
  const goalsAgainst = rows.reduce((s, r) => s + r.goalsAgainst, 0)
  const bttsCount    = rows.filter(r => r.goalsFor > 0 && r.goalsAgainst > 0).length
  const over25Count  = rows.filter(r => r.total >= 3).length
  const cleanSheetCnt = rows.filter(r => r.goalsAgainst === 0).length

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
    avgRating:       null,
    gamesAnalyzed:   n,
  }
}

// ── Derived game stats ─────────────────────────────────────────────────────────

function deriveGameStats(home: TeamStats, away: TeamStats): GameStats {
  const avg = (a: number | null, b: number | null) =>
    a !== null && b !== null ? parseFloat(((a + b) / 2).toFixed(1)) : null
  return {
    avgGoals:   avg(home.goalsForAvg, away.goalsForAvg),
    bttsPct:    avg(home.bttsPct,     away.bttsPct),
    over25Pct:  avg(home.over25Pct,   away.over25Pct),
    homeWinPct: home.homeWinPct,
  }
}

// ── H2H mapper ────────────────────────────────────────────────────────────────

export function mapFDH2H(h2h: FDH2HResponse, homeTeamId: number): H2HRecord {
  const { aggregates, matches } = h2h
  if (!aggregates) {
    return { homeWins: 0, draws: 0, awayWins: 0, last5: [], avgTotalGoals: null }
  }

  const homeIsAggHome = aggregates.homeTeam.id === homeTeamId
  const homeWins = homeIsAggHome ? aggregates.homeTeam.wins : aggregates.awayTeam.wins
  const awayWins = homeIsAggHome ? aggregates.awayTeam.wins : aggregates.homeTeam.wins
  const draws    = aggregates.homeTeam.draws

  const last5 = [...matches]
    .filter(m => m.score.fullTime.home !== null)
    .slice(-5)
    .map((m): 'H' | 'A' | 'D' => {
      if (!m.score.winner || m.score.winner === 'DRAW') return 'D'
      if (m.score.winner === 'HOME_TEAM') return m.homeTeam.id === homeTeamId ? 'H' : 'A'
      return m.awayTeam.id === homeTeamId ? 'H' : 'A'
    })

  const avgTotalGoals = aggregates.numberOfMatches > 0
    ? parseFloat((aggregates.totalGoals / aggregates.numberOfMatches).toFixed(2))
    : null

  return {
    homeWins,
    draws,
    awayWins,
    totalGames:    aggregates.numberOfMatches,
    last5,
    avgTotalGoals,
  }
}

// ── Main match → Game mapper ───────────────────────────────────────────────────

export function mapFDMatchToGame(
  match:      FDMatch,
  rank:       number,
  homeStats:  TeamStats,
  awayStats:  TeamStats,
  h2h:        H2HRecord,
): Game {
  const homeTeam: TeamSummary = {
    id:        String(match.homeTeam.id),
    name:      match.homeTeam.name,
    shortName: match.homeTeam.tla,
    logoUrl:   match.homeTeam.crest ?? null,
    logoEmoji: flagEmoji(match.homeTeam.tla),
  }
  const awayTeam: TeamSummary = {
    id:        String(match.awayTeam.id),
    name:      match.awayTeam.name,
    shortName: match.awayTeam.tla,
    logoUrl:   match.awayTeam.crest ?? null,
    logoEmoji: flagEmoji(match.awayTeam.tla),
  }

  const stats  = deriveGameStats(homeStats, awayStats)
  const status = mapStatus(match.status)
  const round  = match.matchday
    ? `Jornada ${match.matchday}`
    : (match.stage ?? match.group ?? 'Fase de grupos')

  const playersInForm: PlayerInForm[] = []   // lineups not on free tier

  const partial: Omit<Game, 'dataQualityScore'> = {
    id:            `fd-${match.id}`,
    fixtureId:     match.id,
    date:          match.utcDate,
    status,
    league:        match.competition.name,
    leagueCountry: match.competition.code,
    leagueLogo:    match.competition.emblem,
    round,
    homeTeam,
    awayTeam,
    homeTeamStats: homeStats,
    awayTeamStats: awayStats,
    injuries:      [],
    playersInForm,
    h2h,
    stats,
    odds:          null,
    featuredRank:  rank,
    homeScore:     match.score.fullTime.home,
    awayScore:     match.score.fullTime.away,
    liveMinute:    null,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}
