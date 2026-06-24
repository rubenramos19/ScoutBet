import { create } from 'zustand'
import { bankrollService } from '@/services/bankrollService'
import type { BankrollConfig, BankrollSnapshot, DailyPlan, PerformanceStats } from '@/types'

interface BankrollState {
  config: BankrollConfig | null
  snapshots: BankrollSnapshot[]
  stats: PerformanceStats | null
  dailyPlan: DailyPlan | null
  isLoading: boolean
  statsPeriod: PerformanceStats['period']

  fetchAll: () => Promise<void>
  fetchStats: (period: PerformanceStats['period']) => Promise<void>
  acceptPlan: () => Promise<void>
  setStatsPeriod: (p: PerformanceStats['period']) => void
}

export const useBankrollStore = create<BankrollState>((set, get) => ({
  config: null,
  snapshots: [],
  stats: null,
  dailyPlan: null,
  isLoading: false,
  statsPeriod: '30d',

  fetchAll: async () => {
    set({ isLoading: true })
    try {
      const [config, snapshots, stats, dailyPlan] = await Promise.all([
        bankrollService.getBankroll(),
        bankrollService.getSnapshots(),
        bankrollService.getPerformanceStats(get().statsPeriod),
        bankrollService.getDailyPlan(),
      ])
      set({ config, snapshots, stats, dailyPlan, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchStats: async (period) => {
    set({ statsPeriod: period })
    const stats = await bankrollService.getPerformanceStats(period)
    set({ stats })
  },

  acceptPlan: async () => {
    const plan = get().dailyPlan
    if (!plan) return
    await bankrollService.acceptDailyPlan(plan.id)
    set(s => ({ dailyPlan: s.dailyPlan ? { ...s.dailyPlan, status: 'ACCEPTED' } : null }))
  },

  setStatsPeriod: (p) => set({ statsPeriod: p }),
}))
