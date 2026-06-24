// ─── Bet & Prediction Types ───────────────────────────────────────────────────
// Audit finding H-01: we explicitly distinguish Prediction (system model output)
// from PlacedBet (what the user actually bet with real money).
// These are NEVER conflated — see spec audit section 4.

export type BetMarket =
  | '1X2'
  | 'BTTS'
  | 'OVER_25'
  | 'UNDER_25'
  | 'OVER_35'
  | 'DOUBLE_CHANCE'
  | 'DRAW_NO_BET'
  | 'ASIAN_HANDICAP'
  | 'HALF_TIME'
  | 'MULTIPLE'

export type BetOutcome = 'WIN' | 'LOSS' | 'VOID' | 'PUSH'
export type PredictionStatus = 'PENDING' | 'SETTLED'
export type PlacedBetStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID'

/** System-generated prediction — measures model accuracy */
export interface Prediction {
  id: string
  gameId: string
  market: BetMarket
  pick: string           // human-readable: "Real Madrid Vence"
  oddAtTime: number      // odd when prediction was generated
  confidence: number     // 0–100 DATA quality signal — NOT a probability (audit K-01)
  reasoning: string      // text explanation
  status: PredictionStatus
  createdAt: string      // ISO UTC
  // Set after settlement:
  outcome?: BetOutcome
  actualResult?: string  // "2-1", "BTTS: Yes"
  settledAt?: string
}

/** A bet the user ACTUALLY placed with real money (audit H-01) */
export interface PlacedBet {
  id: string
  predictionId: string | null  // linked to system prediction if from our recommendation
  gameId: string
  gameLabel: string             // "Real Madrid vs Bayern"
  market: BetMarket
  pick: string
  oddPlaced: number            // actual odd the user got (may differ from prediction odd)
  /** Stored as integer cents to avoid Float precision issues (audit D-01) */
  stakeEuroCents: number
  potentialWinEuroCents: number
  status: PlacedBetStatus
  isRaspadinha: boolean
  placedAt: string
  settledAt?: string
  profitLossEuroCents?: number // positive = profit, negative = loss
  notes?: string
}

/** A line in a multiple */
export interface MultipleSelection {
  gameId: string
  gameLabel: string
  market: BetMarket
  pick: string
  odd: number
  confidence: number
  reasoning: string
}

/** AI-generated multiple suggestion */
export interface MultipleSuggestion {
  id: string
  label: string
  strategy: 'CONSERVATIVE' | 'VALUE' | 'AGGRESSIVE' | 'RASPADINHA'
  selections: MultipleSelection[]
  totalOdd: number
  confidence: number
  reasoning: string
}

/** Daily performance aggregated by market (from MarketStat table in Sprint 5) */
export interface MarketPerformance {
  market: BetMarket
  total: number
  wins: number
  losses: number
  voids: number
  accuracyRate: number
  roi: number
  profitLossEuroCents: number
}

/** Single entry in the history list */
export interface HistoryEntry {
  id: string
  date: string
  gameLabel: string
  league: string
  market: BetMarket
  pick: string
  oddPredicted: number
  oddPlaced: number | null   // null = paper bet only
  stakeEuroCents: number | null
  outcome: BetOutcome
  profitLossEuroCents: number | null
  confidence: number
}
