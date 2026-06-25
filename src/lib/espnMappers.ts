// ─── ESPN → Internal Type Mappers ─────────────────────────────────────────────
// Pure functions: (ESPN raw data) → (internal Game / TeamStats types).
// No side-effects. No invented numbers — null when data unavailable.
//
// Stats sources:
//   form        → competitor.form string (ESPN scoreboard, always present)
//   W-D-L pct   → competitor.records[type=total].summary ("W-D-L")
//   goals/game  → computed from team schedule completed events
//   BTTS, o2.5  → computed from team schedule completed events
//   H2H         → not available on ESPN free endpoints → emptyH2H()

import type {
  ESPNEvent,
  ESPNCompetitor,
  ESPNTeamSchedule,
} from './espn'
import type {
  Game,
  GameStatus,
  TeamSummary,
  TeamStats,
  GameStats,
} from '@/types'
import { emptyH2H, mapFormString } from './mappers'
import { calculateDataQualityScore } from './score'

// ── Status ────────────────────────────────────────────────────────────────────

const ESPN_STATUS: Record<string, GameStatus> = {
  STATUS_SCHEDULED:   'SCHEDULED',
  STATUS_IN_PROGRESS: 'LIVE',
  STATUS_HALFTIME:    'LIVE',
  STATUS_END_PERIOD:  'LIVE',
  STATUS_FINAL:       'FINISHED',
  STATUS_FULL_TIME:   'FINISHED',
  STATUS_POSTPONED:   'POSTPONED',
  STATUS_CANCELED:    'CANCELLED',
  STATUS_SUSPENDED:   'LIVE',
}

export function espnStatusToGame(espnName: string): GameStatus {
  return ESPN_STATUS[espnName] ?? 'SCHEDULED'
}

// ── TeamSummary ───────────────────────────────────────────────────────────────

export function mapESPNTeamSummary(c: ESPNCompetitor): TeamSummary {
  return {
    id:        c.team.id,
    name:      c.team.displayName,
    shortName: c.team.abbreviation ?? c.team.shortDisplayName ?? c.team.displayName.slice(0, 3).toUpperCase(),
    logoUrl:   c.team.logo ?? null,
  }
}

// ── Goals from schedule ───────────────────────────────────────────────────────
// Walk the completed events in the team's schedule and extract real goals data.

interface GoalStats {
  goalsFor:   number[]   // goals scored in each completed game
  goalsAgainst: number[] // goals conceded in each completed game
}

function extractGoalsFromSchedule(
  schedule: ESPNTeamSchedule | null,
  teamId: string,
): GoalStats {
  const result: GoalStats = { goalsFor: [], goalsAgainst: [] }
  if (!schedule?.events) return result

  for (const ev of schedule.events) {
    const comp = ev.competitions?.[0]
    if (!comp) continue

    const statusName = comp.status?.type?.name ?? ''
    if (!statusName.includes('FINAL') && !statusName.includes('FULL_TIME')) continue

    const myComp   = comp.competitors.find(c => c.id === teamId)
    const oppComp  = comp.competitors.find(c => c.id !== teamId)
    if (!myComp || !oppComp) continue

    const myGoals  = resolveScore(myComp.score)
    const oppGoals = resolveScore(oppComp.score)
    if (myGoals == null || oppGoals == null) continue

    result.goalsFor.push(myGoals)
    result.goalsAgainst.push(oppGoals)
  }

  return result
}

function resolveScore(score: { value: number; displayValue: string } | string | undefined): number | null {
  if (score == null) return null
  if (typeof score === 'string') {
    const n = parseInt(score)
    return isNaN(n) ? null : n
  }
  if (typeof score === 'object' && score.value != null) return score.value
  return null
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2))
}

function pct(arr: boolean[]): number | null {
  if (arr.length === 0) return null
  return Math.round((arr.filter(Boolean).length / arr.length) * 100)
}

// ── TeamStats from ESPN competitor + schedule ─────────────────────────────────

export function mapESPNTeamStats(
  competitor: ESPNCompetitor,
  schedule: ESPNTeamSchedule | null,
): TeamStats {
  const teamId = competitor.team.id

  // Form from ESPN competitor (most-recent-LAST, same as api-sports convention)
  const formLast5  = mapFormString(competitor.form, 5)
  const formLast10 = mapFormString(competitor.form, 10)

  // Win% from tournament record
  let winPct: number | null = null
  const totalRec = competitor.records?.find(r => r.type === 'total')
  if (totalRec?.summary) {
    const parts  = totalRec.summary.split('-').map(Number)
    const [w = 0, d = 0, l = 0] = parts
    const played = w + d + l
    winPct = played > 0 ? Math.round((w / played) * 100) : null
  }

  // Goals from schedule history
  const gs = extractGoalsFromSchedule(schedule, teamId)
  const goalsForAvg     = avg(gs.goalsFor)
  const goalsAgainstAvg = avg(gs.goalsAgainst)

  // BTTS: both teams scored in that game — need combined data, computed in mapESPNGame
  // For individual team stats, we only have goals for/against
  // Clean sheets: games where goalsAgainst === 0
  const csArr     = gs.goalsAgainst.map(g => g === 0)
  const cleanShts = pct(csArr)

  // over2.5 needs combined (for + against per game) — computed in mapESPNGame
  // bttsPct needs combined — computed in mapESPNGame
  // For now, store per-team data; combined stats computed in game mapper

  return {
    teamId,
    goalsForAvg,
    goalsAgainstAvg,
    homeWinPct: competitor.homeAway === 'home' ? winPct : null,
    awayWinPct: competitor.homeAway === 'away' ? winPct : null,
    formLast5,
    formLast10,
    cleanSheets: cleanShts,
    bttsPct:     null,   // needs combined game data → mapESPNGame
    over25Pct:   null,   // needs combined game data → mapESPNGame
  }
}

