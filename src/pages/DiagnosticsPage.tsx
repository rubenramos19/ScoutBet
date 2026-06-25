// ─── API Diagnostics Page ──────────────────────────────────────────────────────
// Tests TheSportsDB endpoints directly (bypasses the in-memory cache).
// Shows: endpoint called, HTTP status, total events, first event, duration.

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/cn'
import { todayDate, SDB_LEAGUES, type SportsDbEvent } from '@/lib/theSportsDb'

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3'

// ── Probe helpers ──────────────────────────────────────────────────────────────

interface ProbeResult {
  endpoint:    string
  label:       string
  httpStatus:  number | null
  totalEvents: number
  leagues:     string[]
  firstEvent:  SportsDbEvent | null
  rawSample:   string          // first 300 chars of the raw JSON response
  error:       string | null
  durationMs:  number
}

async function probeEndpoint(endpoint: string, label: string): Promise<ProbeResult> {
  const url   = BASE_URL + endpoint
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(15_000),
    })
    const durationMs = Date.now() - start
    const text       = await res.text()
    const rawSample  = text.slice(0, 300)

    if (!res.ok) {
      return { endpoint, label, httpStatus: res.status, totalEvents: 0, leagues: [], firstEvent: null, rawSample, error: 'HTTP ' + res.status + ' ' + res.statusText, durationMs }
    }

    let events: SportsDbEvent[] = []
    try {
      const json = JSON.parse(text) as { events: SportsDbEvent[] | null }
      events = json.events ?? []
    } catch {
      return { endpoint, label, httpStatus: res.status, totalEvents: 0, leagues: [], firstEvent: null, rawSample, error: 'JSON parse error', durationMs }
    }

    const leagues = [...new Set(events.map(e => e.strLeague).filter(Boolean))]

    return {
      endpoint,
      label,
      httpStatus:  res.status,
      totalEvents: events.length,
      leagues,
      firstEvent:  events[0] ?? null,
      rawSample,
      error:       null,
      durationMs,
    }
  } catch (err) {
    return {
      endpoint,
      label,
      httpStatus:  null,
      totalEvents: 0,
      leagues:     [],
      firstEvent:  null,
      rawSample:   '',
      error:       err instanceof Error ? err.message : String(err),
      durationMs:  Date.now() - start,
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

type RunState = 'idle' | 'running' | 'done'

export function DiagnosticsPage() {
  const today = todayDate()

  // Endpoints to probe: eventsday (primary) + top 3 leagues
  const PROBES: { endpoint: string; label: string }[] = [
    { endpoint: '/eventsday.php?d=' + today + '&s=Soccer',  label: 'Hoje — todos os jogos de Soccer' },
    { endpoint: '/eventsnextleague.php?id=4429',            label: 'FIFA World Cup (próximos)' },
    { endpoint: '/eventsnextleague.php?id=4480',            label: 'UEFA Champions League (próximos)' },
    { endpoint: '/eventsnextleague.php?id=4328',            label: 'Premier League (próximos)' },
  ]

  const [runState, setRunState] = useState<RunState>('idle')
  const [results,  setResults]  = useState<ProbeResult[]>([])
  const [progress, setProgress] = useState(0)

  async function runDiagnostic() {
    setRunState('running')
    setResults([])
    setProgress(0)
    const out: ProbeResult[] = []
    for (let i = 0; i < PROBES.length; i++) {
      const r = await probeEndpoint(PROBES[i].endpoint, PROBES[i].label)
      out.push(r)
      setResults([...out])
      setProgress(i + 1)
    }
    setRunState('done')
  }

  const mainResult    = results[0]
  const totalAllEvents = results.reduce((s, r) => s + r.totalEvents, 0)

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar title="API Diagnóstico" subtitle="TheSportsDB — validação de dados em tempo real" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Config ─────────────────────────────────────────────────────────── */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">⚙️ Configuração</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ConfigBlock label="Fonte de dados"   value="TheSportsDB v1" />
            <ConfigBlock label="API Key"          value="Não necessária (free)" />
            <ConfigBlock label="Base URL"         value={BASE_URL} />
            <ConfigBlock label="Data testada"     value={today} />
            <ConfigBlock label="VITE_USE_MOCK"    value={import.meta.env.VITE_USE_MOCK ?? 'false'}
              bad={import.meta.env.VITE_USE_MOCK === 'true'} />
            <ConfigBlock label="Endpoint principal" value="eventsday.php?d=DATE&s=Soccer" />
          </div>
          {import.meta.env.VITE_USE_MOCK === 'true' && (
            <div className="mt-3 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg text-xs text-amber-400">
              ⚠ VITE_USE_MOCK=true — o dashboard mostra dados simulados. Defina como false para usar dados reais.
            </div>
          )}
        </div>

        {/* ── Run button ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={runDiagnostic}
            disabled={runState === 'running'}
            className={cn(
              'px-5 py-2.5 text-sm font-bold rounded-lg transition-all',
              runState === 'running'
                ? 'bg-surface-raised text-text-muted cursor-not-allowed'
                : 'bg-brand text-white hover:opacity-80',
            )}
          >
            {runState === 'running'
              ? `⏳ A testar… (${progress}/${PROBES.length})`
              : '▶ Iniciar Diagnóstico'}
          </button>

          {runState === 'done' && mainResult && (
            <span className={cn('text-sm font-semibold',
              mainResult.error          ? 'text-accent-loss'  :
              mainResult.totalEvents > 0 ? 'text-accent-win'  : 'text-amber-400'
            )}>
              {mainResult.error
                ? '❌ ' + mainResult.error
                : mainResult.totalEvents > 0
                  ? '✅ ' + mainResult.totalEvents + ' jogos encontrados hoje'
                  : '⚠ 0 jogos para ' + today}
            </span>
          )}
        </div>

        <p className="text-xs text-text-muted">
          ℹ Testa {PROBES.length} endpoints — sem limite de chamadas documentado para o free tier.
        </p>

        {/* ── Results ─────────────────────────────────────────────────────────── */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        )}

        {/* ── Summary ─────────────────────────────────────────────────────────── */}
        {runState === 'done' && results.length > 0 && (
          <div className={cn(
            'p-4 rounded-xl border text-sm leading-relaxed',
            totalAllEvents > 0
              ? 'bg-green-900/20 border-green-700/40 text-green-400'
              : 'bg-amber-900/20 border-amber-700/40 text-amber-400',
          )}>
            {totalAllEvents > 0 ? (
              <>
                <p className="font-bold mb-1">✅ TheSportsDB a responder com dados reais</p>
                <p>
                  O endpoint <code className="text-2xs bg-surface-raised/60 px-1 rounded">eventsday.php</code> devolveu
                  {' '}<strong>{mainResult?.totalEvents ?? 0} jogo(s)</strong> para hoje.
                  Se o dashboard não os mostra, verifica se VITE_USE_MOCK=false e faz refresh.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold mb-1">⚠ Sem eventos encontrados</p>
                <p>
                  Todos os endpoints devolveram 0 resultados para {today}.
                  Possíveis causas: dia sem jogos de Soccer agendados, erro de rede, ou TheSportsDB em manutenção.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── League reference ─────────────────────────────────────────────────── */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">📋 IDs de Liga (TheSportsDB)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SDB_LEAGUES.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs text-text-muted">
                <code className="text-brand font-mono">{l.id}</code>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── ResultCard ─────────────────────────────────────────────────────────────────

function ResultCard({ result: r }: { result: ProbeResult }) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-surface-border bg-surface-raised/40">
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-0.5">{r.label}</p>
          <code className="text-xs text-brand font-mono break-all">{BASE_URL + r.endpoint}</code>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0 pt-0.5">
          {r.httpStatus && (
            <span className={cn('font-mono font-bold', r.httpStatus === 200 ? 'text-accent-win' : 'text-accent-loss')}>
              {r.httpStatus}
            </span>
          )}
          <span className="text-text-muted">{r.durationMs}ms</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">

        {/* Error */}
        {r.error && (
          <div className="p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
            <p className="text-xs text-accent-loss font-mono">{r.error}</p>
          </div>
        )}

        {/* Stats */}
        {!r.error && (
          <div className="grid grid-cols-3 gap-3">
            <StatBlock
              label="Total Eventos"
              value={String(r.totalEvents)}
              accent={r.totalEvents > 0 ? 'green' : 'default'}
            />
            <StatBlock label="Ligas" value={r.leagues.length > 0 ? String(r.leagues.length) : '0'} />
            <StatBlock label="Duração" value={r.durationMs + ' ms'} />
          </div>
        )}

        {/* Leagues */}
        {r.leagues.length > 0 && (
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider mb-2">Competições devolvidas</p>
            <div className="flex flex-wrap gap-1.5">
              {r.leagues.map(l => (
                <span key={l} className="px-2 py-0.5 text-xs bg-surface-raised border border-surface-border rounded text-text-secondary">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* First event */}
        {r.firstEvent && (
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider mb-2">Primeiro evento recebido</p>
            <div className="bg-surface-raised rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                {r.firstEvent.strHomeTeamBadge && (
                  <img
                    src={r.firstEvent.strHomeTeamBadge}
                    className="w-7 h-7 object-contain rounded"
                    alt={r.firstEvent.strHomeTeam}
                  />
                )}
                <div>
                  <p className="text-sm font-bold text-text-primary">{r.firstEvent.strEvent}</p>
                  <p className="text-xs text-text-muted">{r.firstEvent.strLeague} · Temporada {r.firstEvent.strSeason}</p>
                </div>
                {r.firstEvent.strAwayTeamBadge && (
                  <img
                    src={r.firstEvent.strAwayTeamBadge}
                    className="w-7 h-7 object-contain rounded ml-auto"
                    alt={r.firstEvent.strAwayTeam}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                <Field label="ID"      value={r.firstEvent.idEvent} />
                <Field label="Data"    value={r.firstEvent.dateEvent} />
                <Field label="Hora"    value={r.firstEvent.strTime ?? '—'} />
                <Field label="Status"  value={r.firstEvent.strStatus} />
                {r.firstEvent.strVenue   && <Field label="Estádio" value={r.firstEvent.strVenue} />}
                {r.firstEvent.strCity    && <Field label="Cidade"  value={r.firstEvent.strCity} />}
                {r.firstEvent.strGroup   && <Field label="Grupo"   value={r.firstEvent.strGroup} />}
                {r.firstEvent.intRound   && <Field label="Ronda"   value={r.firstEvent.intRound} />}
                {r.firstEvent.intHomeScore != null && (
                  <Field label="Resultado" value={(r.firstEvent.intHomeScore ?? '?') + ' – ' + (r.firstEvent.intAwayScore ?? '?')} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* No events */}
        {!r.error && r.totalEvents === 0 && (
          <p className="text-sm text-text-muted italic">Sem eventos para este endpoint / data.</p>
        )}

        {/* Raw response toggle */}
        {r.rawSample && (
          <div>
            <button
              onClick={() => setShowRaw(v => !v)}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              {showRaw ? '▲ Esconder resposta raw' : '▼ Ver resposta raw (primeiros 300 chars)'}
            </button>
            {showRaw && (
              <pre className="mt-2 p-3 bg-surface-raised rounded-lg text-2xs text-text-muted font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {r.rawSample}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function ConfigBlock({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="bg-surface-raised rounded-lg p-3">
      <p className="text-2xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-xs font-mono font-bold truncate', bad ? 'text-accent-loss' : 'text-text-primary')}>{value}</p>
    </div>
  )
}

function StatBlock({ label, value, accent = 'default' }: { label: string; value: string; accent?: 'default' | 'green' }) {
  return (
    <div className="bg-surface-raised rounded-lg p-3 text-center">
      <p className="text-2xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-xl font-black font-mono', accent === 'green' ? 'text-accent-win' : 'text-text-primary')}>
        {value}
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-muted">{label}: </span>
      <span className="text-text-secondary font-mono">{value}</span>
    </div>
  )
}
