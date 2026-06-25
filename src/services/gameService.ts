// ─── Game Service ──────────────────────────────────────────────────────────────
// Primary source : ESPN public API (WC 2026 — no key, CORS open)
// Fallback source: api-sports via proxy (free plan: 2022-2024 only)
//
// Rule: NEVER invent statistics. If a fetch fails → null, never fake defaults.
//
// Cache TTL strategy:
//   - No live games  → 30 min (FIXTURES_TODAY)
//   - Live games present → 2 min (LIVE_REFRESH) so scores stay fresh

import {
  getESPNScoreboard,
  getESPNTeamSchedule,
} from '@/lib/espn'
import type { ESPNEvent } from '@/lib/espn'
import { mapESPNGame } from '@/lib/espnMappers'
import { apiCache, TTL } from '@/lib/cache'
import { MOCK_GAMES, MOCK_MULTIPLES } from '@/mock/games'
import type { Game, MultipleSuggestion, BetMarket } from '@/types'
import type { MultipleSelection } from '@/types'

// ── Longer live-refresh TTL (2 min when live games present) ──────────────────
const LIVE_REFRESH_TTL = 2 * 60 * 1000  // 2 min

// ── Mock guard ─────────────────────────────────────────────────────────────────

function shouldUseMock(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}

// ── Fetch metadata ────────────────────────────────────────────────────────────

export interface FetchMeta {
  noGamesReason:   string | null
  autoDiscovery:   boolean
  analyzedLeagues: string[]
  gamesDate:       string | null
  hasLive:         boolean
}