// ── Combined stats from both schedules ────────────────────────────────────────
// BTTS and over2.5 require per-game totals (home goals + away goals).
// We compute them by aligning schedule events from both teams.

function extractMatchStats(schedule: ESPNTeamSchedule | null): { btts: boolean[]; over25: boolean[] } {
  const btts: boolean[] = []
  const over25: boolean[] = []
  const events = schedule?.events ?? []

  for (const ev of events) {
    const comp = ev.competitions?.[0]
    if (!comp) continue
    const statusName = comp.status?.type?.name ?? ''
    if (!statusName.includes('FINAL') && !statusName.includes('FULL_TIME')) continue

    const scores = comp.competitors.map(c => resolveScore(c.score)).filter((s): s is number => s != null)
    if (scores.length < 2) continue

    const total = scores[0] + scores[1]
    btts.push(scores[0] > 0 && scores[1] > 0)
    over25.push(total > 2.5)
  }
  return { btts, over25 }
}

function computeCombinedStats(
  homeSchedule: ESPNTeamSchedule | null,
  awaySchedule: ESPNTeamSchedule | null,
): { bttsPct: number | null; over25Pct: number | null } {
  // Merge events from BOTH teams' schedules for a more complete picture
  const home = extractMatchStats(homeSchedule)
  const away = extractMatchStats(awaySchedule)

  const bttsAll   = [...home.btts,   ...away.btts]
  const over25All = [...home.over25, ...away.over25]

  return {
    bttsPct:   pct(bttsAll),
    over25Pct: pct(over25All),
  }
}

// ── Full Game mapper ──────────────────────────────────────────────────────────

export interface ESPNGameInput {
  event:        ESPNEvent
  homeSchedule: ESPNTeamSchedule | null
  awaySchedule: ESPNTeamSchedule | null
  rank:         number
}

export function mapESPNGame(input: ESPNGameInput): Game {
  const { event, homeSchedule, awaySchedule, rank } = input
  const comp = event.competitions[0]

  const homeComp = comp.competitors.find(c => c.homeAway === 'home')
  const awayComp = comp.competitors.find(c => c.homeAway === 'away')

  if (!homeComp || !awayComp) {
    throw new Error(`ESPN event ${event.id}: missing home/away competitor`)
  }

  const homeTeam = mapESPNTeamSummary(homeComp)
  const awayTeam = mapESPNTeamSummary(awayComp)

  const homeTeamStats = mapESPNTeamStats(homeComp, homeSchedule)
  const awayTeamStats = mapESPNTeamStats(awayComp, awaySchedule)

  // Combined BTTS / over2.5 from home team schedule (uses both teams' goals per event)
  const combined = computeCombinedStats(homeSchedule, awaySchedule)
  homeTeamStats.bttsPct  = combined.bttsPct
  awayTeamStats.bttsPct  = combined.bttsPct
  homeTeamStats.over25Pct = combined.over25Pct
  awayTeamStats.over25Pct = combined.over25Pct

  const status    = espnStatusToGame(comp.status.type.name)
  const isPre     = comp.status.type.state === 'pre'
  const isLive    = comp.status.type.state === 'in'
  const homeScore = isPre ? null : (parseInt(homeComp.score) >= 0 ? parseInt(homeComp.score) : null)
  const awayScore = isPre ? null : (parseInt(awayComp.score) >= 0 ? parseInt(awayComp.score) : null)
  // Live clock: ESPN provides displayClock like "45:00" or "67:23"; detail has "68'" etc.
  const liveMinute: string | null = isLive
    ? (comp.status.displayClock && comp.status.displayClock !== '0:00'
        ? comp.status.displayClock
        : comp.status.type.detail ?? null)
    : null

  // GameStats — derived from team stats
  function avgTwo(a: number | null, b: number | null): number | null {
    if (a == null || b == null) return null
    return parseFloat(((a + b) / 2).toFixed(2))
  }

  const stats: GameStats = {
    avgGoals:   avgTwo(homeTeamStats.goalsForAvg, awayTeamStats.goalsForAvg),
    bttsPct:    combined.bttsPct,
    over25Pct:  combined.over25Pct,
    homeWinPct: homeTeamStats.homeWinPct,
  }

  // Round label from season slug
  const roundLabel = event.season?.slug
    ? event.season.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Group Stage'

  const partial: Omit<Game, 'dataQualityScore'> = {
    id:            `espn-${event.id}`,
    fixtureId:     parseInt(event.id) || 0,
    date:          event.date,
    status,
    league:        'FIFA World Cup 2026',
    leagueCountry: 'World',
    leagueLogo:    'https://a.espncdn.com/i/leaguelogos/soccer/500/606.png',
    round:         roundLabel,
    homeTeam,
    awayTeam,
    homeTeamStats,
    awayTeamStats,
    injuries:      [],
    playersInForm: [],
    h2h:           emptyH2H(),
    stats,
    odds:          null,
    featuredRank:  rank,
    homeScore,
    awayScore,
    liveMinute,
  }

  const dqs = calculateDataQualityScore({ ...partial, dataQualityScore: 0 } as Game)
  return { ...partial, dataQualityScore: dqs.total }
}
