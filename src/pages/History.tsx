import { useEffect, useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { MarketTable } from '@/components/performance/MarketTable'
import { KPICard } from '@/components/performance/KPICard'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { formatDate, formatTime, formatCents, outcomeDisplay } from '@/lib/format'
import { betService } from '@/services/betService'
import type { SavedPick } from '@/services/betService'
import type { MarketPerformance } from '@/types'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIOD_TABS = [
  { key: '7d'  as const, label: '7 Dias' },
  { key: '30d' as const, label: '30 Dias' },
  { key: '90d' as const, label: '90 Dias' },
  { key: 'all' as const, label: 'Tudo' },
]

const marketLabels: Record<string, string> = {
  BTTS: 'BTTS', OVER_25: 'Over 2.5', '1X2': '1X2',
  DOUBLE_CHANCE: 'DC', MULTIPLE: 'Multi',
}

// ── Result + delete buttons ───────────────────────────────────────────────────

function RowActions({
  pick,
  onSettle,
  onDelete,
}: {
  pick: SavedPick
  onSettle: () => void
  onDelete: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function settle(outcome: 'WIN' | 'LOSS' | 'VOID') {
    setLoading(outcome)
    let pl: number | null = null
    if (outcome === 'WIN' && pick.stakeEuroCents) {
      pl = Math.round(pick.stakeEuroCents * pick.oddPredicted - pick.stakeEuroCents)
    } else if (outcome === 'LOSS' && pick.stakeEuroCents) {
      pl = -pick.stakeEuroCents
    }
    await betService.settlePick(pick.id, outcome, pl)
    setLoading(null)
    onSettle()
  }

  async function handleDelete() {
    if (!confirm('Apagar esta aposta do histórico?')) return
    await betService.deletePick(pick.id)
    onDelete()
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {pick.status === 'PENDING' && (
        <>
          <button
            onClick={() => settle('WIN')}
            disabled={loading !== null}
            className="px-2 py-1 text-2xs font-bold rounded bg-accent-winBg text-accent-win hover:bg-accent-win/20 border border-accent-win/20 transition-colors disabled:opacity-50"
          >
            {loading === 'WIN' ? '…' : '✓ Ganhou'}
          </button>
          <button
            onClick={() => settle('LOSS')}
            disabled={loading !== null}
            className="px-2 py-1 text-2xs font-bold rounded bg-accent-lossBg text-accent-loss hover:bg-accent-loss/20 border border-accent-loss/20 transition-colors disabled:opacity-50"
          >
            {loading === 'LOSS' ? '…' : '✗ Perdeu'}
          </button>
          <button
            onClick={() => settle('VOID')}
            disabled={loading !== null}
            className="px-2 py-1 text-2xs font-bold rounded bg-surface-raised text-text-muted hover:text-text-primary border border-surface-border transition-colors disabled:opacity-50"
          >
            {loading === 'VOID' ? '…' : 'Void'}
          </button>
        </>
      )}
      <button
        onClick={handleDelete}
        title="Apagar"
        className="p-1 rounded text-text-muted hover:text-accent-loss hover:bg-accent-lossBg transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function History() {
  const [period,     setPeriod]     = useState<Period>('30d')
  const [picks,      setPicks]      = useState<SavedPick[]>([])
  const [marketData, setMarketData] = useState<MarketPerformance[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<'list' | 'markets'>('list')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [all, md] = await Promise.all([
      betService.loadAll(),
      betService.getMarketPerformance(),
    ])
    let cutoff: string | null = null
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const d = new Date(); d.setDate(d.getDate() - days)
      cutoff = d.toISOString()
    }
    const filtered = cutoff ? all.filter(p => p.savedAt >= cutoff!) : all
    // Newest first
    filtered.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    setPicks(filtered)
    setMarketData(md)
    setLoading(false)
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const settled  = picks.filter(p => p.status !== 'PENDING')
  const wins     = picks.filter(p => p.status === 'WIN').length
  const losses   = picks.filter(p => p.status === 'LOSS').length
  const pending  = picks.filter(p => p.status === 'PENDING').length
  const accuracy = settled.length > 0 ? wins / settled.length : 0
  const withStake  = settled.filter(p => p.stakeEuroCents != null)
  const totalPL    = withStake.reduce((s, p) => s + (p.profitLossEuroCents ?? 0), 0)
  const totalStake = withStake.reduce((s, p) => s + (p.stakeEuroCents ?? 0), 0)
  const roi        = totalStake > 0 ? (totalPL / totalStake) * 100 : null

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Histórico"
        subtitle={`${picks.length} apostas${pending > 0 ? ` · ${pending} pendentes` : ''}`}
        actions={
          <div className="flex gap-1 bg-surface-card border border-surface-border rounded-lg p-0.5">
            {(['list', 'markets'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded transition-colors',
                  v === view ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary',
                )}>
                {v === 'list' ? 'Lista' : 'Por Mercado'}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <Tabs tabs={PERIOD_TABS} active={period} onChange={setPeriod} className="w-fit" />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Taxa de Acerto"
            value={settled.length > 0 ? `${(accuracy * 100).toFixed(1)}%` : '—'}
            delta={`${wins}V · ${losses}D${pending > 0 ? ` · ${pending} Pend.` : ''}`}
            accent={accuracy >= 0.6 ? 'green' : accuracy >= 0.5 ? 'amber' : 'red'}
          />
          <KPICard label="Total Guardadas" value={String(picks.length)} accent="default" />
          <KPICard
            label="ROI"
            value={roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
            delta={roi !== null ? 'Com stakes registadas' : 'Sem stakes definidas'}
            accent={roi === null ? 'default' : roi >= 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Lucro / Prejuízo"
            value={totalStake > 0 ? formatCents(totalPL) : '—'}
            accent={totalPL >= 0 ? 'green' : 'red'}
            note={totalStake > 0 ? `de ${formatCents(totalStake)} apostados` : 'Sem stakes reais'}
          />
        </div>

        {view === 'markets' ? (
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">
              Performance por Mercado
            </h3>
            <MarketTable data={marketData} />
          </div>
        ) : (
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[90px_1fr_90px_90px_80px] text-2xs font-bold text-text-muted uppercase tracking-wider border-b border-surface-border">
              {['Data', 'Jogo / Aposta', 'Mercado', 'Resultado', 'P&L'].map(h => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : picks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="text-3xl">📊</span>
                <p className="text-text-primary font-semibold text-sm">Sem apostas guardadas</p>
                <p className="text-text-muted text-xs max-w-xs leading-relaxed">
                  Clica em <strong>Guardar</strong> numa aposta recomendada para registar o teu historial.
                </p>
              </div>
            ) : picks.map((pick, i) => {
              const isPending = pick.status === 'PENDING'
              const od = !isPending
                ? outcomeDisplay(pick.status === 'WIN' ? 'WIN' : pick.status === 'LOSS' ? 'LOSS' : 'VOID')
                : null

              return (
                <div key={pick.id}
                  className={cn(
                    'grid grid-cols-[90px_1fr_90px_90px_80px] items-start border-b border-surface-border/50',
                    i % 2 !== 0 && 'bg-surface-raised/20',
                    isPending && 'bg-amber-900/10',
                  )}>

                  {/* Date */}
                  <div className="px-4 py-3.5 text-xs text-text-muted whitespace-nowrap">
                    <p>{formatDate(pick.savedAt)}</p>
                    <p className="font-mono text-2xs">{formatTime(pick.savedAt)}</p>
                  </div>

                  {/* Game + pick */}
                  <div className="px-4 py-3.5 min-w-0">
                    {pick.market === 'MULTIPLE' && pick.legs && pick.legs.length > 0 ? (
                      <>
                        <p className="text-xs font-bold text-text-primary mb-1.5">
                          Múltipla · @{pick.oddPredicted.toFixed(2)}
                          {pick.stakeEuroCents && (
                            <span className="ml-2 text-2xs font-normal text-text-muted">stake {formatCents(pick.stakeEuroCents)}</span>
                          )}
                        </p>
                        <div className="space-y-1">
                          {pick.legs.map((leg, li) => (
                            <div key={li} className="flex items-center gap-2 text-2xs">
                              <span className="w-4 h-4 rounded-full bg-surface-raised text-text-muted flex items-center justify-center shrink-0 font-bold text-[10px]">
                                {li + 1}
                              </span>
                              <span className="text-text-secondary font-medium truncate">{leg.gameLabel}</span>
                              <span className="text-text-muted shrink-0">·</span>
                              <span className="text-text-primary shrink-0">{leg.pick}</span>
                              <span className="ml-auto text-brand font-mono shrink-0">@{leg.odd.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-text-primary truncate">{pick.pick}</p>
                        <p className="text-2xs text-text-muted truncate">{pick.gameLabel}</p>
                        <p className="text-2xs text-text-muted font-mono">@{pick.oddPredicted.toFixed(2)}</p>
                        {pick.stakeEuroCents && (
                          <p className="text-2xs text-text-muted font-mono">Stake: {formatCents(pick.stakeEuroCents)}</p>
                        )}
                      </>
                    )}
                    <RowActions pick={pick} onSettle={loadData} onDelete={loadData} />
                  </div>

                  {/* Market */}
                  <div className="px-4 py-3.5">
                    <Badge variant="blue" size="sm">{marketLabels[pick.market] ?? pick.market}</Badge>
                  </div>

                  {/* Outcome */}
                  <div className="px-4 py-3.5">
                    {isPending ? (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30">
                        PEND
                      </span>
                    ) : (
                      <span className={cn('text-xs font-bold px-2 py-1 rounded', od!.bgClass, od!.textClass)}>
                        {od!.label}
                      </span>
                    )}
                  </div>

                  {/* P&L */}
                  <div className={cn(
                    'px-4 py-3.5 text-right font-bold font-mono text-sm tabular-nums',
                    pick.profitLossEuroCents == null ? 'text-text-muted'
                      : pick.profitLossEuroCents >= 0 ? 'text-accent-win' : 'text-accent-loss',
                  )}>
                    {pick.profitLossEuroCents == null ? '—'
                      : (pick.profitLossEuroCents >= 0 ? '+' : '') + formatCents(pick.profitLossEuroCents)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
