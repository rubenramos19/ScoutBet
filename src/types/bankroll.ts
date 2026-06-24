// ─── Bankroll & Performance Types ────────────────────────────────────────────
// All monetary values in integer euro-cents to avoid Float precision (audit D-01).
// Kelly Criterion is NOT in Sprint 1 — flat staking only (audit K-01).

export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
export type PlanStatus = 'PROPOSED' | 'ACCEPTED' | 'SETTLED'

export interface BankrollConfig {
  id: string
  /** Integer euro-cents (audit D-01) */
  currentAmountCents: number
  initialAmountCents: number
  riskProfile: RiskProfile
  /** Flat stake percentage — Kelly deferred to Sprint 7 (audit K-01) */
  flatStakePct: number
  maxStakePct: number
  maxDailyExposurePct: number
  stopLossEnabled: boolean
  stopLossPct: number
  raspadinhaEnabled: boolean
  updatedAt: string
}

/** Immutable ledger entry (audit D-05 — never mutate banca, only append) */
export interface LedgerEntry {
  id: string
  type: 'BET_PLACED' | 'BET_WON' | 'BET_LOST' | 'BET_VOID' | 'MANUAL_ADJUSTMENT'
  amountCents: number   // positive = credit, negative = debit
  balanceAfterCents: number
  reference: string     // bet ID or description
  createdAt: string
}

/** Daily snapshot for bankroll evolution chart */
export interface BankrollSnapshot {
  date: string       // YYYY-MM-DD in user local time
  amountCents: number
  dailyPLCents: number
}

/** Staking suggestion for a single bet */
export interface StakeSuggestion {
  predictionId: string
  suggestedStakeCents: number
  stakePct: number
  potentialReturnCents: number
  method: 'FLAT'  // 'KELLY' added in Sprint 7 after calibration
  reasoning: string
}

/** A proposed daily betting plan */
export interface DailyPlan {
  id: string
  date: string
  totalAllocatedCents: number
  dailyBudgetCents: number
  status: PlanStatus
  bets: DailyPlanBet[]
  raspadinha: RaspadinhaSuggestion | null
  projectedReturnCents: number  // if ALL bets win
}

export interface DailyPlanBet {
  predictionId: string
  gameLabel: string
  pick: string
  market: string
  odd: number
  confidence: number
  suggestedStakeCents: number
  potentialReturnCents: number
}

export interface RaspadinhaSuggestion {
  selections: Array<{ gameLabel: string; pick: string; odd: number }>
  totalOdd: number
  stakeCents: number  // always capped at 1% bankroll / month budget
  potentialReturnCents: number
}

/** Performance stats for a given period */
export interface PerformanceStats {
  period: '7d' | '30d' | '90d' | 'all'
  totalPredictions: number
  wins: number
  losses: number
  voids: number
  accuracyRate: number        // wins / (wins + losses)
  totalStakedCents: number | null   // null if no placed bets
  totalReturnCents: number | null
  profitLossCents: number | null
  roi: number | null          // null without stakes (audit R-01)
  yield: number | null
  currentStreak: number       // positive = win streak, negative = loss streak
  bestStreak: number
}
