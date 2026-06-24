import {
  apiFetch,
  API_CONFIG,
  todayUTC,
  resolveCompetitionSeason,
  isInternationalCompetition,
  DISCOVERY_LEAGUES,
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

function shouldUseMock(): boolean {
  const forceMock = import.meta.env.VITE_USE_MOCK === 'true'
  const hasKey    = Boolean(import.meta.env.VITE_API_FOOTBALL_KEY?.trim())
  return forceMock || !hasKey
}

export interface FetchMeta {
  noGamesReason:   string | null
  autoDiscovery:   boolean
  analyzedLeagues: string[]
}

let lastFetchMeta: FetchMeta = {
  noGamesReason:   null,
  autoDiscovery:   false,
  analyzedLeagues: [],
}

async function fetchTodayFixtures(): Promise<ApiFixture[]> {
  const today    = todayUTC()
  const cacheKey = 'fixtures:' + today
  const cached   = apiCache.get<ApiFixture[]>(cacheKey)
  if (cached) {
    console.debug('[ScoutBet] Cache hit: ' + cached.length + ' active fixtures for ' + today)
    return cached
  }

  const leagueIds = API_CONFIG.watchedLeagues
  console.debug('[ScoutBet] Fetching watched leagues [' + leagueIds.join(',') + '] for ' + today)

  const settled = await Promise.allSettled(
    leagueIds.map(leagueId =>
      apiFetch<ApiFixture[]>('/fixtures', {
        date:     today,
        league:   leagueId,
        season:   resolveCompetitionSeason(leagueId),
        timezone: 'Europe/Lisbon',
      }).then(fixtures => ({ leagueId, fixtures }))
    )
  )

  const fixtures: ApiFixture[] = []
  settled.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      console.debug('[ScoutBet] League ' + res.value.leagueId + ': ' + res.value.fixtures.length + ' raw fixtures')
      fixtures.push(...res.value.fixtures)
    } else {
      console.warn('[ScoutBet] League ' + leagueIds[idx] + ' failed:', res.reason)
    }
  })

  const active = fixtures.filter(f => isActiveGame(mapStatus(f.fixture.status.short)))
  console.debug('[ScoutBet] Watched total: ' + fixtures.length + ' raw -> ' + active.length + ' active')

  apiCache.set(cacheKey, active, TTL.FIXTURES_TODAY)
  return active
}

async function fetchTeamStats(teamId: number, leagueId: number): Promise<ApiTeamStats | null> {
  const season   = resolveCompetitionSeason(leagueId)
  const cacheKey = 'stats:' + teamId + ':' + leagueId + ':' + season
  const cached   = apiCache.get<ApiTeamStats>(cacheKey)
  if (cached) return cached
  try {
    const data  = await apiFetch<ApiTeamStats>('/teams/statistics', { team: teamId, league: leagueId, season })
    const stats = Array.isArray(data) ? data[0] : data
    if (!stats) return null
    apiCache.set(cacheKey, stats, TTL.TEAM_STATS)
    return stats
  } catch (err) {
    console.warn('[ScoutBet] Team stats failed (team=' + teamId + '):', err)
    return null
  }
}

async function fetchH2H(homeId: number, awayId: number): Promise<ApiFixture[]> {
  const cacheKey = 'h2h:' + Math.min(homeId, awayId) + '-' + Math.max(homeId, awayId)
  const cached   = apiCache.get<ApiFixture[]>(cacheKey)
  if (cached) return cached
  try {
    const data = await apiFetch<ApiFixture[]>('/fixtures/headtohead', { h2h: homeId + '-' + awayId, last: 5 })
    apiCache.set(cacheKey, data, TTL.H2H)
    return data
  } catch (err) {
    console.warn('[ScoutBet] H2H failed (' + homeId + '-' + awayId + '):', err)
    return []
  }
}

async function fetchInjuries(fixtureId: number): Promise<ApiInjury[]> {
  const cacheKey = 'injuries:' + fixtureId
  const cached   = apiCache.get<ApiInjury[]>(cacheKey)
  if (cached) return cached
  try {
    const data = await apiFetch<ApiInjury[]>('/injuries', { fixture: fixtureId })
    apiCache.set(cacheKey, data, TTL.INJURIES)
    return data
  } catch (err) {
    console.warn('[ScoutBet] Injuries failed (fixture=' + fixtureId + '):', err)
    return []
  }
}

