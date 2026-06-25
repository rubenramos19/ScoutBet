// ─── Plano Diário ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Shuffle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { KPICard } from '@/components/performance/KPICard'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { OddBadge } from '@/components/ui/OddBadge'
import { ConfidenceBar } from '@/components/ui/ConfidenceBar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatCents, formatTime } from '@/lib/format'
import { useBankrollStore } from '@/store/useBankrollStore'
import { useGameStore } from '@/store/useGameStore'
import { bankrollService } from '@/services/bankrollService'
import { betService } from '@/services/betService'
// ruleBasedConfidence removed — market picker now uses raw stats directly
import type { BankrollConfig, Game } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RaspadinhaSelection {
  gameLabel:  string
  homeTeam:   string
  awayTeam:   string
  kickoff:    string
  market:     string
  pick:       string
  odd:        number
}

interface PlanBet {
  game:         Game
  market:       string
  pick:         string
  odd:          number
  confidence:   number
  reasoning:    string
  stakeCents:   number
  returnCents:  number
  isSaved:      boolean
  isRaspadinha: boolean
  /** Only set when isRaspadinha=true — full breakdown of each leg */
  raspadinhaLegs?: RaspadinhaSelection[]
}

// ── Best pick per game ────────────────────────────────────────────────────────

function bestPickForGame(game: Game): { market: string; pick: string; odd: number; confidence: number } | null {
  const { bttsPct, over25Pct, homeWinPct, avgGoals } = game.stats

  // Only suggest a market when we have real data backing it (not the 50 default)
  const candidates: Array<{ market: string; pick: string; odd: number; confidence: number }> = []

  if (over25Pct != null) {
    candidates.push({ market: 'OVER_25', pick: 'Mais de 2.5 Golos', odd: 1.75, confidence: over25Pct })
  }
  if (bttsPct != null) {
    candidates.push({ market: 'BTTS', pick: 'Ambas Marcam: Sim', odd: 1.80, confidence: bttsPct })
  }
  if (homeWinPct != null) {
    candidates.push({ market: '1X2', pick: `${game.homeTeam.name} Vence`, odd: 2.00, confidence: homeWinPct })
  }

  // No real data for any market
  if (candidates.length === 0) return null

  // Tiebreaker: when confidences are equal, use avgGoals to prefer OVER_25 vs BTTS
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    // Same confidence — use avgGoals as secondary signal
    if (a.market === 'OVER_25' && b.market === 'BTTS') {
      return (avgGoals ?? 0) >= 2.5 ? -1 : 1  // prefer OVER_25 if high-scoring
    }
    if (a.market === 'BTTS' && b.market === 'OVER_25') {
      return (avgGoals ?? 0) >= 2.5 ? 1 : -1
    }
    return 0
  })

  return candidates[0]
}

function reasoningFor(game: Game): string {
  return game.stats.bttsPct != null
    ? `${game.stats.bttsPct}% BTTS · ${game.stats.avgGoals?.toFixed(1) ?? '—'} g/jogo`
    : game.homeTeamStats.formLast5.length > 0
      ? 'Forma recente disponível'
      : 'Dados limitados'
}

// ── Build plan (PCT mode) ─────────────────────────────────────────────────────

function buildPctPlan(games: Game[], config: BankrollConfig): PlanBet[] {
  const bets: PlanBet[] = []
  for (const game of games.slice(0, 5)) {
    const pick = bestPickForGame(game)
    if (!pick || pick.confidence <= 50) continue
    const { stakeCents } = bankrollService.calculateFlatStake(config.currentAmountCents, config.riskProfile, pick.confidence)
    bets.push({
      game, market: pick.market, pick: pick.pick, odd: pick.odd,
      confidence: pick.confidence, reasoning: reasoningFor(game),
      stakeCents, returnCents: Math.round(stakeCents * pick.odd),
      isSaved: betService.isPickSaved(game.id, pick.market), isRaspadinha: false,
    })
    if (bets.length >= 4) break
  }
  return bets
}

