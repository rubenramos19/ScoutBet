// ─── SofaScore Debug Page ─────────────────────────────────────────────────────
// Temporary diagnostic page — route: /debug-sofa
// Purpose: confirm scheduled-events endpoint returns real games before
//          any further stat/form/H2H work proceeds.

import { useEffect, useState } from 'react'

const BASE = 'https://api.sofascore.com/api/v1'
const HEADERS: HeadersInit = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://www.sofascore.com/',
  'Origin':          'https://www.sofascore.com',
}

function isoDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

interface RawEvent {
  id: number
  tournament?: { name?: string; uniqueTournament?: { name?: string; id?: number } }
  homeTeam?: { name?: string; id?: number }
  awayTeam?: { name?: string; id?: number }
  status?: { description?: string; type?: string; code?: number }
  startTimestamp?: number
}

interface DateResult {
  date: string
  url: string
  status: number | null
  ok: boolean
  rawKeys: string[]
  events: RawEvent[]
  error: string | null
  durationMs: number
}

async function fetchDate(date: string): Promise<DateResult> {
  const url = `${BASE}/sport/football/scheduled-events/${date}`
  const start = Date.now()

  try {
    const res = await fetch(url, { headers: HEADERS })
    const duration = Date.now() - start
    let body: Record<string, unknown> = {}
    let error: string | null = null

    try {
      body = await res.json()
    } catch (e) {
      error = 'JSON parse failed: ' + String(e)
    }

    const events: RawEvent[] = Array.isArray(body.events) ? (body.events as RawEvent[]) : []

    const result: DateResult = {
      date,
      url,
      status: res.status,
      ok: res.ok,
      rawKeys: Object.keys(body),
      events,
      error,
      durationMs: duration,
    }

    // Console output as requested
    console.log(`[SOFA] URL: ${url}`)
    console.log(`[SOFA] HTTP status: ${res.status} (${duration}ms)`)
    console.log(`[SOFA] Response keys: ${Object.keys(body).join(', ')}`)
    console.log(`[SOFA] Response count: ${events.length}`)
    if (events.length > 0) console.log('[SOFA] First event:', events[0])

    return result
  } catch (err) {
    const duration = Date.now() - start
    console.error(`[SOFA] Network error for ${date}:`, err)
    return {
      date,
      url,
      status: null,
      ok: false,
      rawKeys: [],
      events: [],
      error: String(err),
      durationMs: duration,
    }
  }
}

// ── Pill component ─────────────────────────────────────────────────────────────

