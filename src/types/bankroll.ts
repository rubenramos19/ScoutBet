// ─── Bankroll & Performance Types ────────────────────────────────────────────
// All monetary values in integer euro-cents to avoid Float precision (audit D-01).
// Kelly Criterion is NOT in Sprint 1 — flat staking only (audit K-01).

export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
export type PlanStatus  = 'PROPOSED' | 'ACCEPTED' | 'SETTLED'
/** PCT = percentage of bankroll per bet; FIXED = fixed daily session budget */
export type StakeMode   = 'PCT' | 'FIXED'

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
  /** Staking mode: percentage-based or fixed daily budget */
  stakeMode: StakeMode
  /** Fixed daily budget in cents (used when stakeMode === 'FIXED') */
  sessionBudgetCents: number | null
  updatedAt: string
}

/** Immutable ledger entry (audit D-05 — never mutate banca, only append) */
export interface LedgerEntry {
  id: string
  type: 'BET_PLACED' | 'BET_WON' | 'BET_LOST' | 'BET_VOID' | 'MANUAL_ADJUSTMENT'
  amountCents: number
  balanceAfterCents: number
  reference: string
  createdAt: string
}

/** Daily snapshot for bankroll evolution chart */
export interface BankrollSnapshot {
  date: string
  amountCents: number
  dailyPLCents: number
}

/** Staking suggestion for a single bet */
export interface StakeSuggestion {
  predictionId: string
  suggestedStakeCents: number
  stakePct: number
  potentialReturnCents: number
  method: 'FLAT'
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
  projectedReturnCents: number
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
  stakeCents: number
  potentialReturnCents: number
}

/** Performance stats for a given period */
export interface PerformanceStats {
  period: '7d' | '30d' | '90d' | 'all'
  totalPredictions: number
  wins: number
  losses: number
  voids: number
  accuracyRate: number
  totalStakedCents: number | null
  totalReturnCents: number | null
  profitLossCents: number | null
  roi: number | null
  yield: number | null
  currentStreak: number
  bestStreak: number
}