// ── Build plan (FIXED mode) ───────────────────────────────────────────────────

function buildFixedPlan(games: Game[], config: BankrollConfig): PlanBet[] {
  const budget = config.sessionBudgetCents
  if (!budget || budget <= 0) return buildPctPlan(games, config)

  // Up to 3 main picks (best market per game, confidence > 50)
  const mainPicks: Array<{ game: Game; market: string; pick: string; odd: number; confidence: number }> = []
  for (const game of games.slice(0, 6)) {
    const p = bestPickForGame(game)
    if (p && p.confidence > 50) mainPicks.push({ game, ...p })
    if (mainPicks.length >= 3) break
  }
  if (mainPicks.length === 0) return []

  // Raspadinha: use remaining games, pick best market for each leg
  const raspadinhaGames = games.filter(g => !mainPicks.some(m => m.game.id === g.id)).slice(0, 3)
  const hasRaspadinha   = config.raspadinhaEnabled && raspadinhaGames.length >= 2

  // Budget allocation
  const allBets = [
    ...mainPicks.map(p => ({ confidence: p.confidence, isRaspadinha: false })),
    ...(hasRaspadinha ? [{ confidence: 0, isRaspadinha: true }] : []),
  ]
  const stakes = bankrollService.allocateFixedBudget(budget, allBets)

  const result: PlanBet[] = mainPicks.map((p, i) => ({
    game: p.game, market: p.market, pick: p.pick, odd: p.odd,
    confidence: p.confidence, reasoning: reasoningFor(p.game),
    stakeCents: stakes[i] ?? 50, returnCents: Math.round((stakes[i] ?? 50) * p.odd),
    isSaved: betService.isPickSaved(p.game.id, p.market), isRaspadinha: false,
  }))

  if (hasRaspadinha) {
    const rStake = stakes[mainPicks.length] ?? 50

    // Build real legs for each raspadinha game
    const legs: RaspadinhaSelection[] = raspadinhaGames.map(g => {
      const p = bestPickForGame(g)
      return {
        gameLabel: `${g.homeTeam.name} vs ${g.awayTeam.name}`,
        homeTeam:  g.homeTeam.name,
        awayTeam:  g.awayTeam.name,
        kickoff:   g.date,
        market:    p?.market ?? 'OVER_25',
        pick:      p?.pick   ?? 'Mais de 2.5 Golos',
        odd:       p?.odd    ?? 1.75,
      }
    })

    const combOdd = parseFloat(
      legs.reduce((acc, l) => acc * l.odd, 1).toFixed(2)
    )

    result.push({
      game: raspadinhaGames[0],
      market: 'MULTIPLE',
      // Label = team abbreviations so History shows "JAP×SWE + TUN×NED + PAR×AUS"
      pick: legs.map(l => `${l.homeTeam.slice(0,3).toUpperCase()}×${l.awayTeam.slice(0,3).toUpperCase()}`).join(' + '),
      odd: combOdd,
      confidence: 35,
      reasoning: 'Múltipla especulativa — aposta as 3 selecções na mesma boletim.',
      stakeCents: rStake,
      returnCents: Math.round(rStake * combOdd),
      isSaved: false,
      isRaspadinha: true,
      raspadinhaLegs: legs,
    })
  }

  return result
}

// ── Raspadinha card ───────────────────────────────────────────────────────────

