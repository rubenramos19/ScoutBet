// ─── API → Internal Type Mappers ─────────────────────────────────────────────
// Pure functions: (raw API data) → (internal types).
// No side-effects, no async calls. If the API shape changes, only fix here.
//
// Rule: NEVER return invented defaults. If data is missing, return null.

import type {
  ApiFixture,
  ApiTeamStats,
  ApiInjury,
  ApiStandingRow,
} from './apiFootball'
import type {
  Game,
  GameStatus,
  TeamSummary,
  TeamStats,
  Injury,
  InjurySeverity,
  H2HRecord,
  H2HResult,
  GameStats,
  FormResult,
} from '@/types'
import { calculateDataQualityScore } from './score'

// ── Status mapping ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, GameStatus> = {
  TBD:   'SCHEDULED', NS:    'SCHEDULED',
  '1H':  'LIVE',      '2H':  'LIVE',   HT:   'LIVE',
  ET:    'LIVE',      BT:    'LIVE',   P:    'LIVE',
  SUSP:  'LIVE',      INT:   'LIVE',   LIVE: 'LIVE',
  FT:    'FINISHED',  AET:   'FINISHED', PEN: 'FINISHED',
  WO:    'FINISHED',  AWD:   'FINISHED',
  PST:   'POSTPONED',
  CANC:  'CANCELLED', ABD:   'CANCELLED',
}

export function mapStatus(short: string): GameStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED'
}

export function isActiveGame(status: GameStatus): boolean {
  return status === 'SCHEDULED' || status === 'LIVE'
}

// ── Form string → FormResult[] ────────────────────────────────────────────────
// API returns "WWDLW" with the MOST RECENT result LAST.
// We reverse so index 0 is always the most recent (matches UI expectations).

export function mapFormString(form: string | null | undefined, n: number): FormResult[] {
  if (!form) return []
  return form
    .split('')
    .filter((c): c is FormResult => c === 'W' || c === 'D' || c === 'L')
    .slice(-n)
    .reverse()
}

// ── TeamSummary ───────────────────────────────────────────────────────────────

export function mapTeamSummary(
  raw: { id: number; name: string; logo: string },
): TeamSummary {
  return {
    id:        String(raw.id),
    name:      raw.name,
    shortName: abbreviate(raw.name),
    logoUrl:   raw.logo ?? null,
    logoEmoji: undefined,
  }
}

function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

// ── TeamStats ─────────────────────────────────────────────────────────────────
// Only returns real data from the API. No invented defaults.

export function mapTeamStats(
  raw: ApiTeamStats,
  venue: 'home' | 'away',
): TeamStats {
  const played = raw.fixtures.played[venue]
  const wins   = raw.fixtures.wins[venue]

  const avgFor     = parseFloat(raw.goals.for.average[venue]     ?? '0') || null
  const avgAgainst = parseFloat(raw.goals.against.average[venue] ?? '0') || null

  // BTTS and over2.5 require per-fixture data which we don't fetch on free tier.
  // Returning null is honest; the UI will show 'Dados indisponíveis'.
  return {
    teamId:          String(raw.team.id),
    goalsForAvg:     avgFor,
    goalsAgainstAvg: avgAgainst,
    homeWinPct:      played > 0 ? Math.round((wins / played) * 100) : null,
    awayWinPct:      played > 0 ? Math.round((wins / played) * 100) : null,
    formLast5:       mapFormString(raw.form, 5),
    formLast10:      mapFormString(raw.form, 10),
    cleanSheets:     raw.fixtures.played.total > 0
      ? Math.round((raw.clean_sheet[venue] / raw.fixtures.played.total) * 100)
      : null,
    bttsPct:         null,  // requires per-fixture fetch (Sprint 6)
    over25Pct:       null,  // requires per-fixture fetch (Sprint 6)
  }
}

// ── H2H Record ────────────────────────────────────────────────────────────────

export function mapH2H(fixtures: ApiFixture[], homeTeamId: number): H2HRecord {
  const last5 = fixtures.slice(0, 5)

  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0
  const results: H2HResult[] = []

  for (const fix of last5) {
    const hGoals = fix.goals.home ?? 0
    const aGoals = fix.goals.away ?? 0
    totalGoals += hGoals + aGoals

    if (hGoals === aGoals) {
      draws++
      results.push('D')
    } else if (fix.teams.home.id === homeTeamId) {
      if (hGoals > aGoals) { homeWins++; results.push('H') }
      else                  { awayWins++; results.push('A') }
    } else {
      if (aGoals > hGoals) { homeWins++; results.push('H') }
      else                  { awayWins++; results.push('A') }
    }
  }

  return {
    homeWins,
    draws,
    awayWins,
    last5:         results,
    avgTotalGoals: last5.length > 0
      ? parseFloat((totalGoals / last5.length).toFixed(1))
      : null,
  }
}

