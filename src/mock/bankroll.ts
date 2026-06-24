import type { BankrollConfig, BankrollSnapshot, DailyPlan, PerformanceStats } from '@/types'

export const MOCK_BANKROLL: BankrollConfig = {
  id: 'bankroll-1',
  currentAmountCents: 57840,   // €578.40
  initialAmountCents: 50000,   // €500.00
  riskProfile: 'BALANCED',
  flatStakePct: 0.03,          // 3% flat stake (Sprint 1 — Kelly deferred)
  maxStakePct: 0.05,
  maxDailyExposurePct: 0.12,
  stopLossEnabled: false,
  stopLossPct: 0.10,
  raspadinhaEnabled: true,
  updatedAt: new Date().toISOString(),
}

// Last 30 days of snapshots for chart
const genSnapshots = (): BankrollSnapshot[] => {
  const snaps: BankrollSnapshot[] = []
  let balance = 50000
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dailyPL = Math.floor((Math.random() - 0.35) * 2000)
    balance = Math.max(40000, balance + dailyPL)
    snaps.push({ date: dateStr, amountCents: balance, dailyPLCents: dailyPL })
  }
  snaps[snaps.length - 1] = {
    date: today.toISOString().split('T')[0],
    amountCents: 57840,
    dailyPLCents: 1840,
  }
  return snaps
}

export const MOCK_BANKROLL_SNAPSHOTS: BankrollSnapshot[] = genSnapshots()

export const MOCK_PERFORMANCE_STATS: PerformanceStats = {
  period: '30d',
  totalPredictions: 105,
  wins: 63,
  losses: 38,
  voids: 4,
  accuracyRate: 0.624,
  totalStakedCents: 195000,
  totalReturnCents: 222840,
  profitLossCents: 27840,
  roi: 14.3,
  yield: 265.1,
  currentStreak: 4,
  bestStreak: 8,
}

export const MOCK_DAILY_PLAN: DailyPlan = {
  id: 'plan-today',
  date: new Date().toISOString().split('T')[0],
  totalAllocatedCents: 6200,
  dailyBudgetCents: 6940,   // 12% of bankroll
  status: 'PROPOSED',
  bets: [
    {
      predictionId: 'pred-1',
      gameLabel: 'Inter vs Juventus',
      pick: 'Inter Vence',
      market: '1X2',
      odd: 1.75,
      confidence: 84,
      suggestedStakeCents: 2400,   // ~3% of banca
      potentialReturnCents: 4200,
    },
    {
      predictionId: 'pred-2',
      gameLabel: 'Real Madrid vs Bayern',
      pick: 'Ambas Marcam: Sim',
      market: 'BTTS',
      odd: 1.75,
      confidence: 81,
      suggestedStakeCents: 2200,
      potentialReturnCents: 3850,
    },
    {
      predictionId: 'pred-3',
      gameLabel: 'Barcelona vs Atlético',
      pick: 'Barcelona Vence',
      market: '1X2',
      odd: 1.85,
      confidence: 76,
      suggestedStakeCents: 1600,
      potentialReturnCents: 2960,
    },
  ],
  raspadinha: {
    selections: [
      { gameLabel: 'Dortmund vs Leipzig', pick: 'Dortmund Vence', odd: 2.50 },
      { gameLabel: 'Arsenal vs Liverpool', pick: 'Liverpool Vence', odd: 2.90 },
      { gameLabel: 'Inter vs Juventus',    pick: 'Juventus Vence', odd: 4.20 },
    ],
    totalOdd: 30.45,
    stakeCents: 500,
    potentialReturnCents: 15225,
  },
  projectedReturnCents: 11010,
}
