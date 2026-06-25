// ─── Game & Team Types ────────────────────────────────────────────────────────
// Sprint 3: All numeric stats are now number | null.
// null = "dado não disponível" — never show invented defaults.
// Components must handle null by rendering "Dados indisponíveis" or "—".

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
  /** Emoji fallback (flag or club) */
  logoEmoji?: string
}

export interface TeamStats {
  teamId: string
  /** null when match history unavailable */
  goalsForAvg:     number | null
  goalsAgainstAvg: number | null
  homeWinPct:      number | null
  awayWinPct:      number | null
  /** Empty array = no data; non-empty = real results */
  formLast5:       FormResult[]
  formLast10:      FormResult[]
  /** % of games with 0 goals conceded; null if no data */
  cleanSheets:     number | null
  bttsPct:         number | null
  over25Pct:       number | null
  /** Optional extended stats (SofaScore only) */
  over15Pct?:      number | null
  under25Pct?:     number | null
  avgRating?:      number | null
  gamesAnalyzed?:  number
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
  player:        string
  team:          string
  /** null = not available from this source */
  goalsLast5:    number | null
  assistsLast5:  number | null
  goalsSeason:   number | null
  assistsSeason: number | null
  ratingAvg:     number | null
  /** Optional: populated by SofaScore lineups */
  position?:     string | null
  jerseyNumber?: string | null
}

export interface H2HRecord {
  homeWins:     number
  draws:        number
  awayWins:     number
  /** null = individual match list not available from this source */
  last5:        H2HResult[]
  /** null = not available from this source */
  avgTotalGoals: number | null
  /** homeWins + draws + awayWins */
  totalGames?:  number
}

export interface GameStats {
  /** null when team stats unavailable */
  avgGoals:   number | null
  bttsPct:    number | null
  over25Pct:  number | null
  homeWinPct: number | null
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
  /** 0–100 data completeness score (NOT a probability) */
  dataQualityScore: number
  featuredRank: number | null
  homeScore: number | null
  awayScore: number | null
  /** Live match minute — only set when status === LIVE */
  liveMinute: string | null
}
