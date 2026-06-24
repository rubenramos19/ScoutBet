// ─── Game Service — Sprint 2 ──────────────────────────────────────────────────
// Replaces mock data with real API-Football calls.
//
// Automatic fallback to mock data when:
//   • VITE_USE_MOCK=true  OR  VITE_API_FOOTBALL_KEY is empty
//   • Daily API limit reached (100 calls on free tier)
//   • Network error after all retries exhausted  (audit A-04)
//
// Budget per full refresh (5 games):
//   8 leagues × 1 fixture call  =  8 calls
//   5 games   × 2 team stats    = 10 calls
//   5 games   × 1 H2H           =  5 calls
//   5 games   × 1 injuries      =  5 calls
//   ────────────────────────────────────────
//   Total:                        28 calls  (of 100/day)
//
// Cache keeps this to 28 calls per session — subsequent loads are free.

import {
  apiFetch,
  API_CONFIG,
  todayUTC,
  type ApiFixture,
  type ApiTeamStats,
  type ApiInjury,
} from '@/lib/apiFootball'
import { apiCache, TTL } from '@/lib/cache'
import {
  mapGame,
  mapStatus,
  isActiveGame,
  fixturePrestigeScore,
  type GameMapperInput,
} from '@/lib/mappers'
import { MOCK_GAMES, MOCK_MULTIPLES } from '@/mock/games'
import type { Game, MultipleSuggestion } from '@/types'

// ── Mock-mode detection ───────────────────────────────────────────────────────

function shouldUseMock(): boolean {
  const forceMock  = import.meta.env.VITE_USE_MOCK === 'true'
  const hasKey     = Boolean(import.meta.env.VITE_API_FOOTBALL_KEY?.trim())
  return forceMock || !hasKey
}

// ── Individual API fetchers (each independently cached) ───────────────────────

async function fetchTodayFixtures(): Promise<ApiFixture[]> {
  const today    = todayUTC()
  const cacheKey = `fixtures:${today}`
  const cached   = apiCache.get<ApiFixture[]>(cacheKey)
  if (cached) return cached

  const season    = API_CONFIG.season
  const leagueIds = API_CONFIG.watchedLeagues

  const settled = await Promise.allSettled(
    leagueIds.map(leagueId =>
      apiFetch<ApiFixture[]>('/fixtures', {
        date:     today,
        league:   leagueId,
        season,
        timezone: 'Europe/Lisbon',
      })
    )
  )

  const fixtures: ApiFixture[] = []
  settled.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      fixtures.push(...res.value)
    } else {
      console.warn(
        `[ScoutBet] Fixtures failed for league ${leagueIds[idx]}:`,
        res.reason
      )
    }
  })

  // Only keep games that are upcoming or live (not finished/postponed)
  const active = fixtures.filter(f => isActiveGame(mapStatus(f.fixture.status.short)))

  apiCache.set(cacheKey, active, TTL.FIXTURES_TODAY)
  return active
}

async function fetchTeamStats(
  teamId:   number,
  leagueId: number,
): Promise<ApiTeamStats | null> {
  const season   = API_CONFIG.season
  const cacheKey = `stats:${teamId}:${leagueId}:${season}`
  const cached   = apiCache.get<ApiTeamStats>(cacheKey)
  if (cached) return cached

  try {
    const data = await apiFetch<ApiTeamStats>('/teams/statistics', {
      team:   teamId,
      league: leagueId,
      season,
    })
    // API returns an object, not an array, for this endpoint
    const stats = Array.isArray(data) ? data[0] : data
    if (!stats) return null
    apiCache.set(cacheKey, stats, TTL.TEAM_STATS)
    return stats
  } catch (err) {
    console.warn(`[ScoutBet] Team stats failed (team=${teamId}):`, err)
    return null
  }
}

async function fetchH2H(homeId: number, awayId: number): Promise<ApiFixture[]> {
  // Canonical key: smaller ID first (avoids duplicate cache entries)
  const cacheKey = `h2h:${Math.min(homeId, awayId)}-${Math.max(homeId, awayId)}`
  const cached   = apiCache.get<ApiFixture[]>(cacheKey)
  if (cached) return cached

  try {
    const data = await apiFetch<ApiFixture[]>('/fixtures/headtohead', {
      h2h:  `${homeId}-${awayId}`,
      last: 5,
    })
    apiCache.set(cacheKey, data, TTL.H2H)
    return data
  } catch (err) {
    console.warn(`[ScoutBet] H2H failed (${homeId}-${awayId}):`, err)
    return []
  }
}

