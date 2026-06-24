import { create } from 'zustand'
import { gameService } from '@/services/gameService'
import type { Game, MultipleSuggestion } from '@/types'

interface GameState {
  games: Game[]
  selectedGame: Game | null
  multiples: MultipleSuggestion[]
  isLoadingGames: boolean
  isLoadingGame: boolean
  lastFetched: Date | null
  error: string | null

  fetchTodayGames: () => Promise<void>
  selectGame: (id: string) => Promise<void>
  clearSelection: () => void
  fetchMultiples: () => Promise<void>
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  selectedGame: null,
  multiples: [],
  isLoadingGames: false,
  isLoadingGame: false,
  lastFetched: null,
  error: null,

  fetchTodayGames: async () => {
    if (get().isLoadingGames) return
    set({ isLoadingGames: true, error: null })
    try {
      const games = await gameService.getTodayGames()
      set({ games, lastFetched: new Date(), isLoadingGames: false })
    } catch (e) {
      set({ error: 'Erro ao carregar jogos do dia.', isLoadingGames: false })
    }
  },

  selectGame: async (id: string) => {
    // Check cache first
    const cached = get().games.find(g => g.id === id)
    if (cached) { set({ selectedGame: cached }); return }
    set({ isLoadingGame: true, error: null })
    try {
      const game = await gameService.getGameById(id)
      set({ selectedGame: game, isLoadingGame: false })
    } catch {
      set({ error: 'Erro ao carregar jogo.', isLoadingGame: false })
    }
  },

  clearSelection: () => set({ selectedGame: null }),

  fetchMultiples: async () => {
    try {
      const multiples = await gameService.getMultipleSuggestions()
      set({ multiples })
    } catch {
      // non-critical
    }
  },
}))
