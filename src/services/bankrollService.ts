import { MOCK_BANKROLL, MOCK_BANKROLL_SNAPSHOTS, MOCK_PERFORMANCE_STATS, MOCK_DAILY_PLAN } from '@/mock/bankroll'
import type { BankrollConfig, BankrollSnapshot, DailyPlan, PerformanceStats, RiskProfile } from '@/types'

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms))

export const bankrollService = {
  async getBankroll(): Promise<BankrollConfig> {
    await delay()
    return MOCK_BANKROLL
  },

  async updateBankroll(_config: Partial<BankrollConfig>): Promise<BankrollConfig> {
    // Sprint 5: PUT /api/bankroll
    await delay(200)
    return { ...MOCK_BANKROLL, ..._config, updatedAt: new Date().toISOString() }
  },

  async getSnapshots(_days = 30): Promise<BankrollSnapshot[]> {
    await delay()
    return MOCK_BANKROLL_SNAPSHOTS
  },

  async getPerformanceStats(period: PerformanceStats['period'] = '30d'): Promise<PerformanceStats> {
    await delay()
    return { ...MOCK_PERFORMANCE_STATS, period }
  },

  async getDailyPlan(): Promise<DailyPlan | null> {
    await delay(400)
    return MOCK_DAILY_PLAN
  },

  async acceptDailyPlan(_planId: string): Promise<void> {
    // Sprint 5: POST /api/plan/accept
    await delay(300)
  },

  /** Calculate flat stake suggestion (Kelly deferred to Sprint 7 — audit K-01) */
  calculateFlatStake(
    bankrollCents: number,
    profile: RiskProfile,
    confidence: number,
  ): { stakeCents: number; pct: number } {
    const basePct = profile === 'CONSERVATIVE' ? 0.015
                  : profile === 'BALANCED'     ? 0.025
                  : 0.035
    // Scale slightly by confidence but keep it flat-ish
    const adjustedPct = basePct * (0.8 + (confidence / 100) * 0.4)
    const capped = Math.min(adjustedPct, 0.05)
    const stakeCents = Math.round(bankrollCents * capped / 100) * 100 // round to €1
    return { stakeCents, pct: capped }
  },
}
