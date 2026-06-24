// ─── useGames ────────────────────────────────────────────────────────────────
// Convenience hook wrapping the game store.
// Components use this instead of importing the store directly,
// which makes it easier to swap the data source in future sprints.

import { useEffect } from 'react'
import { useGameStore } from '@/store/useGameStore'
import type { Game } from '@/types'

interface UseGamesReturn {
  games:     Game[]
  isLoading: boolean
  error:     string | null
  refresh:   () => Promise<void>
  lastFetched: Date | null
}

export function useGames(): UseGamesReturn {
  const {
    games,
    isLoadingGames,
    error,
    lastFetched,
    fetchTodayGames,
  } = useGameStore()

  // Auto-fetch on first mount if cache is cold
  useEffect(() => {
    if (games.length === 0 && !isLoadingGames) {
      fetchTodayGames()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    games,
    isLoading:   isLoadingGames,
    error,
    refresh:     fetchTodayGames,
    lastFetched,
  }
}

interface UseGameDetailReturn {
  game:      Game | null
  isLoading: boolean
  error:     string | null
}

export function useGameDetail(id: string | undefined): UseGameDetailReturn {
  const {
    selectedGame,
    isLoadingGame,
    error,
    selectGame,
  } = useGameStore()

  useEffect(() => {
    if (id) selectGame(id)
  }, [id])  // eslint-disable-line react-hooks/exhaustive-deps

  return {
    game:      selectedGame,
    isLoading: isLoadingGame,
    error,
  }
}