function RaspadinhaCard({
  bet, isSavedNow, saving,
  onSave,
}: {
  bet: PlanBet
  isSavedNow: boolean
  saving: boolean
  onSave: () => void
}) {
  const legs = bet.raspadinhaLegs ?? []

  return (
    <Card className="border-brand/20">
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <Shuffle size={15} className="text-brand" />
          <h3 className="text-sm font-bold text-brand uppercase tracking-wider">
            🎲 Raspadinha — Múltipla (10% orçamento)
          </h3>
        </div>

        {/* Explanation */}
        <div className="mb-4 p-3 bg-brand/5 border border-brand/15 rounded-xl">
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="text-text-primary font-semibold">O que é isto?</span> Uma aposta múltipla (acumulador)
            onde colocas <span className="font-bold text-brand">{formatCents(bet.stakeCents)}</span> e precisas que
            todas as {legs.length} selecções ganhem para receber{' '}
            <span className="font-bold text-accent-win">{formatCents(bet.returnCents)}</span>.
            Se uma falhar, perdes o stake. Alto risco, alto retorno.
          </p>
        </div>

        {/* Legs */}
        <div className="space-y-2 mb-4">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-raised rounded-xl border border-surface-border">
              <div className="w-5 h-5 rounded-full bg-brand/20 text-brand text-2xs font-black flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-primary">{leg.homeTeam} vs {leg.awayTeam}</p>
                <p className="text-xs text-text-muted">{leg.pick}</p>
                <p className="text-2xs text-text-muted font-mono">{formatTime(leg.kickoff)}</p>
              </div>
              <div className="shrink-0">
                <OddBadge odd={leg.odd} size="sm" />
                <Badge variant="blue" size="sm" className="mt-1">{leg.market}</Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-border">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xs text-text-muted">Odd combinada</p>
              <p className="text-lg font-black text-text-primary">{bet.odd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-2xs text-text-muted">Stake</p>
              <p className="text-sm font-bold text-brand font-mono">{formatCents(bet.stakeCents)}</p>
            </div>
            <div>
              <p className="text-2xs text-text-muted">Retorno se ganhar</p>
              <p className="text-sm font-bold text-accent-win font-mono">{formatCents(bet.returnCents)}</p>
            </div>
          </div>
          {isSavedNow ? (
            <span className="flex items-center gap-1 text-xs text-accent-win font-bold">
              <CheckCircle2 size={13} /> Guardado
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={onSave} disabled={saving}>
              {saving ? '...' : 'Guardar'}
            </Button>
          )}
        </div>

        <p className="text-2xs text-text-muted mt-3 text-center">
          ⚠ Odds indicativas — verifica os valores exactos na tua casa de apostas antes de apostar.
        </p>
      </CardBody>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DailyPlan() {
  const navigate  = useNavigate()
  const { config, isLoading: bankLoading, fetchAll } = useBankrollStore()
  const { games, isLoadingGames, fetchTodayGames }   = useGameStore()
  const [planBets, setPlanBets] = useState<PlanBet[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [saving,   setSaving]   = useState<string | null>(null)

  const isLoading = bankLoading || isLoadingGames

  useEffect(() => {
    fetchAll()
    if (games.length === 0) fetchTodayGames()
  }, [])

  useEffect(() => {
    if (!config || games.length === 0) return
    const bets = config.stakeMode === 'FIXED'
      ? buildFixedPlan(games, config)
      : buildPctPlan(games, config)
    setPlanBets(bets)
  }, [config, games])

  async function handleSaveBet(bet: PlanBet) {
    const key = bet.game.id + bet.market
    setSaving(key)
    await betService.savePick({
      gameId:         bet.game.id,
      gameLabel:      `${bet.game.homeTeam.name} vs ${bet.game.awayTeam.name}`,
      league:         bet.game.league,
      matchDate:      bet.game.date,
      market:         bet.market as any,
      pick:           bet.pick,
      oddPredicted:   bet.odd,
      confidence:     bet.confidence,
      reasoning:      bet.reasoning,
      stakeEuroCents: bet.stakeCents,
      // Persist raspadinha legs so History can render each selection
      legs: bet.raspadinhaLegs?.map(l => ({
        gameLabel: `${l.homeTeam} vs ${l.awayTeam}`,
        market:    l.market ?? '',
        pick:      l.pick ?? '',
        odd:       l.odd,
        kickoff:   l.kickoff,
      })),
    })
    setAccepted(a => new Set([...a, key]))
    setSaving(null)
    if (config) {
      setPlanBets(config.stakeMode === 'FIXED'
        ? buildFixedPlan(games, config)
        : buildPctPlan(games, config))
    }
  }

  async function handleAcceptAll() {
    for (const bet of planBets) {
      const key = bet.game.id + bet.market
      if (!accepted.has(key) && !bet.isSaved) await handleSaveBet(bet)
    }
  }

  const mainBets       = planBets.filter(b => !b.isRaspadinha)
  const raspadinha     = planBets.find(b => b.isRaspadinha)
  const totalAllocated = planBets.reduce((s, b) => s + b.stakeCents, 0)
  const totalReturn    = planBets.reduce((s, b) => s + b.returnCents, 0)
  const isFixed        = config?.stakeMode === 'FIXED'
  const sessionBudget  = config?.sessionBudgetCents ?? 0
  const budgetDisplay  = isFixed ? sessionBudget
    : config ? Math.round(config.currentAmountCents * config.maxDailyExposurePct) : 0
  const usedPct        = budgetDisplay > 0 ? (totalAllocated / budgetDisplay) * 100 : 0

  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Plano Diário"
        subtitle={today}
        onRefresh={() => { fetchAll(); fetchTodayGames() }}
        isRefreshing={isLoading}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {!isLoading && !config && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center border border-dashed border-surface-border rounded-xl bg-surface-card">
            <span className="text-4xl">💰</span>
            <p className="text-text-primary font-semibold text-base">Banca não configurada</p>
            <p className="text-text-muted text-sm max-w-sm">Configura a tua banca para gerar um plano com stakes reais.</p>
            <Button variant="primary" onClick={() => navigate('/banca')}>Configurar Banca</Button>
          </div>
        )}

        {!isLoading && config && games.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center border border-dashed border-surface-border rounded-xl bg-surface-card">
            <span className="text-4xl">📅</span>
            <p className="text-text-primary font-semibold">Sem jogos detectados hoje</p>
            <Button variant="secondary" onClick={() => navigate('/')}>Ver Dashboard</Button>
          </div>
        )}

        {config && planBets.length > 0 && (
          <>
            {/* Session budget banner (FIXED mode) */}
            {isFixed && sessionBudget > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-brand/10 border border-brand/20 rounded-xl">
                <span className="text-xl">💼</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">
                    Orçamento de sessão: <span className="text-brand">{formatCents(sessionBudget)}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatCents(Math.round(sessionBudget * 0.9))} apostas principais
                    {config.raspadinhaEnabled && ` + ${formatCents(Math.round(sessionBudget * 0.1))} raspadinha`}
                  </p>
                </div>
                <button onClick={() => navigate('/banca')} className="text-xs text-brand hover:underline shrink-0">Alterar</button>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <KPICard
                label="Alocado hoje"
                value={formatCents(totalAllocated)}
                note={budgetDisplay > 0 ? `${usedPct.toFixed(0)}% do orçamento` : ''}
                accent={usedPct > 90 ? 'amber' : 'green'}
              />
              <KPICard
                label="Se ganhar tudo"
                value={formatCents(totalReturn)}
                delta={`+${formatCents(totalReturn - totalAllocated)}`}
                accent="green"
              />
              <KPICard
                label={isFixed ? 'Modo' : 'Perfil'}
                value={isFixed ? 'Fixo' : config.riskProfile === 'CONSERVATIVE' ? 'Conserv.' : config.riskProfile === 'BALANCED' ? 'Equilib.' : 'Agressivo'}
                note={isFixed ? `${formatCents(sessionBudget)}/sessão` : `${config.riskProfile === 'CONSERVATIVE' ? '1.5' : config.riskProfile === 'BALANCED' ? '2.5' : '3.5'}% banca`}
                accent="default"
              />
            </div>

            {/* Budget bar */}
            {budgetDisplay > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex justify-between text-xs text-text-muted mb-2">
                  <span>{isFixed ? 'Orçamento de sessão usado' : `Orçamento diário (${config.maxDailyExposurePct * 100}% banca)`}</span>
                  <span className="font-mono">{formatCents(totalAllocated)} / {formatCents(budgetDisplay)}</span>
                </div>
                <div className="h-2.5 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', usedPct > 90 ? 'bg-accent-draw' : 'bg-brand')}
                    style={{ width: `${Math.min(usedPct, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Main bets */}
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                    🎯 Apostas Principais
                  </h3>
                  <Button variant="primary" size="sm" onClick={handleAcceptAll}>Guardar Todas</Button>
                </div>
                <div className="space-y-3">
                  {mainBets.map((bet, i) => {
                    const key        = bet.game.id + bet.market
                    const isSavedNow = accepted.has(key) || bet.isSaved
                    return (
                      <div key={key} className={cn(
                        'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                        isSavedNow ? 'bg-accent-winBg/30 border-accent-win/20' : 'bg-surface-raised border-surface-border',
                      )}>
                        <div className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-black flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-bold text-text-primary">{bet.pick}</p>
                            <OddBadge odd={bet.odd} size="sm" />
                            {isSavedNow && (
                              <span className="flex items-center gap-1 text-xs text-accent-win font-bold">
                                <CheckCircle2 size={11} /> Guardado
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => navigate(`/jogo/${bet.game.id}`)}
                            className="text-xs text-text-muted hover:text-brand transition-colors mb-2 text-left"
                          >
                            {bet.game.homeTeam.name} vs {bet.game.awayTeam.name} · {formatTime(bet.game.date)}
                          </button>
                          <div className="flex items-center gap-3">
                            <Badge variant="blue" size="sm">{bet.market}</Badge>
                            <span className="text-2xs text-text-muted">{bet.reasoning}</span>
                          </div>
                          <ConfidenceBar value={bet.confidence} size="sm" className="max-w-40 mt-2" />
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-2xs text-text-muted">Stake</p>
                          <p className="text-sm font-black text-text-primary font-mono">{formatCents(bet.stakeCents)}</p>
                          <p className="text-xs text-accent-win font-mono">→ {formatCents(bet.returnCents)}</p>
                          {!isSavedNow && (
                            <Button variant="secondary" size="sm" onClick={() => handleSaveBet(bet)} disabled={saving === key}>
                              {saving === key ? '...' : 'Guardar'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Raspadinha */}
            {raspadinha && (
              <RaspadinhaCard
                bet={raspadinha}
                isSavedNow={accepted.has(raspadinha.game.id + raspadinha.market) || raspadinha.isSaved}
                saving={saving === raspadinha.game.id + raspadinha.market}
                onSave={() => handleSaveBet(raspadinha)}
              />
            )}

            {!raspadinha && config.raspadinhaEnabled && (
              <div className="px-4 py-3 border border-dashed border-brand/20 rounded-xl text-xs text-text-muted text-center">
                Sem jogos suficientes para gerar raspadinha hoje.
              </div>
            )}

            {!config.raspadinhaEnabled && (
              <div className="px-4 py-3 border border-dashed border-surface-border rounded-xl text-xs text-text-muted text-center">
                Raspadinha desactivada —{' '}
                <button onClick={() => navigate('/banca')} className="text-brand hover:underline">activar na Banca</button>
              </div>
            )}

            <p className="text-xs text-text-muted text-center pb-2">
              Odds indicativas · Verifica os valores exactos na tua casa de apostas antes de apostar.
            </p>
          </>
        )}

        {!isLoading && config && games.length > 0 && planBets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center border border-dashed border-surface-border rounded-xl bg-surface-card">
            <span className="text-4xl">📊</span>
            <p className="text-text-primary font-semibold">Dados insuficientes para sugestões</p>
            <p className="text-text-muted text-sm max-w-sm">
              Os jogos de hoje têm dados estatísticos limitados. Explora os jogos individualmente.
            </p>
            <Button variant="secondary" onClick={() => navigate('/')}>Ver Dashboard</Button>
          </div>
        )}
      </div>
    </div>
  )
}