function Pill({ label, value, color = 'text-text-primary' }: { label: string; value: string | number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-surface-raised px-2 py-0.5 rounded text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </span>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function statusColor(type?: string): string {
  if (type === 'inprogress') return 'text-amber-400'
  if (type === 'finished')   return 'text-text-muted'
  if (type === 'notstarted') return 'text-teal-400'
  return 'text-text-secondary'
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SofaDebugPage() {
  const dates = [isoDate(-1), isoDate(0), isoDate(1)]
  const [results, setResults] = useState<Record<string, DateResult>>({})
  const [loading, setLoading] = useState(true)
  const [activeDate, setActiveDate] = useState(isoDate(0))

  useEffect(() => {
    setLoading(true)
    Promise.all(dates.map(d => fetchDate(d))).then(all => {
      const map: Record<string, DateResult> = {}
      all.forEach(r => { map[r.date] = r })
      setResults(map)
      setLoading(false)
    })
  }, [])

  const active = results[activeDate]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 font-sans">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <div>
          <h1 className="text-xl font-black text-text-primary">SofaScore — Debug de Endpoints</h1>
          <p className="text-xs text-text-muted">Diagnóstico de scheduled-events · sem filtragem · dados brutos</p>
        </div>
      </div>

      {/* Date selector + summary */}
      <div className="grid grid-cols-3 gap-3">
        {dates.map(date => {
          const r = results[date]
          const isToday = date === isoDate(0)
          const label   = date === isoDate(-1) ? 'Ontem' : date === isoDate(0) ? 'Hoje' : 'Amanhã'
          const count   = r ? r.events.length : null
          const isActive = date === activeDate

          return (
            <button
              key={date}
              onClick={() => setActiveDate(date)}
              className={[
                'rounded-xl p-4 border text-left transition-all',
                isActive
                  ? 'border-brand bg-brand/10'
                  : 'border-surface-border bg-surface-card hover:border-brand/40',
              ].join(' ')}
            >
              <p className="text-2xs text-text-muted font-mono mb-1">{date}</p>
              <p className={`text-sm font-bold ${isToday ? 'text-brand' : 'text-text-primary'}`}>{label}</p>
              {loading
                ? <p className="text-xs text-text-muted mt-1 animate-pulse">A carregar…</p>
                : r
                  ? <p className={`text-xl font-black mt-1 tabular-nums ${count! > 0 ? 'text-accent-win' : 'text-accent-loss'}`}>{count}</p>
                  : null
              }
              {!loading && r && <p className="text-2xs text-text-muted">eventos</p>}
            </button>
          )
        })}
      </div>

      {/* Detail panel for active date */}
      {active && (
        <div className="space-y-4">
          {/* Request info */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Pedido HTTP</p>
            <div className="flex flex-wrap gap-2">
              <Pill label="Data" value={active.date} />
              <Pill label="HTTP" value={active.status ?? 'ERRO'} color={active.ok ? 'text-accent-win' : 'text-accent-loss'} />
              <Pill label="Tempo" value={`${active.durationMs}ms`} />
              <Pill label="Eventos" value={active.events.length} color={active.events.length > 0 ? 'text-accent-win' : 'text-accent-loss'} />
            </div>
            <div className="mt-2">
              <p className="text-2xs text-text-muted mb-1">URL</p>
              <code className="text-2xs font-mono text-brand break-all bg-surface-raised px-2 py-1 rounded block">
                {active.url}
              </code>
            </div>
            {active.rawKeys.length > 0 && (
              <div className="mt-2">
                <p className="text-2xs text-text-muted mb-1">Chaves da resposta JSON</p>
                <code className="text-2xs font-mono text-text-secondary">{active.rawKeys.join(', ')}</code>
              </div>
            )}
            {active.error && (
              <div className="mt-2 bg-accent-lossBg border border-accent-loss/20 rounded-lg px-3 py-2">
                <p className="text-xs text-accent-loss font-bold">Erro</p>
                <p className="text-xs text-accent-loss font-mono">{active.error}</p>
              </div>
            )}
          </div>

          {/* Events table */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              Todos os eventos ({active.events.length}) — sem filtragem
            </p>

            {active.events.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm font-bold text-text-secondary">0 eventos devolvidos</p>
                <p className="text-xs text-text-muted mt-1">
                  {active.ok
                    ? 'A API respondeu com HTTP 200 mas sem eventos para esta data.'
                    : `A API respondeu com HTTP ${active.status}.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-text-muted text-left">
                      <th className="pb-2 pr-3 font-medium">ID</th>
                      <th className="pb-2 pr-3 font-medium">Competição</th>
                      <th className="pb-2 pr-3 font-medium">Casa</th>
                      <th className="pb-2 pr-3 font-medium">Visitante</th>
                      <th className="pb-2 pr-3 font-medium">Estado</th>
                      <th className="pb-2 font-medium">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.events.map((e, i) => {
                      const league = e.tournament?.uniqueTournament?.name
                        ?? e.tournament?.name
                        ?? '—'
                      const time   = e.startTimestamp
                        ? new Date(e.startTimestamp * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                        : '—'
                      const type   = e.status?.type ?? ''
                      return (
                        <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-raised">
                          <td className="py-1.5 pr-3 font-mono text-text-muted">{e.id}</td>
                          <td className="py-1.5 pr-3 text-brand font-medium max-w-32 truncate">{league}</td>
                          <td className="py-1.5 pr-3 text-text-primary">{e.homeTeam?.name ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-text-primary">{e.awayTeam?.name ?? '—'}</td>
                          <td className={`py-1.5 pr-3 font-medium ${statusColor(type)}`}>
                            {e.status?.description ?? type ?? '—'}
                          </td>
                          <td className="py-1.5 font-mono text-text-muted">{time}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && !active && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
