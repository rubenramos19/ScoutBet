import { MOCK_HISTORY, MOCK_MARKET_PERFORMANCE } from '@/mock/history'
import type { HistoryEntry, MarketPerformance, PlacedBet } from '@/types'

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms))

export const betService = {
  async getHistory(period?: '7d' | '30d' | '90d' | 'all'): Promise<HistoryEntry[]> {
    await delay()
    if (!period || period === 'all') return MOCK_HISTORY
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return MOCK_HISTORY.filter(h => new Date(h.date) >= cutoff)
  },

  async getMarketPerformance(): Promise<MarketPerformance[]> {
    await delay()
    return MOCK_MARKET_PERFORMANCE
  },

  async savePlacedBet(_bet: Omit<PlacedBet, 'id' | 'placedAt'>): Promise<PlacedBet> {
    // Sprint 2: POST /api/bets
    await delay(200)
    const bet: PlacedBet = {
      id: `bet-${Date.now()}`,
      placedAt: new Date().toISOString(),
      ..._bet,
    }
    return bet
  },

  async updateBetResult(_id: string, _outcome: 'WON' | 'LOST' | 'VOID'): Promise<void> {
    // Sprint 5: PATCH /api/bets/:id/result
    await delay(200)
  },
}
