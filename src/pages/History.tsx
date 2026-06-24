import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { MarketTable } from '@/components/performance/MarketTable'
import { KPICard } from '@/components/performance/KPICard'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { formatDate, formatTime, formatCents, outcomeDisplay } from '@/lib/format'
import { betService } from '@/services/betService'
import type { HistoryEntry, MarketPerformance } from '@/types'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIOD_TABS = [
  { key: '7d'  as const, label: '7 Dias' },
  { key: '30d' as const, label: '30 Dias' },
  { key: '90d' as const, label: '90 Dias' },
  { key: 'all' as const, label: 'Tudo' },
]

const marketLabels: Record<string, string> = {
  BTTS: 'BTTS', OVER_25: 'Over 2.5', '1X2': '1X2', DOUBLE_CHANCE: 'DC', MULTIPLE: 'Multi',
}

export function History() {
  const [period, setPeriod] = useState<Period>('30d')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [marketData, setMarketData] = useState<MarketPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'markets'>('list')

  useEffect(() => {
    setLoading(true)
    Promise.all([betService.getHistory(period), betService.getMarketPerformance()])
      .then(([h, m]) => { setHistory(h); setMarketData(m) })
      .finally(() => setLoading(false))
  }, [period])

  const settled   = history.filter(h => h.outcome !== 'VOID')
  const wins      = history.filter(h => h.outcome === 'WIN').length
  const losses    = history.filter(h => h.outcome === 'LOSS').length
  const voids     = history.filter(h => h.outcome === 'VOID').length
  const accuracy  = settled.length ? wins / settled.length : 0
  const withStake = history.filter(h => h.stakeEuroCents !== null)
  const totalPL   = withStake.reduce((s, h) => s + (h.profitLossEuroCents ?? 0), 0)
  const totalStake= withStake.reduce((s, h) => s + (h.stakeEuroCents ?? 0), 0)
  const roi       = totalStake > 0 ? (totalPL / totalStake) * 100 : null

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Histórico"
        subtitle={`${history.length} previsões no período`}
        actions={
          <div className="flex gap-1 bg-surface-card border border-surface-border rounded-lg p-0.5">
            {(['list', 'markets'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 text-xs font-semibold rounded transition-colors', v === view ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary')}>
                {v === 'list' ? 'Lista' : 'Por Mercado'}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Period selector */}
        <Tabs tabs={PERIOD_TABS} active={period} onChange={setPeriod} className="w-fit" />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Taxa de Acerto"
            value={`${(accuracy * 100).toFixed(1)}%`}
            delta={`${wins}V · ${losses}L · ${voids}VOID`}
            accent={accuracy >= 0.6 ? 'green' : accuracy >= 0.5 ? 'amber' : 'red'}
          />
          <KPICard label="Total Previsões" value={String(history.length)} accent="default" />
          <KPICard
            label="ROI"
            value={roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : 'Sem stakes'}
            delta={roi !== null ? 'Com stakes reais registadas' : 'Regista uma aposta real para ver ROI'}
            accent={roi === null ? 'default' : roi >= 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Lucro / Prejuízo"
            value={totalStake > 0 ? formatCents(totalPL) : '—'}
            accent={totalPL >= 0 ? 'green' : 'red'}
            note={totalStake > 0 ? `de ${formatCents(totalStake)} apostados` : 'Sem stakes reais'}
          />
        </div>

        {/* Content */}
        {view === 'markets' ? (
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Performance por Mercado</h3>
            <MarketTable data={marketData} />
          </div>
        ) : (
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 text-2xs font-bold text-text-muted uppercase tracking-wider border-b border-surface-border">
              {['Data', 'Jogo / Aposta', 'Mercado', 'Resultado', 'P&L'].map(h => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.map((entry, i) => {
              const od = outcomeDisplay(entry.outcome)
              return (
                <div key={entry.id}
                  className={cn('grid grid-cols-[auto_1fr_auto_auto_auto] items-center border-b border-surface-border/50 hover:bg-surface-raised/50 transition-colors', i % 2 === 0 ? '' : 'bg-surface-raised/20')}>
                  <div className="px-4 py-3.5 text-xs text-text-muted whitespace-nowrap">
                    <p>{formatDate(entry.date)}</p>
                    <p className="font-mono text-2xs">{formatTime(entry.date)}</p>
                  </div>
                  <div className="px-4 py-3.5 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{entry.pick}</p>
                    <p className="text-2xs text-text-muted truncate">{entry.gameLabel}</p>
                    {entry.oddPlaced === null && (
                      <span className="text-2xs text-text-muted italic">Previsão em papel</span>
                    )}
                  </div>
                  <div className="px-4 py-3.5">
                    <Badge variant="blue" size="sm">{marketLabels[entry.market] ?? entry.market}</Badge>
                  </div>
                  <div className="px-4 py-3.5">
                    <span className={cn('text-xs font-bold px-2 py-1 rounded', od.bgClass, od.textClass)}>
                      {od.label}
                    </span>
                  </div>
                  <div className={cn('px-4 py-3.5 text-right font-bold font-mono text-sm tabular-nums',
                    entry.profitLossEuroCents === null ? 'text-text-muted' :
                    entry.profitLossEuroCents >= 0 ? 'text-accent-win' : 'text-accent-loss')}>
                    {entry.profitLossEuroCents === null ? '—' :
                     (entry.profitLossEuroCents >= 0 ? '+' : '') + formatCents(entry.profitLossEuroCents)}
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
