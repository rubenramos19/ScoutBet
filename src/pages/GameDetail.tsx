import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { GameHero } from '@/components/game/GameHero'
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
  { key: 'analise'    as const, label: 'Analise' },
  { key: 'apostas'    as const, label: 'Apostas' },
  { key: 'combinadas' as const, label: 'Combinadas' },
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
        <p className="text-text-muted">Jogo nao encontrado.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Voltar</Button>
      </div>
    )
  }

  const game = selectedGame
  const gameMultiples: MultipleSuggestion[] = multiples
    .filter(m => m.strategy !== 'RASPADINHA' && m.selections.some(s => s.gameId === game.id))

  // Build per-market reasoning from real data
  function marketReasoning(market: string): string {
    const s = game.stats
    if (market === 'BTTS') {
      if (s.bttsPct == null) return 'Dados de BTTS indisponíveis via ESPN.'
      return `${s.bttsPct}% dos jogos recentes tiveram ambas as equipas a marcar.${s.avgGoals != null ? ` Média: ${s.avgGoals.toFixed(1)} golos/jogo.` : ''}`
    }
    if (market === 'OVER_25') {
      if (s.over25Pct == null) return 'Dados de Over 2.5 indisponíveis via ESPN.'
      return `${s.over25Pct}% dos jogos recentes terminaram com +2.5 golos.${s.avgGoals != null ? ` Média: ${s.avgGoals.toFixed(1)} golos/jogo.` : ''}`
    }
    if (market === '1X2') {
      if (s.homeWinPct == null) return 'Dados de resultado indisponíveis via ESPN.'
      return `${game.homeTeam.name} venceu ${s.homeWinPct}% dos jogos em casa recentes.`
    }
    return 'Dados reais ESPN.'
  }

  const MIN_CONFIDENCE = 35 // don't show cards with no statistical support

  const picks = [
    { market: '1X2',     pick: `${game.homeTeam.name} Vence`, odd: game.odds?.homeWin ?? 2.00 },
    { market: 'BTTS',    pick: 'Ambas Marcam: Sim',            odd: game.odds?.bttsYes ?? 1.80 },
    { market: 'OVER_25', pick: 'Mais de 2.5 Golos',            odd: game.odds?.over25  ?? 1.75 },
  ].map(p => ({
    ...p,
    confidence: ruleBasedConfidence(p.market, game),
    reasoning:  marketReasoning(p.market),
    gameId:    game.id,
    gameLabel: `${game.homeTeam.name} vs ${game.awayTeam.name}`,
    league:    game.league,
    matchDate: game.date,
  })).filter(p => p.confidence >= MIN_CONFIDENCE)

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

        {tab === 'analise' && (
          <div className="space-y-4 animate-slide-up">

            {/* ── Team comparison side by side ── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { team: game.homeTeam, stats: game.homeTeamStats, label: 'Casa' },
                { team: game.awayTeam, stats: game.awayTeamStats, label: 'Fora' },
              ].map(({ team, stats, label }) => {
                const wins   = stats.formLast5.filter(r => r === 'W').length
                const draws  = stats.formLast5.filter(r => r === 'D').length
                const losses = stats.formLast5.filter(r => r === 'L').length
                const scored    = stats.goalsForAvg
                const conceded  = stats.goalsAgainstAvg
                // Infer style
                const tags: string[] = []
                if (scored != null) {
                  if (scored >= 2.5)      tags.push('⚡ Muito Ofensivo')
                  else if (scored >= 1.5) tags.push('⚽ Ofensivo')
                  else if (scored <= 0.5) tags.push('😶 Pouco Produtivo')
                }
                if (conceded != null) {
                  if (conceded <= 0.6)    tags.push('🔒 Muito Defensivo')
                  else if (conceded <= 1.2) tags.push('🛡 Sólido')
                  else if (conceded >= 2.0) tags.push('⚠ Vulnerável')
                }
                if (tags.length === 0) tags.push('📊 Dados limitados')

                return (
                  <Card key={team.id}>
                    <CardBody className="space-y-3">
                      <div className="flex items-center gap-2">
                        {team.logoUrl && (
                          <img src={team.logoUrl} alt={team.name}
                            className="w-6 h-6 object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display='none' }}
                          />
                        )}
                        <div>
                          <p className="text-xs font-black text-text-primary leading-tight">{team.name}</p>
                          <p className="text-2xs text-text-muted">{label}</p>
                        </div>
                      </div>

                      {/* Goals scored / conceded */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface-raised rounded-lg p-2 text-center">
                          <p className="text-2xs text-text-muted">Marcados</p>
                          <p className="text-sm font-black text-accent-win">
                            {scored != null ? scored.toFixed(1) : '—'}
                          </p>
                          <p className="text-2xs text-text-muted">p/jogo</p>
                        </div>
                        <div className="bg-surface-raised rounded-lg p-2 text-center">
                          <p className="text-2xs text-text-muted">Sofridos</p>
                          <p className="text-sm font-black text-accent-loss">
                            {conceded != null ? conceded.toFixed(1) : '—'}
                          </p>
                          <p className="text-2xs text-text-muted">p/jogo</p>
                        </div>
                      </div>

                      {/* Last 5 record */}
                      {stats.formLast5.length > 0 && (
                        <div className="flex justify-between text-2xs">
                          <span className="text-accent-win font-bold">{wins}V</span>
                          <span className="text-accent-draw font-bold">{draws}E</span>
                          <span className="text-accent-loss font-bold">{losses}D</span>
                          <span className="text-text-muted">(ult. 5)</span>
                        </div>
                      )}

                      {/* Clean sheets */}
                      {stats.cleanSheets != null && (
                        <p className="text-2xs text-text-muted">
                          🧤 Portas fechadas: <span className="text-text-primary font-semibold">{stats.cleanSheets}%</span>
                        </p>
                      )}

                      {/* Style tags */}
                      <div className="flex flex-wrap gap-1">
                        {tags.map(t => (
                          <span key={t} className="text-2xs bg-surface-raised border border-surface-border rounded-full px-2 py-0.5 text-text-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>

            {/* ── Matchup summary ── */}
            <Card>
              <CardBody>
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Análise do Confronto
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const hs = game.homeTeamStats, as_ = game.awayTeamStats
                    const lines: { icon: string; text: string; accent?: string }[] = []

                    // Expected goals
                    if (game.stats.avgGoals != null) {
                      const eg = game.stats.avgGoals
                      lines.push({
                        icon: '⚽',
                        text: `Média combinada de ${eg.toFixed(1)} golos/jogo — ${eg >= 2.5 ? 'favorece Over 2.5' : eg >= 1.5 ? 'jogo equilibrado em golos' : 'jogo tendencialmente fechado'}`,
                        accent: eg >= 2.5 ? 'green' : eg < 1.5 ? 'red' : undefined,
                      })
                    }

                    // Defensive vs offensive clash
                    const homeScored   = hs.goalsForAvg ?? 0
                    const awayScored   = as_.goalsForAvg ?? 0
                    const awayConceded = as_.goalsAgainstAvg ?? 0
                    if (hs.goalsForAvg != null && as_.goalsAgainstAvg != null) {
                      if (homeScored >= 1.5 && awayConceded >= 1.5)
                        lines.push({ icon: '🎯', text: `${game.homeTeam.shortName} ataca bem (${homeScored.toFixed(1)}/j) contra defesa vulnerável de ${game.awayTeam.shortName} (${awayConceded.toFixed(1)} sofridos/j)`, accent: 'green' })
                      else if (homeScored <= 0.8 && awayScored <= 0.8)
                        lines.push({ icon: '🛡', text: 'Ambas as equipas com ataque fraco — jogo de baixos golos provável', accent: 'red' })
                    }

                    // BTTS insight
                    if (game.stats.bttsPct != null) {
                      if (game.stats.bttsPct >= 60)
                        lines.push({ icon: '✅', text: `BTTS histórico de ${game.stats.bttsPct}% — ambas marcam com frequência`, accent: 'green' })
                      else if (game.stats.bttsPct <= 20)
                        lines.push({ icon: '❌', text: `BTTS de apenas ${game.stats.bttsPct}% — raro que ambas marquem`, accent: 'red' })
                    }

                    // Form momentum
                    const homeWins = hs.formLast5.filter(r => r === 'W').length
                    const awayWins = as_.formLast5.filter(r => r === 'W').length
                    if (hs.formLast5.length > 0 && as_.formLast5.length > 0) {
                      if (homeWins >= 4)
                        lines.push({ icon: '🔥', text: `${game.homeTeam.shortName} em excelente forma (${homeWins}/5 vitórias)`, accent: 'green' })
                      else if (awayWins >= 4)
                        lines.push({ icon: '🔥', text: `${game.awayTeam.shortName} em excelente forma (${awayWins}/5 vitórias)`, accent: 'green' })
                      else if (homeWins <= 1 && awayWins <= 1)
                        lines.push({ icon: '⚠', text: 'Ambas as equipas em má forma recente — resultado imprevisível' })
                    }

                    // No-data fallback
                    if (lines.length === 0)
                      lines.push({ icon: '📊', text: 'Dados históricos insuficientes para análise detalhada via ESPN.' })

                    return lines.map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 mt-0.5">{l.icon}</span>
                        <span className={
                          l.accent === 'green' ? 'text-accent-win' :
                          l.accent === 'red'   ? 'text-accent-loss' :
                          'text-text-secondary'
                        }>{l.text}</span>
                      </div>
                    ))
                  })()}
                </div>
              </CardBody>
            </Card>

            {/* ── H2H ── */}
            {game.h2h.last5.length > 0 ? (
              <Card>
                <CardBody>
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                    Head-to-Head (últimos confrontos)
                  </h3>
                  <H2HStrip results={game.h2h.last5} homeTeam={game.homeTeam.name} awayTeam={game.awayTeam.name} />
                  {game.h2h.avgTotalGoals != null && (
                    <p className="text-xs text-text-muted mt-3">
                      Média de {game.h2h.avgTotalGoals.toFixed(1)} golos nos confrontos directos
                    </p>
                  )}
                </CardBody>
              </Card>
            ) : (
              <div className="rounded-xl border border-surface-border/50 p-4 text-center">
                <p className="text-xs text-text-muted">Sem H2H disponível — equipas sem historial directo recente na ESPN.</p>
              </div>
            )}

            {/* ── Data limits notice ── */}
            <div className="rounded-xl border border-surface-border/50 bg-surface-raised/30 p-4 space-y-1">
              <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">Dados não disponíveis via ESPN</p>
              <p className="text-2xs text-text-muted leading-relaxed">
                🔒 Jogadores, lesões específicas, valores de mercado e formações táticas não são fornecidos pela API pública da ESPN.
                Para esses dados consulta <span className="text-brand">Transfermarkt</span>, <span className="text-brand">SofaScore</span> ou o site oficial da FIFA.
              </p>
            </div>

          </div>
        )}

        {tab === 'apostas' && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-text-muted">
                Recomendacoes baseadas em dados reais ESPN. Odds indicativas.
              </p>
            </div>
            {picks.length === 0 ? (
              <div className="rounded-xl border border-surface-border bg-surface-card p-6 text-center space-y-2">
                <p className="text-2xl">📊</p>
                <p className="text-sm font-semibold text-text-primary">Dados insuficientes para sugerir apostas</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Os dados históricos disponíveis via ESPN não mostram tendências claras neste jogo.<br/>
                  BTTS: {game.stats.bttsPct != null ? `${game.stats.bttsPct}%` : '—'} · Over 2.5: {game.stats.over25Pct != null ? `${game.stats.over25Pct}%` : '—'} · Vitória casa: {game.stats.homeWinPct != null ? `${game.stats.homeWinPct}%` : '—'}
                </p>
              </div>
            ) : picks.map((pick, i) => (
              <BetRecommendation
                key={i}
                market={pick.market}
                pick={pick.pick}
                odd={pick.odd}
                confidence={pick.confidence}
                reasoning={pick.reasoning}
                gameId={pick.gameId}
                gameLabel={pick.gameLabel}
                league={pick.league}
                matchDate={pick.matchDate}
              />
            ))}
          </div>
        )}

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
