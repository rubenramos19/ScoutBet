import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { FormStrip } from '@/components/ui/FormBadge'
import { ScoreRing } from '@/components/ui/ConfidenceBar'
import { OddBadge } from '@/components/ui/OddBadge'
import { Badge } from '@/components/ui/Badge'
import { formatTime } from '@/lib/format'
import type { Game } from '@/types'

interface GameCardProps {
  game: Game
}

export function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate()

  // Best simple pick from rules (Sprint 3 will use full scoring)
  const topPick = game.odds
    ? game.odds.homeWin <= 2.00
      ? { pick: `${game.homeTeam.shortName} Vence`, odd: game.odds.homeWin }
      : game.odds.bttsYes <= 1.80
        ? { pick: 'Ambas Marcam', odd: game.odds.bttsYes }
        : { pick: 'Over 2.5 Golos', odd: game.odds.over25 }
    : null

  return (
    <Card
      hover
      onClick={() => navigate(`/jogo/${game.id}`)}
      className="animate-fade-in"
    >
      {/* League + time */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-2xs font-bold text-brand uppercase tracking-widest">
          {game.league}
        </span>
        <div className="flex items-center gap-1 text-text-muted">
          <Clock size={11} />
          <span className="text-2xs font-mono">{formatTime(game.date)}</span>
        </div>
      </div>

      {/* Teams + form + score ring */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{game.homeTeam.logoEmoji}</span>
              <span className="font-bold text-sm text-text-primary truncate">
                {game.homeTeam.name}
              </span>
            </div>
            <FormStrip form={game.homeTeamStats.formLast5} size="sm" />
          </div>

          {/* Score ring + VS */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing value={game.dataQualityScore} size={38} />
            <span className="text-2xs text-text-muted font-bold">vs</span>
          </div>

          {/* Away */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <span className="font-bold text-sm text-text-primary truncate">
                {game.awayTeam.name}
              </span>
              <span className="text-xl">{game.awayTeam.logoEmoji}</span>
            </div>
            <div className="flex justify-end">
              <FormStrip form={game.awayTeamStats.formLast5} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Injuries warning */}
      {game.injuries.filter(i => i.severity === 'high' && i.isKeyPlayer).length > 0 && (
        <div className="mx-4 mb-3 px-2 py-1.5 bg-accent-lossBg border border-accent-loss/20 rounded-lg">
          <p className="text-2xs text-accent-loss font-medium">
            🏥 {game.injuries.filter(i => i.severity === 'high' && i.isKeyPlayer).map(i => i.player).join(', ')} — lesionado
          </p>
        </div>
      )}

      {/* Best pick */}
      {topPick && (
        <div className="mx-4 mb-4 flex items-center justify-between bg-surface-raised rounded-lg px-3 py-2">
          <div>
            <p className="text-2xs text-text-muted">Melhor aposta</p>
            <p className="text-xs font-bold text-text-primary">{topPick.pick}</p>
          </div>
          <OddBadge odd={topPick.odd} size="sm" />
        </div>
      )}

      {/* Odds strip */}
      {game.odds && (
        <div className="border-t border-surface-border px-4 py-2.5 flex items-center gap-2">
          {[
            { label: '1', odd: game.odds.homeWin },
            { label: 'X', odd: game.odds.draw },
            { label: '2', odd: game.odds.awayWin },
          ].map(({ label, odd }) => (
            <div key={label} className="flex-1 text-center">
              <p className="text-2xs text-text-muted mb-0.5">{label}</p>
              <p className="text-xs font-bold font-mono text-accent-draw">{odd.toFixed(2)}</p>
            </div>
          ))}
          <div className="h-6 w-px bg-surface-border" />
          <div className="flex-1 text-center">
            <p className="text-2xs text-text-muted mb-0.5">BTTS</p>
            <p className="text-xs font-bold font-mono text-text-secondary">{game.odds.bttsYes.toFixed(2)}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xs text-text-muted mb-0.5">+2.5</p>
            <p className="text-xs font-bold font-mono text-text-secondary">{game.odds.over25.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Featured rank */}
      {game.featuredRank !== null && (
        <div className="absolute -top-1.5 -left-1.5">
          <Badge variant="blue" size="sm">#{game.featuredRank}</Badge>
        </div>
      )}
    </Card>
  )
}
