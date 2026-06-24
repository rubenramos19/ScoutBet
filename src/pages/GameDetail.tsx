import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { GameHero } from '@/components/game/GameHero'
import { InjuryList } from '@/components/game/InjuryList'
import { PlayerInFormList } from '@/components/game/PlayerInForm'
import { H2HStrip } from '@/components/game/H2HStrip'
import { BetRecommendation } from '@/components/bets/BetRecommendation'
import { MultipleCard } from '@/components/bets/MultipleCard'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { useGameStore } from '@/store/useGameStore'
import { ruleBasedConfidence } from '@/lib/score'
import type { MultipleSuggestion } from '@/types'

type TabKey = 'analise' | 'apostas' | 'combinadas'

const TABS = [
  { key: 'analise'    as const, label: '📊 Análise' },
  { key: 'apostas'    as const, label: '🎯 Apostas' },
  { key: 'combinadas' as const, label: '🔗 Combinadas' },
]

export function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedGame, isLoadingGame, multiples, selectGame } = useGameStore()
  const [tab, setTab] = useState<TabKey>('analise')

  useEffect(() => {
    if (id) selectGame(id)
  }, [id])

  if (isLoadingGame) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!selectedGame) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Jogo não encontrado.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>← Voltar</Button>
      </div>
    )
  }

  const game = selectedGame
  const gameMultiples: MultipleSuggestion[] = multiples
    .filter(m => m.strategy !== 'RASPADINHA' && m.selections.some(s => s.gameId === game.id))

  // Rule-based picks for this game (Sprint 6 replaces with AI)
  const picks = [
    { market: '1X2',     pick: `${game.homeTeam.name} Vence`, odd: game.odds?.homeWin ?? 2.00 },
    { market: 'BTTS',    pick: 'Ambas Marcam: Sim',            odd: game.odds?.bttsYes ?? 1.80 },
    { market: 'OVER_25', pick: 'Mais de 2.5 Golos',            odd: game.odds?.over25  ?? 1.75 },
  ].map(p => ({
    ...p,
    confidence: ruleBasedConfidence(p.market, game),
    reasoning: `Baseado em dados estatísticos: ${game.stats.bttsPct}% BTTS, média ${game.stats.avgGoals.toFixed(1)} golos/jogo.`,
  }))

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title={`${game.homeTeam.shortName} vs ${game.awayTeam.shortName}`}
        subtitle={`${game.league} · ${game.round}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Voltar
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <GameHero game={game} />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {/* Tab: Análise */}
        {tab === 'analise' && (
          <div className="space-y-4 animate-slide-up">
            <Card>
              <CardBody>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">🏥 Lesões e Dúvidas</h3>
                <InjuryList injuries={game.injuries} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">🔥 Jogadores em Destaque</h3>
                <PlayerInFormList players={game.playersInForm} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">⚔️ Head-to-Head (últimos 5)</h3>
                <H2HStrip results={game.h2h.last5} homeTeam={game.homeTeam.name} awayTeam={game.awayTeam.name} />
                <p className="text-xs text-text-muted mt-3">Média de {game.h2h.avgTotalGoals.toFixed(1)} golos nos confrontos directos</p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Tab: Apostas */}
        {tab === 'apostas' && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-text-muted">Recomendações baseadas em regras estatísticas — Sprint 6 adicionará análise de IA.</p>
            </div>
            {picks.map((pick, i) => (
              <BetRecommendation
                key={i}
                market={pick.market}
                pick={pick.pick}
                odd={pick.odd}
                confidence={pick.confidence}
                reasoning={pick.reasoning}
              />
            ))}
          </div>
        )}

        {/* Tab: Combinadas */}
        {tab === 'combinadas' && (
          <div className="space-y-4 animate-slide-up">
            {gameMultiples.length === 0 ? (
              <div className="text-center py-10 text-text-muted text-sm">
                Sem combinadas com este jogo geradas para hoje.
              </div>
            ) : gameMultiples.map(m => (
              <MultipleCard key={m.id} multiple={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