async function fetchInjuries(fixtureId: number): Promise<ApiInjury[]> {
  const cacheKey = `injuries:${fixtureId}`
  const cached   = apiCache.get<ApiInjury[]>(cacheKey)
  if (cached) return cached

  try {
    const data = await apiFetch<ApiInjury[]>('/injuries', { fixture: fixtureId })
    apiCache.set(cacheKey, data, TTL.INJURIES)
    return data
  } catch (err) {
    console.warn(`[ScoutBet] Injuries failed (fixture=${fixtureId}):`, err)
    return []
  }
}

// ── Parallel detail fetcher for one fixture ───────────────────────────────────

async function fetchGameDetails(fixture: ApiFixture, rank: number): Promise<Game> {
  const homeId   = fixture.teams.home.id
  const awayId   = fixture.teams.away.id
  const leagueId = fixture.league.id

  const [homeStats, awayStats, h2hFixtures, injuries] = await Promise.all([
    fetchTeamStats(homeId,   leagueId),
    fetchTeamStats(awayId,   leagueId),
    fetchH2H(homeId, awayId),
    fetchInjuries(fixture.fixture.id),
  ])

  const input: GameMapperInput = {
    fixture, homeStats, awayStats, h2hFixtures, injuries, rank,
  }
  return mapGame(input)
}

// ── Public service ────────────────────────────────────────────────────────────

export const gameService = {

  async getTodayGames(): Promise<Game[]> {
    if (shouldUseMock()) {
      console.info('[ScoutBet] Mock mode active')
      return MOCK_GAMES
        .filter(g => g.featuredRank !== null)
        .sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))
    }

    try {
      const fixtures = await fetchTodayFixtures()

      if (fixtures.length === 0) {
        console.info('[ScoutBet] No active fixtures today — mock fallback')
        return MOCK_GAMES.filter(g => g.featuredRank !== null)
      }

      // Rank by prestige (league tier + status), take top 5
      const top5 = [...fixtures]
        .sort((a, b) => fixturePrestigeScore(b) - fixturePrestigeScore(a))
        .slice(0, 5)

      const games = await Promise.all(
        top5.map((fixture, idx) => fetchGameDetails(fixture, idx + 1))
      )

      console.info(`[ScoutBet] Loaded ${games.length} real games`)
      return games

    } catch (err) {
      console.error('[ScoutBet] getTodayGames failed — mock fallback:', err)
      return MOCK_GAMES.filter(g => g.featuredRank !== null)
    }
  },

  async getGameById(id: string): Promise<Game | null> {
    if (shouldUseMock()) {
      return MOCK_GAMES.find(g => g.id === id) ?? null
    }

    // Games fetched by getTodayGames are stored in the game store already.
    // This is called when navigating directly to /jogo/:id.
    const fixtureId = parseInt(id.replace('fixture-', ''), 10)
    if (isNaN(fixtureId)) {
      return MOCK_GAMES.find(g => g.id === id) ?? null
    }

    const cacheKey = `game-detail:${fixtureId}`
    const cached   = apiCache.get<Game>(cacheKey)
    if (cached) return cached

    try {
      const fixtures = await apiFetch<ApiFixture[]>('/fixtures', {
        id:       fixtureId,
        timezone: 'Europe/Lisbon',
      })

      if (!fixtures || fixtures.length === 0) return null

      const game = await fetchGameDetails(fixtures[0], 0)
      apiCache.set(cacheKey, game, TTL.FIXTURES_TODAY)
      return game

    } catch (err) {
      console.error(`[ScoutBet] getGameById failed (${id}):`, err)
      return MOCK_GAMES.find(g => g.id === id) ?? null
    }
  },

  async getMultipleSuggestions(): Promise<MultipleSuggestion[]> {
    // Sprint 6: AI-generated multiples using real game data
    return MOCK_MULTIPLES
  },

  async refreshGame(id: string): Promise<Game | null> {
    const fixtureId = parseInt(id.replace('fixture-', ''), 10)
    if (!isNaN(fixtureId)) {
      apiCache.delete(`game-detail:${fixtureId}`)
      apiCache.delete(`injuries:${fixtureId}`)
    }
    apiCache.delete(`fixtures:${todayUTC()}`)
    return this.getGameById(id)
  },

  /** Debug helper: returns current cache state */
  getDebugInfo() {
    return {
      cacheKeys:    apiCache.keys(),
      cacheSize:    apiCache.size,
      isMockMode:   shouldUseMock(),
    }
  },
}
