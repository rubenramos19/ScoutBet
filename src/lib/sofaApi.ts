// sofaScore via RapidAPI (trending events) + SofaScore direct API (stats/h2h/lineups)
import { apiCache, TTL } from '@/lib/cache'
import type {
  SofaEvent,
  SofaH2H,
  SofaLineup,
  SofaTeamSeasonStats,
} from '@/lib/sofaScore'

// ── RapidAPI (trending events only — Basic plan) ───────────────────────────
const RAPIDAPI_HOST = 'sofascore.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

// ── SofaScore direct API (stats, h2h, lineups — free, no key required) ────
const SOFA_DIRECT = '/api/sofa'

function rapidapiKey(): string {
  return import.meta.env.VITE_RAPIDAPI_KEY ?? ''
}

function isConfigured(): boolean {
  const k = rapidapiKey()
  return k.length > 0 && k !== 'your_key_here'
}

export function sofaApiStatus(): { configured: boolean; keyPreview: string } {
  const k = rapidapiKey()
  return {
    configured: isConfigured(),
    keyPreview: k.length > 8 ? k.slice(0, 4) + '...' + k.slice(-4) : k.length > 0 ? '(set)' : '(not set)',
  }
}

// ── RapidAPI fetch (only used for trending events) ─────────────────────────
export async function sofaGet<T>(path: string): Promise<T | null> {
  const key = rapidapiKey()
  if (!key) { console.warn('[SofaAPI] VITE_RAPIDAPI_KEY nao configurada'); return null }
  const url = RAPIDAPI_BASE + path
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': RAPIDAPI_HOST },
    })
    if (res.status === 204) return null
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[SofaAPI] ${res.status} ${path} - ${body.slice(0, 150)}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn(`[SofaAPI] ${path}:`, err)
    return null
  }
}

// ── SofaScore direct fetch (stats/h2h/lineups — no API key needed) ─────────
async function sofaDirect<T>(path: string): Promise<T | null> {
  const url = SOFA_DIRECT + path
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (res.status === 204) return null
    if (!res.ok) {
      console.warn(`[SofaDirect] ${res.status} ${path}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn(`[SofaDirect] ${path}:`, err)
    return null
  }
}

// Delay helper — avoids rate limit bursts
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function eventSportId(e: SofaEvent): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e as any).tournament?.category?.sport?.id ?? 1
}

// ── Trending events (RapidAPI — the only endpoint that works on Basic) ──────
export async function getScheduledEvents(date: string): Promise<SofaEvent[]> {
  const cacheKey = `rapidapi:events:${date}`
  const cached = apiCache.get<SofaEvent[]>(cacheKey)
  if (cached) return cached

  const data = await sofaGet<{ events?: SofaEvent[] }>(`/tournaments/get-trending-events`)
  const allEvents = data?.events ?? []
  const footballEvents = allEvents.filter(e => eventSportId(e) === 1)

  const forDate = footballEvents.filter(e => {
    const d = new Date(e.startTimestamp * 1000).toISOString().slice(0, 10)
    return d === date
  })

  const events = forDate.length > 0 ? forDate : footballEvents.slice(0, 20)
  console.log(`[SOFA] ${allEvents.length} total -> ${footballEvents.length} football -> ${forDate.length} for ${date}`)

  apiCache.set(cacheKey, events, TTL.FIXTURES_TODAY)
  return events
}

// ── Team last matches — SofaScore direct API ────────────────────────────────
// Endpoint: GET /team/{id}/events/last/0
export async function getTeamLastEvents(teamId: number): Promise<SofaEvent[]> {
  const cacheKey = `sofa:team:${teamId}:last`
  const cached = apiCache.get<SofaEvent[]>(cacheKey)
  if (cached) return cached

  await delay(150)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await sofaDirect<any>(`/team/${teamId}/events/last/0`)

  console.log(`[SofaDirect] team ${teamId} last-events keys:`, data ? Object.keys(data) : 'null')

  const events: SofaEvent[] =
    Array.isArray(data?.events)         ? data.events          :
    Array.isArray(data?.previousEvents) ? data.previousEvents  :
    Array.isArray(data)                 ? data                 :
    []

  console.log(`[SofaDirect] team ${teamId} -> ${events.length} eventos`)
  apiCache.set(cacheKey, events, TTL.TEAM_STATS)
  return events
}

// ── H2H — SofaScore direct API ──────────────────────────────────────────────
// Endpoint: GET /event/{id}/h2h
export async function getEventH2H(eventId: number): Promise<SofaH2H | null> {
  const cacheKey = `sofa:h2h:${eventId}`
  const cached = apiCache.get<SofaH2H>(cacheKey)
  if (cached) return cached

  await delay(100)
  const data = await sofaDirect<SofaH2H>(`/event/${eventId}/h2h`)
  if (!data?.teamDuel) return null
  apiCache.set(cacheKey, data, TTL.H2H)
  return data
}

// ── Team season stats — SofaScore direct API ────────────────────────────────
// Endpoint: GET /team/{id}/unique-tournament/{utId}/season/{sId}/statistics/overall
export async function getTeamSeasonStats(
  teamId: number,
  uniqueTournamentId: number,
  seasonId: number,
): Promise<SofaTeamSeasonStats | null> {
  const cacheKey = `sofa:stats:${teamId}:${uniqueTournamentId}:${seasonId}`
  const cached = apiCache.get<SofaTeamSeasonStats>(cacheKey)
  if (cached) return cached

  await delay(150)
  const p = `/team/${teamId}/unique-tournament/${uniqueTournamentId}/season/${seasonId}/statistics/overall`
  const data = await sofaDirect<{ statistics?: SofaTeamSeasonStats }>(p)
  const stats = data?.statistics ?? null
  if (stats) apiCache.set(cacheKey, stats, TTL.TEAM_STATS)
  return stats
}

// ── Event lineups — SofaScore direct API ────────────────────────────────────
// Endpoint: GET /event/{id}/lineups
export async function getEventLineups(eventId: number): Promise<SofaLineup | null> {
  const cacheKey = `sofa:lineups:${eventId}`
  const cached = apiCache.get<SofaLineup>(cacheKey)
  if (cached) return cached

  await delay(100)
  const data = await sofaDirect<SofaLineup>(`/event/${eventId}/lineups`)
  if (!data) return null
  const ttl = data.confirmed ? TTL.TEAM_STATS : TTL.INJURIES
  apiCache.set(cacheKey, data, ttl)
  return data
}

export type { SofaEvent } from '@/lib/sofaScore'