async function fetchGameDetails(fixture: ApiFixture, rank: number): Promise<Game> {
  const homeId   = fixture.teams.home.id
  const awayId   = fixture.teams.away.id
  const leagueId = fixture.league.id
  const [homeStats, awayStats, h2hFixtures, injuries] = await Promise.all([
    fetchTeamStats(homeId, leagueId),
    fetchTeamStats(awayId, leagueId),
    fetchH2H(homeId, awayId),
    fetchInjuries(fixture.fixture.id),
  ])
  const input: GameMapperInput = { fixture, homeStats, awayStats, h2hFixtures, injuries, rank }
  return mapGame(input)
}

interface DiscoveryResult {
  fixtures:       ApiFixture[]
  leaguesChecked: string[]
  leagueFound:    string
}

async function fetchAutoDiscoveryFixtures(alreadyChecked: Set<number>): Promise<DiscoveryResult> {
  const today          = todayUTC()
  const leaguesChecked: string[] = []
  const candidates     = DISCOVERY_LEAGUES.filter(l => !alreadyChecked.has(l.id))
  const tier1          = candidates.filter(l =>  isInternationalCompetition(l.id))
  const tier2          = candidates.filter(l => !isInternationalCompetition(l.id))
  const tiers          = [tier1, tier2]

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    if (tier.length === 0) continue

    leaguesChecked.push(...tier.map(l => l.label))
    console.debug('[ScoutBet] Discovery tier ' + (i + 1) + ': [' + tier.map(l => l.label).join(', ') + ']')

    const settled = await Promise.allSettled(
      tier.map(async l => {
        const season   = resolveCompetitionSeason(l.id)
        const cacheKey = 'discovery:' + l.id + ':' + today
        const cached   = apiCache.get<ApiFixture[]>(cacheKey)
        if (cached) return { league: l, fixtures: cached }

        const raw    = await apiFetch<ApiFixture[]>('/fixtures', {
          date: today, league: l.id, season, timezone: 'Europe/Lisbon',
        })
        const active = raw.filter(f => isActiveGame(mapStatus(f.fixture.status.short)))
        apiCache.set(cacheKey, active, TTL.FIXTURES_TODAY)
        console.debug('[ScoutBet] ' + l.label + ' (id=' + l.id + ', season=' + season + '): ' + raw.length + ' raw -> ' + active.length + ' active')
        return { league: l, fixtures: active }
      })
    )

    const tierFixtures: ApiFixture[] = []
    const tierFound:    string[]     = []

    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value.fixtures.length > 0) {
        tierFixtures.push(...res.value.fixtures)
        tierFound.push(res.value.league.label)
      }
    }

    if (tierFixtures.length > 0) {
      const foundLabel = tierFound.join(', ')
      console.info('[ScoutBet] Auto-discovery tier ' + (i + 1) + ': ' + tierFixtures.length + ' fixtures in [' + foundLabel + ']')
      return { fixtures: tierFixtures, leaguesChecked, leagueFound: foundLabel }
    }
  }

  return { fixtures: [], leaguesChecked, leagueFound: '' }
}

