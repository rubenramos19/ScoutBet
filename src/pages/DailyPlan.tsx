import { useEffect } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { KPICard } from '@/components/performance/KPICard'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { OddBadge } from '@/components/ui/OddBadge'
import { ConfidenceBar } from '@/components/ui/ConfidenceBar'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { useBankrollStore } from '@/store/useBankrollStore'

export function DailyPlan() {
  const { dailyPlan, config, isLoading, fetchAll, acceptPlan } = useBankrollStore()

  useEffect(() => { fetchAll() }, [])

  const usedPct = dailyPlan
    ? (dailyPlan.totalAllocatedCents / dailyPlan.dailyBudgetCents) * 100
    : 0

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Plano Diário"
        subtitle={dailyPlan?.date ?? 'Hoje'}
        onRefresh={fetchAll}
        isRefreshing={isLoading}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Budget overview */}
        {dailyPlan && config && (
          <div className="grid grid-cols-3 gap-3">
            <KPICard
              label="Orçamento do Dia"
              value={formatCents(dailyPlan.dailyBudgetCents)}
              note={`${((dailyPlan.dailyBudgetCents / config.currentAmountCents) * 100).toFixed(0)}% da banca`}
              accent="default"
            />
            <KPICard
              label="Alocado"
              value={formatCents(dailyPlan.totalAllocatedCents)}
              delta={`${usedPct.toFixed(0)}% do orçamento`}
              accent={usedPct > 90 ? 'amber' : 'green'}
            />
            <KPICard
              label="Retorno se Ganhar Tudo"
              value={formatCents(dailyPlan.projectedReturnCents + dailyPlan.totalAllocatedCents)}
              delta={`+${formatCents(dailyPlan.projectedReturnCents)} de lucro`}
              accent="green"
            />
          </div>
        )}

        {/* Budget bar */}
        {dailyPlan && (
          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className="flex justify-between text-xs text-text-muted mb-2">
              <span>Orçamento usado</span>
              <span className="font-mono">{formatCents(dailyPlan.totalAllocatedCents)} / {formatCents(dailyPlan.dailyBudgetCents)}</span>
            </div>
            <div className="h-3 bg-surface-raised rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', usedPct > 90 ? 'bg-accent-draw' : 'bg-brand')}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bet list */}
        {dailyPlan && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">🎯 Apostas Sugeridas</h3>
                {dailyPlan.status === 'ACCEPTED' && (
                  <span className="flex items-center gap-1 text-xs text-accent-win font-bold">
                    <CheckCircle2 size={13} /> Plano Aceite
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {dailyPlan.bets.map((bet, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-surface-raised rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-text-primary truncate">{bet.pick}</p>
                        <OddBadge odd={bet.odd} size="sm" />
                      </div>
                      <p className="text-xs text-text-muted mb-2">{bet.gameLabel} · {bet.market}</p>
                      <ConfidenceBar value={bet.confidence} size="sm" className="max-w-40" />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-text-muted mb-0.5">Stake</p>
                      <p className="text-sm font-black text-text-primary font-mono">{formatCents(bet.suggestedStakeCents)}</p>
                      <p className="text-xs text-accent-win font-mono">→ {formatCents(bet.potentialReturnCents)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>

            {dailyPlan.status === 'PROPOSED' && (
              <CardFooter className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Flat staking {config ? `${(config.flatStakePct * 100).toFixed(1)}%` : ''} · Kelly na Sprint 7
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">Ajustar Stakes</Button>
                  <Button variant="primary" size="sm" onClick={acceptPlan}>Aceitar Plano</Button>
                </div>
              </CardFooter>
            )}
          </Card>
        )}

        {/* Raspadinha */}
        {dailyPlan?.raspadinha && (
          <Card className="border-purple-800/40">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">🎰 Raspadinha do Dia</h3>
                <span className="text-2xs px-2 py-1 rounded bg-purple-900/40 border border-purple-700/30 text-purple-400 font-bold">ALTO RISCO</span>
              </div>

              {/* Selections */}
              <div className="space-y-2 mb-4">
                {dailyPlan.raspadinha.selections.map((sel, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface-raised rounded-lg px-3 py-2">
                    <span className="text-2xs font-black text-purple-500 w-4">{i+1}</span>
                    <p className="flex-1 text-xs text-text-secondary">{sel.gameLabel}</p>
                    <p className="text-xs font-bold text-text-primary">{sel.pick}</p>
                    <span className="text-xs font-mono text-accent-draw">{sel.odd.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 mb-3">
                <div>
                  <p className="text-2xs text-text-muted">Odd Total</p>
                  <p className="text-xl font-black text-accent-draw font-mono">{dailyPlan.raspadinha.totalOdd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-2xs text-text-muted">Stake (1% máx)</p>
                  <p className="text-base font-black text-text-primary font-mono">{formatCents(dailyPlan.raspadinha.stakeCents)}</p>
                </div>
                <div>
                  <p className="text-2xs text-text-muted">Retorno potencial</p>
                  <p className="text-base font-black text-accent-win font-mono">{formatCents(dailyPlan.raspadinha.potentialReturnCents)}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-text-muted leading-relaxed">
                  Capital de diversão — probabilidade baixa esperada. Stake isolada e orçamentada. Não afecta o plano principal.
                </p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
