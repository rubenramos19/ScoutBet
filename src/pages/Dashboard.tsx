import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { GameCard } from '@/components/game/GameCard'
import { MultipleCard } from '@/components/bets/MultipleCard'
import { KPICard } from '@/components/performance/KPICard'
import { useGameStore } from '@/store/useGameStore'
import { useBankrollStore } from '@/store/useBankrollStore'
import { formatCents, formatPctNum } from '@/lib/format'

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-PT', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function Dashboard() {
  const {
    games, multiples,
    isLoadingGames, fetchTodayGames, fetchMultiples,
    noGamesReason, analyzedLeagues, autoDiscovery, gamesDate,
  } = useGameStore()
  const { config, stats, fetchAll } = useBankrollStore()

  useEffect(() => {
    fetchTodayGames()
    fetchMultiples()
    fetchAll()
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const isFutureDate = gamesDate != null && gamesDate !== today

  const raspadinha = multiples.find(m => m.strategy === 'RASPADINHA')
  const regularMultiples = multiples.filter(m => m.strategy !== 'RASPADINHA')

  const topBarSubtitle =
    games.length > 0 && isFutureDate
      ? `${games.length} jogos em destaque · ${fmtDate(gamesDate!)}`
      : `${games.length} jogos em destaque hoje`

  const sectionHeading = autoDiscovery
    ? '🔍 Jogos Encontrados por Auto-Discovery'
    : isFutureDate
      ? `⚡ Top 5 Jogos · ${new Date(gamesDate! + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}`
      : '⚡ Top 5 Jogos de Hoje'

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Dashboard"
        subtitle={topBarSubtitle}
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
              {sectionHeading}
            </h2>
            {isLoadingGames ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-52 bg-surface-card border border-surface-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : games.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {games.map(game => (
                  <div key={game.id} className="relative">
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center border border-dashed border-surface-border rounded-xl bg-surface-card">
                <span className="text-4xl">&#x1F4C5;</span>
                <div className="space-y-1">
                  <p className="text-text-primary font-semibold text-base">
                    Sem jogos agendados
                  </p>
                  <p className="text-text-muted text-sm">
                    {new Date().toLocaleDateString('pt-PT', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
                {noGamesReason && (
                  <p className="text-text-muted text-sm max-w-sm leading-relaxed">
                    {noGamesReason}
                  </p>
                )}
                {analyzedLeagues.length > 0 && (
                  <div className="text-xs text-text-muted max-w-md">
                    <p className="font-semibold mb-1 uppercase tracking-wider">
                      Competições analisadas
                    </p>
                    <p className="leading-relaxed">{analyzedLeagues.join(' · ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: combinadas + raspadinha */}
        <aside className="w-[340px] shrink-0 border-l border-surface-border overflow-y-auto p-5 space-y-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Combinadas do Dia
          </h2>

          {regularMultiples.length > 0 ? (
            regularMultiples.map(m => (
              <MultipleCard key={m.id} multiple={m} />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">&#x1F517;</span>
              <p className="text-text-muted text-xs leading-relaxed">
                Sem combinadas disponíveis.
                <br />
                Requer jogos reais detectados.
              </p>
            </div>
          )}

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
