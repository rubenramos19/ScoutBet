// ─── Bet Service ──────────────────────────────────────────────────────────────
// Persists saved predictions and bet history in localStorage.
// "Guardar" = save a pending pick. User manually marks WIN/LOSS after the match.

import { storage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry, MarketPerformance, PlacedBet, BetMarket } from '@/types'

// ── Saved pick (pending or settled) ───────────────────────────────────────────

export interface RaspadinhaLeg {
  gameLabel: string  // "Japan vs Sweden"
  market:    string  // "BTTS"
  pick:      string  // "Ambas Marcam: Sim"
  odd:       number
  kickoff:   string
}

export interface SavedPick {
  id:               string
  savedAt:          string     // ISO UTC
  gameId:           string
  gameLabel:        string     // "Japan vs Sweden"
  league:           string
  matchDate:        string     // ISO UTC — match kick-off
  market:           BetMarket
  pick:             string     // "Japan Vence"
  oddPredicted:     number
  confidence:       number
  reasoning:        string
  status:           'PENDING' | 'WIN' | 'LOSS' | 'VOID'
  stakeEuroCents:   number | null
  profitLossEuroCents: number | null
  /** Only for MULTIPLE market — full leg breakdown */
  legs?:            RaspadinhaLeg[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadPicks(): SavedPick[] {
  return storage.get<SavedPick[]>(STORAGE_KEYS.SAVED_BETS) ?? []
}

function savePicks(picks: SavedPick[]): void {
  storage.set(STORAGE_KEYS.SAVED_BETS, picks)
}

function periodCutoff(period: '7d' | '30d' | '90d' | 'all'): string | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ── Public API ─────────────────────────────────────────────────────────────────

export const betService = {
  // ── Save a new pick ──────────────────────────────────────────────────────────
  async savePick(pick: Omit<SavedPick, 'id' | 'savedAt' | 'status' | 'profitLossEuroCents'>): Promise<SavedPick> {
    const picks = loadPicks()
    const today = new Date().toISOString().slice(0, 10)
    // Guard: never duplicate the same game+market on the same day
    const alreadyToday = picks.some(p =>
      p.gameId === pick.gameId &&
      p.market === pick.market &&
      p.savedAt.startsWith(today),
    )
    if (alreadyToday) {
      return picks.find(p =>
        p.gameId === pick.gameId &&
        p.market === pick.market &&
        p.savedAt.startsWith(today),
      )!
    }
    const newPick: SavedPick = {
      ...pick,
      id:                  `pick-${Date.now()}`,
      savedAt:             new Date().toISOString(),
      status:              'PENDING',
      profitLossEuroCents: null,
    }
    picks.unshift(newPick) // newest first
    savePicks(picks)
    return newPick
  },

  // ── Check if pick already saved for this game+market today ──────────────────
  isPickSaved(gameId: string, market: string): boolean {
    const picks = loadPicks()
    const today = new Date().toISOString().slice(0, 10)
    return picks.some(p =>
      p.gameId === gameId &&
      p.market === market &&
      p.savedAt.startsWith(today),
    )
  },

  // ── Mark result (WIN/LOSS/VOID) ──────────────────────────────────────────────
  async settlePick(
    id: string,
    outcome: 'WIN' | 'LOSS' | 'VOID',
    profitLossCents: number | null,
  ): Promise<void> {
    const picks = loadPicks()
    const idx = picks.findIndex(p => p.id === id)
    if (idx < 0) return
    picks[idx] = { ...picks[idx], status: outcome, profitLossEuroCents: profitLossCents }
    savePicks(picks)

    // Update bankroll if stake was recorded
    if (profitLossCents !== null && outcome !== 'VOID') {
      const { bankrollService } = await import('./bankrollService')
      await bankrollService.recordBetResult(profitLossCents)
    }
  },

  // ── Delete a saved pick ──────────────────────────────────────────────────────
  async deletePick(id: string): Promise<void> {
    const picks = loadPicks()
    savePicks(picks.filter(p => p.id !== id))
  },

  // ── Get all pending picks ─────────────────────────────────────────────────────
  async getPendingPicks(): Promise<SavedPick[]> {
    return loadPicks().filter(p => p.status === 'PENDING')
  },

  // ── History (settled + pending) ───────────────────────────────────────────────
  async getHistory(period: '7d' | '30d' | '90d' | 'all' = '30d'): Promise<HistoryEntry[]> {
    const picks  = loadPicks()
    const cutoff = periodCutoff(period)

    return picks
      .filter(p => !cutoff || p.savedAt >= cutoff)
      .map((p): HistoryEntry => ({
        id:                  p.id,
        date:                p.savedAt,
        gameLabel:           p.gameLabel,
        league:              p.league,
        market:              p.market,
        pick:                p.pick,
        oddPredicted:        p.oddPredicted,
        oddPlaced:           null,
        stakeEuroCents:      p.stakeEuroCents,
        outcome:             p.status === 'PENDING' ? 'VOID' : p.status,
        profitLossEuroCents: p.profitLossEuroCents,
        confidence:          p.confidence,
      }))
  },

  // ── Market performance ────────────────────────────────────────────────────────
  async getMarketPerformance(): Promise<MarketPerformance[]> {
    const picks = loadPicks().filter(p => p.status !== 'PENDING')
    if (picks.length === 0) return []

    const markets = [...new Set(picks.map(p => p.market))]
    return markets.map((market): MarketPerformance => {
      const mp    = picks.filter(p => p.market === market)
      const wins  = mp.filter(p => p.status === 'WIN').length
      const losses = mp.filter(p => p.status === 'LOSS').length
      const voids = mp.filter(p => p.status === 'VOID').length
      const settled = wins + losses
      const staked  = mp.reduce((s, p) => s + (p.stakeEuroCents ?? 0), 0)
      const pl      = mp.reduce((s, p) => s + (p.profitLossEuroCents ?? 0), 0)
      return {
        market,
        total:               mp.length,
        wins,
        losses,
        voids,
        accuracyRate:        settled > 0 ? wins / settled : 0,
        roi:                 staked > 0 ? (pl / staked) * 100 : 0,
        profitLossEuroCents: pl,
      }
    })
  },

  // ── PlacedBet (compat with old interface) ─────────────────────────────────────
  async savePlacedBet(_bet: Omit<PlacedBet, 'id' | 'placedAt'>): Promise<PlacedBet> {
    const bet: PlacedBet = {
      id:       `bet-${Date.now()}`,
      placedAt: new Date().toISOString(),
      ..._bet,
    }
    return bet
  },

  async updateBetResult(_id: string, _outcome: 'WON' | 'LOST' | 'VOID'): Promise<void> {},

  // ── Load all saved picks (for UI) ─────────────────────────────────────────────
  loadAll(): SavedPick[] {
    return loadPicks()
  },
}