export const gameService = {

  async getTodayGames(): Promise<Game[]> {
    lastFetchMeta = { noGamesReason: null, autoDiscovery: false, analyzedLeagues: [] }

    if (shouldUseMock()) {
      const reason = import.meta.env.VITE_USE_MOCK === 'true'
        ? 'Mock mode forcado (VITE_USE_MOCK=true)'
        : 'API key nao configurada (VITE_API_FOOTBALL_KEY ausente)'
      console.info('[ScoutBet] Mock mode activo: ' + reason)
      lastFetchMeta.noGamesReason   = reason
      lastFetchMeta.analyzedLeagues = ['Mock data']
      return MOCK_GAMES
        .filter(g => g.featuredRank !== null)
        .sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))
    }

    const today = todayUTC()
    console.info('[ScoutBet] Key: SET | Mock: false | Season: ' + API_CONFIG.season + ' | Date: ' + today)

    const watchedIds    = new Set(API_CONFIG.watchedLeagues)
    const watchedLabels = API_CONFIG.watchedLeagues.map(
      id => DISCOVERY_LEAGUES.find(l => l.id === id)?.label ?? ('Liga ' + id)
    )

    try {
      const watched = await fetchTodayFixtures()

      if (watched.length > 0) {
        lastFetchMeta.analyzedLeagues = [...new Set(watched.map(f => f.league.name))]
        const top5  = [...watched].sort((a, b) => fixturePrestigeScore(b) - fixturePrestigeScore(a)).slice(0, 5)
        const games = await Promise.all(top5.map((fixture, idx) => fetchGameDetails(fixture, idx + 1)))
        console.info('[ScoutBet] ' + games.length + ' jogos reais carregados das ligas watched')
        return games
      }

      console.info('[ScoutBet] Ligas watched [' + watchedLabels.join(', ') + '] -> 0 fixtures para ' + today + '. Iniciando auto-discovery...')

      const discovery = await fetchAutoDiscoveryFixtures(watchedIds)
      lastFetchMeta.analyzedLeagues = [...watchedLabels, ...discovery.leaguesChecked]

      if (discovery.fixtures.length > 0) {
        const top5  = [...discovery.fixtures].sort((a, b) => fixturePrestigeScore(b) - fixturePrestigeScore(a)).slice(0, 5)
        const games = await Promise.all(top5.map((fixture, idx) => fetchGameDetails(fixture, idx + 1)))
        lastFetchMeta.autoDiscovery = true
        console.info('[ScoutBet] Auto-discovery: ' + games.length + ' jogos de [' + discovery.leagueFound + ']')
        return games
      }

      const n      = lastFetchMeta.analyzedLeagues.length
      const reason = 'Pausa ou dia sem jogos — ' + n + ' competicao' + (n !== 1 ? 'es' : '') + ' analisada' + (n !== 1 ? 's' : '') + ' sem fixtures activos hoje.'
      console.info('[ScoutBet] ' + reason)
      lastFetchMeta.noGamesReason = reason
      return []

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ScoutBet] getTodayGames falhou:', err)
      lastFetchMeta.noGamesReason = 'Erro ao contactar a API: ' + message
      return []
    }
  },

  async getGameById(id: string): Promise<Game | null> {
    if (shouldUseMock()) return MOCK_GAMES.find(g => g.id === id) ?? null

    const fixtureId = parseInt(id.replace('fixture-', ''), 10)
    if (isNaN(fixtureId)) return MOCK_GAMES.find(g => g.id === id) ?? null

    const cacheKey = 'game-detail:' + fixtureId
    const cached   = apiCache.get<Game>(cacheKey)
    if (cached) return cached

    try {
      const fixtures = await apiFetch<ApiFixture[]>('/fixtures', { id: fixtureId, timezone: 'Europe/Lisbon' })
      if (!fixtures || fixtures.length === 0) return null
      const game = await fetchGameDetails(fixtures[0], 0)
      apiCache.set(cacheKey, game, TTL.FIXTURES_TODAY)
      return game
    } catch (err) {
      console.error('[ScoutBet] getGameById failed (' + id + '):', err)
      return null
    }
  },

  async getMultipleSuggestions(): Promise<MultipleSuggestion[]> {
    return MOCK_MULTIPLES
  },

  async refreshGame(id: string): Promise<Game | null> {
    const fixtureId = parseInt(id.replace('fixture-', ''), 10)
    if (!isNaN(fixtureId)) {
      apiCache.delete('game-detail:' + fixtureId)
      apiCache.delete('injuries:' + fixtureId)
    }
    apiCache.delete('fixtures:' + todayUTC())
    return this.getGameById(id)
  },

  getLastFetchMeta(): FetchMeta {
    return { ...lastFetchMeta }
  },

  getDebugInfo() {
    return {
      cacheKeys:  apiCache.keys(),
      cacheSize:  apiCache.size,
      isMockMode: shouldUseMock(),
      lastMeta:   lastFetchMeta,
    }
  },
}