// ── Injuries ──────────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, InjurySeverity> = {
  'Muscle Injury':   'high',
  'Knee Injury':     'high',
  'Ligament Injury': 'high',
  'Fracture':        'high',
  'Surgery':         'high',
  'Ankle Injury':    'medium',
  'Hamstring':       'medium',
  'Groin Injury':    'medium',
  'Calf Injury':     'medium',
  'Back Injury':     'medium',
  'Shoulder':        'low',
  'Illness':         'low',
  'Doubtful':        'medium',
  'Suspended':       'medium',
}

export function mapInjuries(
  raw:       ApiInjury[],
  teamNames: string[],
): Injury[] {
  return raw
    .filter(inj => teamNames.includes(inj.team.name))
    .map(inj => {
      const type:     string         = inj.player.type ?? inj.player.reason ?? 'Unknown'
      const severity: InjurySeverity = SEVERITY_MAP[type] ?? 'unknown'
      return {
        player:      inj.player.name,
        team:        inj.team.name,
        type,
        severity,
        status:      inj.player.reason ?? type,
        isKeyPlayer: severity === 'high',
        impactScore: severity === 'high' ? 8 : severity === 'medium' ? 5 : 2,
      }
    })
}

// ── GameStats ─────────────────────────────────────────────────────────────────

export function mapGameStats(home: TeamStats, away: TeamStats): GameStats {
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

// ── Empty H2H (when fetch fails) ─────────────────────────────────────────────

export function emptyH2H(): H2HRecord {
  return { homeWins: 0, draws: 0, awayWins: 0, last5: [], avgTotalGoals: null }
}

// ── Null TeamStats (when fetch fails) ────────────────────────────────────────
// Returns a stats object with all fields null — no invented numbers.

export function nullTeamStats(teamId: string): TeamStats {
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
  }
}

// ── Full Game mapper ──────────────────────────────────────────────────────────

export interface GameMapperInput {
  fixture:     ApiFixture
  homeStats:   ApiTeamStats | null
  awayStats:   ApiTeamStats | null
  h2hFixtures: ApiFixture[]
  injuries:    ApiInjury[]
  rank:        number
}

export function mapGame(input: GameMapperInput): Game {
  const { fixture, homeStats, awayStats, h2hFixtures, injuries, rank } = input

  const homeTeam = mapTeamSummary(fixture.teams.home)
  const awayTeam = mapTeamSummary(fixture.teams.away)

  const homeTeamStats = homeStats
    ? mapTeamStats(homeStats, 'home')
    : nullTeamStats(homeTeam.id)

  const awayTeamStats = awayStats
    ? mapTeamStats(awayStats, 'away')
    : nullTeamStats(awayTeam.id)

  const h2h            = mapH2H(h2hFixtures, fixture.teams.home.id)
  const stats          = mapGameStats(homeTeamStats, awayTeamStats)
  const mappedInjuries = mapInjuries(injuries, [
    fixture.teams.home.name,
    fixture.teams.away.name,
  ])

  const partial: Omit<Game, 'dataQualityScore'> = {
    id:            `fixture-${fixture.fixture.id}`,
    fixtureId:     fixture.fixture.id,
    date:          fixture.fixture.date,
    status:        mapStatus(fixture.fixture.status.short),
    league:        fixture.league.name,
    leagueCountry: fixture.league.country,
    leagueLogo:    fixture.league.logo,
    round:         fixture.league.round,
    homeTeam,
    awayTeam,
    homeTeamStats,
    awayTeamStats,
    injuries:      mappedInjuries,
    playersInForm: [],
    h2h,
    stats,
    odds:          null,
    featuredRank:  rank > 0 ? rank : null,
    homeScore:     fixture.goals.home,
    awayScore:     fixture.goals.away,
    liveMinute:    null,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}

// ── League prestige score ─────────────────────────────────────────────────────

const LEAGUE_PRESTIGE: Record<number, number> = {
  1:   13,  // FIFA World Cup
  4:   12,  // UEFA Euro
  9:   11,  // Copa America
  2:   11,  // UEFA Champions League
  15:  10,  // FIFA Club World Cup
  3:   9,   // UEFA Europa League
  848: 8,   // UEFA Conference League
  39:  9,   // Premier League
  140: 9,   // La Liga
  78:  8,   // Bundesliga
  135: 8,   // Serie A
  61:  7,   // Ligue 1
  94:  6,   // Primeira Liga
}

export function fixturePrestigeScore(fixture: ApiFixture): number {
  const leagueScore  = LEAGUE_PRESTIGE[fixture.league.id] ?? 5
  const statusShort  = fixture.fixture.status.short
  const liveBonus    = (statusShort === '1H' || statusShort === '2H' || statusShort === 'HT') ? 3 : 0
  const upcomingBonus = statusShort === 'NS' ? 1 : 0
  return leagueScore + liveBonus + upcomingBonus
}

// ── Re-export for compatibility ───────────────────────────────────────────────

export type { ApiStandingRow }