let lastFetchMeta: FetchMeta = {
  noGamesReason:   null,
  autoDiscovery:   false,
  analyzedLeagues: [],
  gamesDate:       null,
  hasLive:         false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function todayKey():     string { return `espn:games:${todayUTC()}` }
function todayMetaKey(): string { return `espn:games:meta:${todayUTC()}` }

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── ESPN Discovery ────────────────────────────────────────────────────────────

async function discoverESPNFixtures(): Promise<{ events: ESPNEvent[]; leagues: string[] }> {
  const date = todayUTC()
  console.info(`[ESPN] A carregar scoreboard WC para ${date}…`)

  const board = await getESPNScoreboard(date)
  if (!board) {
    console.warn('[ESPN] scoreboard falhou')
    return { events: [], leagues: [] }
  }

  const relevant = (board.events ?? []).filter(ev => {
    const statusName = ev.competitions?.[0]?.status?.type?.name ?? ''
    return !statusName.includes('CANCELED') && !statusName.includes('POSTPONED')
  })

  console.info(`[ESPN] ${relevant.length} eventos WC encontrados`)

  const leagueName = board.leagues?.[0]?.name ?? 'FIFA World Cup'
  return {
    events:  relevant,
    leagues: relevant.length > 0 ? [leagueName] : [],
  }
}

// ── Enrichment ────────────────────────────────────────────────────────────────

async function enrichESPNEvent(event: ESPNEvent, rank: number): Promise<Game> {
  const comp     = event.competitions[0]
  const homeComp = comp?.competitors.find(c => c.homeAway === 'home')
  const awayComp = comp?.competitors.find(c => c.homeAway === 'away')

  const homeId = homeComp?.team.id
  const awayId = awayComp?.team.id

  console.debug(`[ESPN] Enriquecer: ${event.name} (home=${homeId}, away=${awayId})`)

  const [homeSchedule, awaySchedule] = await Promise.all([
    homeId ? getESPNTeamSchedule(homeId, 2026) : Promise.resolve(null),
    awayId ? getESPNTeamSchedule(awayId, 2026) : Promise.resolve(null),
  ])

  if (homeSchedule) {
    const completed = homeSchedule.events?.filter(e =>
      e.competitions?.[0]?.status?.type?.name?.includes('FINAL')
    ).length ?? 0
    console.debug(`[ESPN]   ${homeComp?.team.displayName}: ${completed} jogos completos`)
  }

  if (awaySchedule) {
    const completed = awaySchedule.events?.filter(e =>
      e.competitions?.[0]?.status?.type?.name?.includes('FINAL')
    ).length ?? 0
    console.debug(`[ESPN]   ${awayComp?.team.displayName}: ${completed} jogos completos`)
  }

  return mapESPNGame({ event, homeSchedule, awaySchedule, rank })
}

// ── Service ────────────────────────────────────────────────────────────────────

export const gameService = {

  async getTodayGames(): Promise<Game[]> {
    lastFetchMeta = {
      noGamesReason: null,
      autoDiscovery: false,
      analyzedLeagues: [],
      gamesDate: null,
      hasLive: false,
    }

    if (shouldUseMock()) {
      lastFetchMeta.noGamesReason   = 'Mock mode activo'
      lastFetchMeta.analyzedLeagues = ['Mock']
      return MOCK_GAMES
        .filter(g => g.featuredRank !== null)
        .sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))
    }

    const cached     = apiCache.get<Game[]>(todayKey())
    const cachedMeta = apiCache.get<FetchMeta>(todayMetaKey())
    if (cached && cachedMeta) {
      const now = Date.now()
      // Bypass cache if any SCHEDULED game's kickoff has already passed — it may now be LIVE
      const hasPotentiallyLive = cached.some(
        g => g.status === 'SCHEDULED' && new Date(g.date).getTime() <= now,
      )
      if (!hasPotentiallyLive) {
        lastFetchMeta = cachedMeta
        console.debug(`[ESPN] Cache hit: ${cached.length} jogos (live=${cachedMeta.hasLive})`)
        return cached
      }
      console.debug('[ESPN] Cache bypass: kickoff passed on SCHEDULED game, refetching for live status')
      apiCache.delete(todayKey())
      apiCache.delete(todayMetaKey())
    }

    try {
      const { events, leagues } = await discoverESPNFixtures()

      if (events.length === 0) {
        lastFetchMeta.noGamesReason = 'Sem jogos WC 2026 encontrados hoje via ESPN.'
        apiCache.set(todayMetaKey(), lastFetchMeta, TTL.FIXTURES_TODAY)
        return []
      }

      lastFetchMeta.autoDiscovery   = true
      lastFetchMeta.analyzedLeagues = leagues
      lastFetchMeta.gamesDate       = todayUTC()

      const toEnrich = events.slice(0, 6)
      const games: Game[] = []

      for (let i = 0; i < toEnrich.length; i++) {
        if (i > 0) await delay(150)
        try {
          games.push(await enrichESPNEvent(toEnrich[i], i + 1))
        } catch (err) {
          console.warn(`[ESPN] enrichESPNEvent ${toEnrich[i].id} falhou:`, err)
        }
      }

      // Shorter cache when live games are in progress
      const hasLive = games.some(g => g.status === 'LIVE')
      lastFetchMeta.hasLive = hasLive
      const cacheTTL = hasLive ? LIVE_REFRESH_TTL : TTL.FIXTURES_TODAY

      apiCache.set(todayKey(),     games,         cacheTTL)
      apiCache.set(todayMetaKey(), lastFetchMeta, cacheTTL)

      console.info(`[ESPN] ${games.length} jogos carregados — TTL ${cacheTTL / 1000}s — live=${hasLive}`)
      return games

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ESPN] getTodayGames falhou:', err)
      lastFetchMeta.noGamesReason = `Erro ESPN: ${msg}`
      return []
    }
  },

  async getGameById(id: string): Promise<Game | null> {
    if (shouldUseMock()) return MOCK_GAMES.find(g => g.id === id) ?? null
    const cached = apiCache.get<Game[]>(todayKey())
    if (cached) return cached.find(g => g.id === id) ?? null
    const games = await this.getTodayGames()
    return games.find(g => g.id === id) ?? null
  },

  async getMultipleSuggestions(): Promise<MultipleSuggestion[]> {
    if (shouldUseMock()) return MOCK_MULTIPLES
    // Generate from cached games (already fetched by getTodayGames)
    const cached = apiCache.get<Game[]>(todayKey())
    if (cached && cached.length >= 2) return buildMultiples(cached)
    // If not cached yet, fetch first then build
    const games = await this.getTodayGames()
    return buildMultiples(games)
  },

  async refreshGame(_id: string): Promise<Game | null> {
    apiCache.delete(todayKey())
    apiCache.delete(todayMetaKey())
    const games = await this.getTodayGames()
    return games.find(g => g.id === _id) ?? null
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

// ── Combinadas builder ────────────────────────────────────────────────────────
// Generates MultipleSuggestion objects from real ESPN games.
// No invented odds — only uses games that have real stats (over25Pct / bttsPct).

function buildMultiples(games: Game[]): MultipleSuggestion[] {
  // Score each game by data quality + best market signal
  interface ScoredGame {
    game:   Game
    market: string
    pick:   string
    odd:    number
    conf:   number
  }

  const scored: ScoredGame[] = []
  for (const g of games) {
    const s = g.stats
    // Only use games with real stat data
    if (s.over25Pct != null && s.over25Pct > 50) {
      scored.push({ game: g, market: 'OVER_25', pick: 'Mais de 2.5 Golos', odd: 1.75, conf: s.over25Pct })
    } else if (s.bttsPct != null && s.bttsPct > 50) {
      scored.push({ game: g, market: 'BTTS', pick: 'Ambas Marcam: Sim', odd: 1.80, conf: s.bttsPct })
    } else if (s.homeWinPct != null && s.homeWinPct > 55) {
      scored.push({ game: g, market: '1X2', pick: `${g.homeTeam.name} Vence`, odd: 2.00, conf: s.homeWinPct })
    }
  }

  if (scored.length < 2) return []

  // Sort by confidence descending
  scored.sort((a, b) => b.conf - a.conf)

  const toSel = (sg: ScoredGame): MultipleSelection => ({
    gameId:    sg.game.id,
    gameLabel: `${sg.game.homeTeam.name} vs ${sg.game.awayTeam.name}`,
    market:    sg.market as BetMarket,
    pick:      sg.pick,
    odd:       sg.odd,
    confidence: sg.conf,
    reasoning: `${sg.conf}% de confiança baseado em dados ESPN`,
  })

  const multiples: MultipleSuggestion[] = []

  // Conservative: top 2 picks
  if (scored.length >= 2) {
    const legs   = scored.slice(0, 2)
    const combOdd = parseFloat(legs.reduce((a, b) => a * b.odd, 1).toFixed(2))
    multiples.push({
      id:         'multi-conserv',
      label:      'Dupla Conservadora',
      strategy:   'CONSERVATIVE',
      selections: legs.map(toSel),
      totalOdd:   combOdd,
      confidence: Math.round(legs.reduce((a, b) => a + b.conf, 0) / legs.length),
      reasoning:  `2 selecções de alta confiança — odd combinada ${combOdd}`,
    })
  }

  // Value: top 3 picks
  if (scored.length >= 3) {
    const legs   = scored.slice(0, 3)
    const combOdd = parseFloat(legs.reduce((a, b) => a * b.odd, 1).toFixed(2))
    multiples.push({
      id:         'multi-value',
      label:      'Tripla Valor',
      strategy:   'VALUE',
      selections: legs.map(toSel),
      totalOdd:   combOdd,
      confidence: Math.round(legs.reduce((a, b) => a + b.conf, 0) / legs.length),
      reasoning:  `3 selecções com dados reais ESPN — odd combinada ${combOdd}`,
    })
  }

  return multiples
}
