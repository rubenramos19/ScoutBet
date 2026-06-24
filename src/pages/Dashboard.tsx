import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { GameCard } from '@/components/game/GameCard'
import { MultipleCard } from '@/components/bets/MultipleCard'
import { KPICard } from '@/components/performance/KPICard'
import { useGameStore } from '@/store/useGameStore'
import { useBankrollStore } from '@/store/useBankrollStore'
import { formatCents, formatPctNum } from '@/lib/format'

export function Dashboard() {
  const { games, multiples, isLoadingGames, fetchTodayGames, fetchMultiples } = useGameStore()
  const { config, stats, fetchAll } = useBankrollStore()

  useEffect(() => {
    fetchTodayGames()
    fetchMultiples()
    fetchAll()
  }, [])

  const raspadinha = multiples.find(m => m.strategy === 'RASPADINHA')
  const regularMultiples = multiples.filter(m => m.strategy !== 'RASPADINHA')

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Dashboard"
        subtitle={`${games.length} jogos em destaque hoje`}
        onRefresh={fetchTodayGames}
        isRefreshing={isLoadingGames}
      />

      <div className="flex-1 flex min-h-0">
        {/* Main feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mini KPIs */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <KPICard
                label="Taxa de Acerto (30d)"
                value={formatPctNum(stats.accuracyRate * 100, 1)}
                delta="+3.1% vs mês anterior"
                trend="up"
                accent={stats.accuracyRate >= 0.6 ? 'green' : 'amber'}
              />
              <KPICard
                label="ROI (30d)"
                value={`+${stats.roi?.toFixed(1)}%`}
                delta={`${stats.wins}V · ${stats.losses}L`}
                trend="up"
                accent="green"
              />
              <KPICard
                label="Banca Actual"
                value={config ? formatCents(config.currentAmountCents) : '—'}
                delta={config ? `+${formatCents(config.currentAmountCents - config.initialAmountCents)} desde início` : ''}
                trend="up"
                accent="green"
              />
            </div>
          )}

          {/* Games */}
          <div>
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">
              ⚡ Top 5 Jogos de Hoje
            </h2>
            {isLoadingGames ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-52 bg-surface-card border border-surface-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {games.map(game => (
                  <div key={game.id} className="relative">
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: combinadas + raspadinha */}
        <aside className="w-[340px] shrink-0 border-l border-surface-border overflow-y-auto p-5 space-y-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            🔗 Combinadas do Dia
          </h2>
          {regularMultiples.map(m => (
            <MultipleCard key={m.id} multiple={m} />
          ))}

          {raspadinha && (
            <div>
              <div className="flex items-center gap-2 my-4">
                <div className="h-px flex-1 bg-surface-border" />
                <span className="text-xs text-text-muted font-bold">RASPADINHA</span>
                <div className="h-px flex-1 bg-surface-border" />
              </div>
              <MultipleCard multiple={raspadinha} />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
