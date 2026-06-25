import { create } from 'zustand'
import { gameService } from '@/services/gameService'
import type { Game, MultipleSuggestion } from '@/types'

interface GameState {
  games:            Game[]
  selectedGame:     Game | null
  multiples:        MultipleSuggestion[]
  isLoadingGames:   boolean
  isLoadingGame:    boolean
  lastFetched:      Date | null
  error:            string | null

  // Discovery metadata — populated after every getTodayGames() call
  noGamesReason:    string | null   // human-readable reason when games === []
  autoDiscovery:    boolean         // true if games came from auto-discovery
  analyzedLeagues:  string[]        // labels of every competition checked
  gamesDate:        string | null   // ISO date of games shown (may differ from today)

  fetchTodayGames: () => Promise<void>
  selectGame:      (id: string) => Promise<void>
  clearSelection:  () => void
  fetchMultiples:  () => Promise<void>
}

export const useGameStore = create<GameState>((set, get) => ({
  games:           [],
  selectedGame:    null,
  multiples:       [],
  isLoadingGames:  false,
  isLoadingGame:   false,
  lastFetched:     null,
  error:           null,
  noGamesReason:   null,
  autoDiscovery:   false,
  analyzedLeagues: [],
  gamesDate:       null,

  fetchTodayGames: async () => {
    if (get().isLoadingGames) return
    set({ isLoadingGames: true, error: null })
    try {
      const games = await gameService.getTodayGames()
      const meta  = gameService.getLastFetchMeta()
      set({
        games,
        lastFetched:     new Date(),
        isLoadingGames:  false,
        noGamesReason:   meta.noGamesReason,
        autoDiscovery:   meta.autoDiscovery,
        analyzedLeagues: meta.analyzedLeagues,
        gamesDate:       meta.gamesDate,
      })
      // Build combinadas from real games (non-blocking)
      gameService.getMultipleSuggestions().then(multiples => set({ multiples })).catch(() => {})
    } catch (e) {
      set({ error: 'Erro ao carregar jogos do dia.', isLoadingGames: false })
    }
  },

  selectGame: async (id: string) => {
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
