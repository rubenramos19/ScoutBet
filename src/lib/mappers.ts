// ─── API → Internal Type Mappers ─────────────────────────────────────────────
// Pure functions: (raw API data) → (internal types).
// No side-effects, no async calls. If the API shape changes, only fix here.

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

/** Generate a 2–3 char abbreviation from a team name */
function abbreviate(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  // Multi-word: take first letter of each word, max 3 chars
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

// ── TeamStats ─────────────────────────────────────────────────────────────────

export function mapTeamStats(
  raw: ApiTeamStats,
  venue: 'home' | 'away',
): TeamStats {
  const played = raw.fixtures.played[venue]
  const wins   = raw.fixtures.wins[venue]

  const avgFor     = parseFloat(raw.goals.for.average[venue]     ?? '0') || 0
  const avgAgainst = parseFloat(raw.goals.against.average[venue] ?? '0') || 0
  const avgTotal   = avgFor + avgAgainst

  // Heuristic estimates — real BTTS/Over requires per-fixture data (costly).
  // Sprint 6 will refine with historical fixture analysis.
  const bttsPct   = Math.round(clamp(avgFor * 20 + avgAgainst * 18, 20, 92))
  const over25Pct = Math.round(clamp(avgTotal * 22, 20, 88))

  return {
    teamId:          String(raw.team.id),
    goalsForAvg:     avgFor,
    goalsAgainstAvg: avgAgainst,
    homeWinPct:      played > 0 ? Math.round((wins / played) * 100) : 50,
    awayWinPct:      played > 0 ? Math.round((wins / played) * 100) : 40,
    formLast5:       mapFormString(raw.form, 5),
    formLast10:      mapFormString(raw.form, 10),
    cleanSheets:     raw.clean_sheet[venue],
    bttsPct,
    over25Pct,
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
      // Fixture was played at the away team's ground — perspective is reversed
      if (aGoals > hGoals) { homeWins++; results.push('H') }
      else                  { awayWins++; results.push('A') }
    }
  }

  return {
    homeWins,
    draws,
    awayWins,
    last5:        results,
    avgTotalGoals: last5.length > 0
      ? parseFloat((totalGoals / last5.length).toFixed(1))
      : 2.5,
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
      const type:     string        = inj.player.type ?? inj.player.reason ?? 'Unknown'
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
  return {
    avgGoals:   parseFloat(((home.goalsForAvg + away.goalsForAvg) / 2).toFixed(1)),
    bttsPct:    Math.round((home.bttsPct   + away.bttsPct)   / 2),
    over25Pct:  Math.round((home.over25Pct + away.over25Pct) / 2),
    homeWinPct: home.homeWinPct,
  }
}

// ── Players in form ───────────────────────────────────────────────────────────
// We skip /players calls in Sprint 2 to stay within the 100/day budget.
// The ApiStandingRow type is declared here for use in Sprint 3.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type { ApiStandingRow }

// ── Full Game mapper ──────────────────────────────────────────────────────────

export interface GameMapperInput {
  fixture:      ApiFixture
  homeStats:    ApiTeamStats | null
  awayStats:    ApiTeamStats | null
  h2hFixtures:  ApiFixture[]
  injuries:     ApiInjury[]
  rank:         number
}

export function mapGame(input: GameMapperInput): Game {
  const { fixture, homeStats, awayStats, h2hFixtures, injuries, rank } = input

  const homeTeam = mapTeamSummary(fixture.teams.home)
  const awayTeam = mapTeamSummary(fixture.teams.away)

  const homeTeamStats = homeStats
    ? mapTeamStats(homeStats, 'home')
    : buildFallbackStats(homeTeam.id)

  const awayTeamStats = awayStats
    ? mapTeamStats(awayStats, 'away')
    : buildFallbackStats(awayTeam.id)

  const h2h             = mapH2H(h2hFixtures, fixture.teams.home.id)
  const stats           = mapGameStats(homeTeamStats, awayTeamStats)
  const mappedInjuries  = mapInjuries(injuries, [
    fixture.teams.home.name,
    fixture.teams.away.name,
  ])

  // Build partial game first (without DQS) so we can pass it to the scorer
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
    playersInForm: [],    // Sprint 3: /players endpoint
    h2h,
    stats,
    odds:          null,  // Sprint 2b: The Odds API
    featuredRank:  rank > 0 ? rank : null,
    homeScore:     fixture.goals.home,
    awayScore:     fixture.goals.away,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}

// ── League prestige score (for ranking fixtures before fetching details) ───────

const LEAGUE_PRESTIGE: Record<number, number> = {
  2:   10,  // UEFA Champions League
  3:   8,   // UEFA Europa League
  39:  9,   // Premier League
  140: 9,   // La Liga
  78:  8,   // Bundesliga
  135: 8,   // Serie A
  61:  7,   // Ligue 1
  94:  6,   // Primeira Liga
}

export function fixturePrestigeScore(fixture: ApiFixture): number {
  const leagueScore = LEAGUE_PRESTIGE[fixture.league.id] ?? 5
  // Slightly prefer upcoming (NS) over live, to surface pre-game analysis
  const statusBonus = fixture.fixture.status.short === 'NS' ? 2 : 0
  return leagueScore + statusBonus
}

// ── Fallback stats when the API call is unavailable ──────────────────────────

function buildFallbackStats(teamId: string): TeamStats {
  return {
    teamId,
    goalsForAvg:     1.5,
    goalsAgainstAvg: 1.2,
    homeWinPct:      45,
    awayWinPct:      35,
    formLast5:       [],
    formLast10:      [],
    cleanSheets:     0,
    bttsPct:         52,
    over25Pct:       48,
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
