// ─── Bankroll Service ─────────────────────────────────────────────────────────
// Persists BankrollConfig + snapshots in localStorage.
// No backend required — single-user SPA.

import { storage, STORAGE_KEYS } from '@/lib/storage'
import type {
  BankrollConfig, BankrollSnapshot, DailyPlan, PerformanceStats,
  RiskProfile, StakeMode,
} from '@/types'

const STAKE_MAP: Record<RiskProfile, number> = {
  CONSERVATIVE: 0.015,
  BALANCED:     0.025,
  AGGRESSIVE:   0.035,
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function appendSnapshot(config: BankrollConfig): void {
  const snaps = storage.get<BankrollSnapshot[]>(STORAGE_KEYS.SNAPSHOTS) ?? []
  const today = todayStr()
  const existing = snaps.findIndex(s => s.date === today)
  const snap: BankrollSnapshot = {
    date: today,
    amountCents: config.currentAmountCents,
    dailyPLCents: config.currentAmountCents - config.initialAmountCents,
  }
  if (existing >= 0) snaps[existing] = snap
  else snaps.push(snap)
  const sorted = snaps.sort((a, b) => a.date.localeCompare(b.date)).slice(-90)
  storage.set(STORAGE_KEYS.SNAPSHOTS, sorted)
}

export const bankrollService = {
  async getBankroll(): Promise<BankrollConfig | null> {
    return storage.get<BankrollConfig>(STORAGE_KEYS.BANKROLL)
  },

  async setupBankroll(
    initialCents: number,
    profile: RiskProfile = 'BALANCED',
    stakeMode: StakeMode = 'PCT',
    sessionBudgetCents: number | null = null,
  ): Promise<BankrollConfig> {
    const config: BankrollConfig = {
      id: 'bankroll-1',
      currentAmountCents: initialCents,
      initialAmountCents: initialCents,
      riskProfile: profile,
      flatStakePct: STAKE_MAP[profile],
      maxStakePct: 0.05,
      maxDailyExposurePct: 0.12,
      stopLossEnabled: false,
      stopLossPct: 0.10,
      raspadinhaEnabled: false,
      stakeMode,
      sessionBudgetCents,
      updatedAt: new Date().toISOString(),
    }
    storage.set(STORAGE_KEYS.BANKROLL, config)
    appendSnapshot(config)
    return config
  },

  async updateBankroll(patch: Partial<BankrollConfig>): Promise<BankrollConfig | null> {
    const current = storage.get<BankrollConfig>(STORAGE_KEYS.BANKROLL)
    if (!current) return null
    const updated: BankrollConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    if (patch.riskProfile) {
      updated.flatStakePct = STAKE_MAP[patch.riskProfile]
    }
    storage.set(STORAGE_KEYS.BANKROLL, updated)
    appendSnapshot(updated)
    return updated
  },

  async recordBetResult(profitLossCents: number): Promise<void> {
    const config = storage.get<BankrollConfig>(STORAGE_KEYS.BANKROLL)
    if (!config) return
    const updated: BankrollConfig = {
      ...config,
      currentAmountCents: config.currentAmountCents + profitLossCents,
      updatedAt: new Date().toISOString(),
    }
    storage.set(STORAGE_KEYS.BANKROLL, updated)
    appendSnapshot(updated)
  },

  async getSnapshots(days = 30): Promise<BankrollSnapshot[]> {
    const all = storage.get<BankrollSnapshot[]>(STORAGE_KEYS.SNAPSHOTS) ?? []
    if (days === 0) return all
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return all.filter(s => s.date >= cutoffStr)
  },

  async getPerformanceStats(period: PerformanceStats['period'] = '30d'): Promise<PerformanceStats | null> {
    const { betService } = await import('./betService')
    const history = await betService.getHistory(period)
    if (history.length === 0) return null

    const settled  = history.filter(h => h.outcome !== 'VOID')
    const wins     = history.filter(h => h.outcome === 'WIN').length
    const losses   = history.filter(h => h.outcome === 'LOSS').length
    const voids    = history.filter(h => h.outcome === 'VOID').length
    const withStake = history.filter(h => h.stakeEuroCents != null)
    const totalStaked  = withStake.reduce((s, h) => s + (h.stakeEuroCents ?? 0), 0)
    const totalReturn  = withStake.filter(h => h.outcome === 'WIN')
                                  .reduce((s, h) => s + (h.profitLossEuroCents ?? 0) + (h.stakeEuroCents ?? 0), 0)
    const profitLoss   = withStake.reduce((s, h) => s + (h.profitLossEuroCents ?? 0), 0)

    let streak = 0
    for (let i = history.length - 1; i >= 0; i--) {
      const o = history[i].outcome
      if (o === 'VOID') continue
      if (streak === 0) streak = o === 'WIN' ? 1 : -1
      else if (streak > 0 && o === 'WIN') streak++
      else if (streak < 0 && o === 'LOSS') streak--
      else break
    }

    return {
      period,
      totalPredictions: history.length,
      wins,
      losses,
      voids,
      accuracyRate: settled.length > 0 ? wins / settled.length : 0,
      totalStakedCents:  totalStaked > 0 ? totalStaked : null,
      totalReturnCents:  totalStaked > 0 ? totalReturn : null,
      profitLossCents:   totalStaked > 0 ? profitLoss : null,
      roi:               totalStaked > 0 ? (profitLoss / totalStaked) * 100 : null,
      yield:             totalStaked > 0 ? (totalReturn / totalStaked - 1) * 100 : null,
      currentStreak:     streak,
      bestStreak:        wins,
    }
  },

  async getDailyPlan(): Promise<DailyPlan | null> {
    return null
  },

  async acceptDailyPlan(_planId: string): Promise<void> {},

  /**
   * PCT mode: confidence-scaled flat stake.
   * FIXED mode: stakes are computed by allocateFixedBudget() in DailyPlan — this is a fallback.
   */
  calculateFlatStake(
    bankrollCents: number,
    profile: RiskProfile,
    confidence: number,
  ): { stakeCents: number; pct: number } {
    const basePct = STAKE_MAP[profile]
    const scale   = 0.8 + (Math.min(confidence, 100) / 100) * 0.4
    const adjPct  = Math.min(basePct * scale, 0.05)
    const raw     = bankrollCents * adjPct
    const cents   = Math.round(raw / 50) * 50
    return { stakeCents: Math.max(cents, 50), pct: adjPct }
  },

  /**
   * FIXED mode: split a session budget across N bets by confidence weight.
   * Raspadinha gets 10% of budget; remaining 90% split proportionally.
   * Returns stakes rounded to nearest €0.50.
   */
  allocateFixedBudget(
    sessionBudgetCents: number,
    bets: Array<{ confidence: number; isRaspadinha?: boolean }>,
  ): number[] {
    if (bets.length === 0) return []

    const raspadinhaBudget = Math.round(sessionBudgetCents * 0.10) // 10% for raspadinha
    const mainBudget       = sessionBudgetCents - raspadinhaBudget

    const mainBets = bets.filter(b => !b.isRaspadinha)
    const confSum  = mainBets.reduce((s, b) => s + b.confidence, 0)

    return bets.map(b => {
      if (b.isRaspadinha) {
        // round to €0.50
        return Math.max(Math.round(raspadinhaBudget / 50) * 50, 50)
      }
      if (confSum === 0) {
        const even = Math.round(mainBudget / mainBets.length / 50) * 50
        return Math.max(even, 50)
      }
      const raw = mainBudget * (b.confidence / confSum)
      return Math.max(Math.round(raw / 50) * 50, 50)
    })
  },
}
