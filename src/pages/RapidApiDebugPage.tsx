// ─── API Probe ────────────────────────────────────────────────────────────────
// Route: /debug-rapidapi

import { useState } from 'react'
import { apiCache } from '@/lib/cache'

const TODAY       = new Date().toISOString().slice(0, 10)
const TODAY_ESPN  = TODAY.replace(/-/g, '')

function getAFKey()    { return import.meta.env.VITE_API_FOOTBALL_KEY ?? '' }
function getFDToken()  { return import.meta.env.VITE_FOOTBALL_DATA_TOKEN ?? '' }
function getRapidKey() { return import.meta.env.VITE_RAPIDAPI_KEY ?? '' }

// Known IDs from WC 2026 group stage (scoreboard 2026-06-25)
// ESPN team schedule endpoint is the main stats source for WC 2026
const SAMPLE_EVENT_ID = '760473'  // Ivory Coast vs Curacao 2026-06-25
const SAMPLE_TEAM_ID  = '11678'   // Curacao

const CANDIDATES = [
  // ESPN — primary source (no key, CORS open)
  {
    label: 'ESPN: WC scoreboard hoje',
    url: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${TODAY_ESPN}`,
    headers: (): Record<string, string> => ({}),
  },
  {
    label: 'ESPN: team schedule (Curacao, 2026) -- goals/BTTS source',
    url: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${SAMPLE_TEAM_ID}/schedule?season=2026`,
    headers: (): Record<string, string> => ({}),
  },
  {
    label: 'ESPN: event summary (boxscore stats)',
    url: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${SAMPLE_EVENT_ID}`,
    headers: (): Record<string, string> => ({}),
  },
  // api-sports — blocked for season 2026 on free plan
  {
    label: 'AF: WC fixtures season=2026 (free bloqueado)',
    url: `/api/apisports/fixtures?league=1&season=2026&date=${TODAY}`,
    headers: (): Record<string, string> => ({}),
  },
  // SofaScore direct — CORS blocked by Cloudflare
  {
    label: 'Sofa DIRECTO: scheduled-events hoje',
    url: `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${TODAY}`,
    headers: (): Record<string, string> => ({ Accept: 'application/json' }),
  },
]

interface ProbeResult {
  label:     string
  url:       string
  status:    number | null
  ok:        boolean
  topKeys:   string[]
  snippet:   string
  ms:        number
  error:     string | null
  itemCount: number | null
}

async function probe(
  label:   string,
  url:     string,
  headers: Record<string, string>,
): Promise<ProbeResult> {
  const t0 = Date.now()
  try {
    const res  = await fetch(url, { headers })
    const ms   = Date.now() - t0
    const text = await res.text().catch(() => '')
    let topKeys:   string[]      = []
    let itemCount: number | null = null
    try {
      const json = JSON.parse(text)
      topKeys = Object.keys(json)
      if (typeof json.results === 'number') {
        itemCount = json.results
      } else if (Array.isArray(json.events)) {
        itemCount = json.events.length
      } else if (Array.isArray(json.matches)) {
        itemCount = json.matches.length
      } else if (Array.isArray(json.response)) {
        itemCount = json.response.length
      } else if (json.boxscore && Array.isArray(json.boxscore.teams)) {
        itemCount = json.boxscore.teams.length
      } else if (json.team) {
        itemCount = Array.isArray(json.events) ? json.events.length : 1
      }
    } catch (_) {}
    return { label, url, status: res.status, ok: res.ok, topKeys, snippet: text.slice(0, 5000), ms, error: null, itemCount }
  } catch (err) {
    return { label, url, status: null, ok: false, topKeys: [], snippet: '', ms: Date.now() - t0, error: String(err), itemCount: null }
  }
}

function StatusBadge({ r }: { r: ProbeResult }) {
  if (r.error) return <span className="text-xs font-mono font-bold text-accent-loss">ERR</span>
  const color = r.ok ? 'text-accent-win' : 'text-accent-loss'
  return <span className={`text-xs font-mono font-bold ${color}`}>{r.status}</span>
}

export function RapidApiDebugPage() {
  const [results,      setResults]      = useState<ProbeResult[]>([])
  const [running,      setRunning]      = useState(false)
  const [selected,     setSelected]     = useState<ProbeResult | null>(null)
  const [cacheCleared, setCacheCleared] = useState(false)

  async function runAll() {
    setRunning(true)
    setResults([])
    setSelected(null)
    const out: ProbeResult[] = []
    for (const c of CANDIDATES) {
      const r = await probe(c.label, c.url, c.headers())
      out.push(r)
      setResults([...out])
      await new Promise(res => setTimeout(res, 300))
    }
    setRunning(false)
  }

  function clearCache() {
    apiCache.clear()
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 3000)
  }

  const afKey    = getAFKey()
  const fdToken  = getFDToken()
  const rapidKey = getRapidKey()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-text-primary">API Probe</h1>
          <p className="text-xs text-text-muted">
            ESPN (scoreboard + schedule + summary) + api-sports + SofaScore &middot; {TODAY}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearCache}
            className="px-3 py-2 border border-surface-border text-text-muted text-sm rounded-lg hover:text-text-primary"
          >
            {cacheCleared ? 'Cache limpo' : 'Limpar Cache'}
          </button>
          <button
            onClick={runAll}
            disabled={running}
            className="px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg disabled:opacity-40"
          >
            {running ? `A testar... (${results.length}/${CANDIDATES.length})` : 'Testar Endpoints'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-3 border ${afKey ? 'bg-accent-winBg border-accent-win/20' : 'bg-accent-lossBg border-accent-loss/20'}`}>
          <p className="text-xs font-bold text-text-primary">api-sports</p>
          <p className="text-xs font-mono text-text-muted mt-1">
            {afKey ? `Key: ${afKey.slice(0, 8)}... (${afKey.length} chars)` : 'VITE_API_FOOTBALL_KEY nao def.'}
          </p>
        </div>
        <div className={`rounded-xl p-3 border ${fdToken ? 'bg-accent-winBg border-accent-win/20' : 'bg-surface-card border-surface-border'}`}>
          <p className="text-xs font-bold text-text-muted">Football-Data.org</p>
          <p className="text-xs font-mono text-text-muted mt-1">
            {fdToken ? `Token: ${fdToken.slice(0, 8)}...` : 'Nao configurado'}
          </p>
        </div>
        <div className="rounded-xl p-3 border bg-surface-card border-surface-border">
          <p className="text-xs font-bold text-text-muted">SofaScore RapidAPI</p>
          <p className="text-xs font-mono text-text-muted mt-1">
            {rapidKey ? `Key: ${rapidKey.slice(0, 6)}...${rapidKey.slice(-4)}` : 'Nao configurado'}
          </p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised text-text-muted text-left">
                <th className="px-4 py-2 font-medium">Endpoint</th>
                <th className="px-4 py-2 font-medium w-16">Status</th>
                <th className="px-4 py-2 font-medium w-16">Items</th>
                <th className="px-4 py-2 font-medium w-16">ms</th>
                <th className="px-4 py-2 font-medium">Chaves JSON</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(r)}
                  className={`border-b border-surface-border/40 cursor-pointer hover:bg-surface-raised ${r.ok ? 'bg-accent-winBg/20' : ''}`}
                >
                  <td className="px-4 py-2 font-mono text-text-secondary">{r.label}</td>
                  <td className="px-4 py-2"><StatusBadge r={r} /></td>
                  <td className="px-4 py-2 font-mono font-bold">
                    {r.itemCount != null
                      ? <span className={r.itemCount > 0 ? 'text-accent-win' : 'text-text-muted'}>{r.itemCount}</span>
                      : <span className="text-text-muted">--</span>
                    }
                  </td>
                  <td className="px-4 py-2 font-mono text-text-muted">{r.ms}</td>
                  <td className="px-4 py-2 text-text-muted truncate max-w-xs">
                    {r.topKeys.join(', ') || r.error || 'n/a'}
                  </td>
                </tr>
              ))}
              {running && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs text-text-muted animate-pulse">
                    A testar...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-primary">{selected.label}</p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              X
            </button>
          </div>
          <code className="text-xs font-mono text-brand break-all block bg-surface-raised px-2 py-1 rounded">
            {selected.url}
          </code>
          <div className="flex gap-3 flex-wrap">
            <span className={`text-xs font-bold font-mono ${selected.ok ? 'text-accent-win' : 'text-accent-loss'}`}>
              HTTP {selected.status}
            </span>
            <span className="text-xs text-text-muted">{selected.ms}ms</span>
            {selected.itemCount != null && (
              <span className="text-xs font-bold text-accent-win">{selected.itemCount} items</span>
            )}
          </div>
          <pre className="text-xs font-mono text-text-secondary bg-surface-raised rounded-lg p-3 whitespace-pre-wrap break-all overflow-x-auto max-h-96 overflow-y-auto">
            {selected.snippet || '(sem resposta)'}
          </pre>
        </div>
      )}

      {!running && results.length === 0 && (
        <div className="py-12 text-center text-text-muted">
          <p className="text-sm">Clica em Testar Endpoints para testar as fontes.</p>
          <p className="text-xs mt-1 text-text-muted">
            ESPN team schedule = fonte de goals/BTTS/over2.5 para WC 2026
          </p>
        </div>
      )}
    </div>
  )
}
