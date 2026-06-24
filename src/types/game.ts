// ─── Game & Team Types ────────────────────────────────────────────────────────
// These mirror the DB schema (spec section 4). Sprint 2 will map API responses
// to these types in the service layer — the rest of the app never changes.

export type FormResult = 'W' | 'D' | 'L'
export type H2HResult  = 'H' | 'A' | 'D'
export type InjurySeverity = 'high' | 'medium' | 'low' | 'unknown'

export type GameStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'

export interface TeamSummary {
  id: string
  name: string
  shortName: string
  logoUrl: string | null
  /** Emoji fallback until real logos are fetched (Sprint 2) */
  logoEmoji?: string
}

export interface TeamStats {
  teamId: string
  goalsForAvg: number
  goalsAgainstAvg: number
  homeWinPct: number
  awayWinPct: number
  formLast5: FormResult[]
  formLast10: FormResult[]
  cleanSheets: number
  bttsPct: number
  over25Pct: number
}

export interface Injury {
  player: string
  team: string
  type: string
  severity: InjurySeverity
  status: string
  isKeyPlayer: boolean
  /** 0–10 estimated impact on team */
  impactScore: number
}

export interface PlayerInForm {
  player: string
  team: string
  goalsLast5: number
  assistsLast5: number
  goalsSeason: number
  assistsSeason: number
  ratingAvg: number | null
}

export interface H2HRecord {
  homeWins: number
  draws: number
  awayWins: number
  last5: H2HResult[]
  avgTotalGoals: number
}

export interface GameStats {
  avgGoals: number
  bttsPct: number
  over25Pct: number
  homeWinPct: number
}

export interface ScoreBreakdown {
  form: number
  goals: number
  defense: number
  venue: number
  h2h: number
  injuries: number
  motivation: number
  total: number
}

export interface GameOdds {
  homeWin: number
  draw: number
  awayWin: number
  bttsYes: number
  bttsNo: number
  over25: number
  under25: number
  bookmaker: string
  fetchedAt: string // ISO UTC
}

export interface Game {
  id: string
  fixtureId: number
  date: string     // ISO UTC — convert to local in UI
  status: GameStatus
  league: string
  leagueCountry: string
  leagueLogo?: string
  round: string
  homeTeam: TeamSummary
  awayTeam: TeamSummary
  homeTeamStats: TeamStats
  awayTeamStats: TeamStats
  injuries: Injury[]
  playersInForm: PlayerInForm[]
  h2h: H2HRecord
  stats: GameStats
  odds: GameOdds | null
  dataQualityScore: number   // 0–100 data completeness (spec: separate from probability)
  featuredRank: number | null // 1–5 if in today's top 5, null otherwise
  homeScore: number | null
  awayScore: number | null
}
