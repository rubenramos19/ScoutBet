import { Clock } from 'lucide-react'
import { FormStrip } from '@/components/ui/FormBadge'
import { ScoreRing } from '@/components/ui/ConfidenceBar'
import { StatBar } from '@/components/ui/StatBar'
import { formatTime } from '@/lib/format'
import type { Game } from '@/types'

interface GameHeroProps {
  game: Game
}

export function GameHero({ game }: GameHeroProps) {
  const { homeTeam, awayTeam, homeTeamStats, awayTeamStats, stats } = game

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6">
      {/* League + time + round */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-bold text-brand uppercase tracking-widest">{game.league}</span>
          <span className="text-xs text-text-muted ml-3">{game.round}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-muted">
          <Clock size={13} />
          <span className="text-sm font-mono font-bold">{formatTime(game.date)}</span>
        </div>
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-4 mb-6">
        {/* Home */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{homeTeam.logoEmoji}</span>
            <div>
              <h2 className="text-xl font-black text-text-primary">{homeTeam.name}</h2>
              <p className="text-xs text-text-muted">{homeTeamStats.goalsForAvg.toFixed(1)} g/jogo</p>
            </div>
          </div>
          <FormStrip form={homeTeamStats.formLast5} size="md" />
        </div>

        {/* Centre: H2H summary + score */}
        <div className="flex flex-col items-center gap-3 shrink-0 px-2">
          <ScoreRing value={game.dataQualityScore} size={52} />
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-accent-winBg text-accent-win text-xs font-bold">
              {game.h2h.homeWins}V
            </span>
            <span className="px-2 py-0.5 rounded bg-accent-drawBg text-accent-draw text-xs font-bold">
              {game.h2h.draws}E
            </span>
            <span className="px-2 py-0.5 rounded bg-accent-lossBg text-accent-loss text-xs font-bold">
              {game.h2h.awayWins}D
            </span>
          </div>
          <p className="text-2xs text-text-muted">H2H histórico</p>
        </div>

        {/* Away */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-3 mb-3">
            <div>
              <h2 className="text-xl font-black text-text-primary">{awayTeam.name}</h2>
              <p className="text-xs text-text-muted">{awayTeamStats.goalsForAvg.toFixed(1)} g/jogo</p>
            </div>
            <span className="text-4xl">{awayTeam.logoEmoji}</span>
          </div>
          <div className="flex justify-end">
            <FormStrip form={awayTeamStats.formLast5} size="md" />
          </div>
        </div>
      </div>

      {/* Stats bars */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4 border-t border-surface-border">
        <StatBar label="Média Golos/Jogo"  value={stats.avgGoals.toFixed(1)} pct={(stats.avgGoals / 5) * 100} color="bg-brand" />
        <StatBar label="Ambas Marcam %"    value={`${stats.bttsPct}%`}       pct={stats.bttsPct}            color="bg-purple-500" />
        <StatBar label="Over 2.5 Golos %"  value={`${stats.over25Pct}%`}     pct={stats.over25Pct}          color="bg-teal-500" />
        <StatBar label="Vitória Casa %"    value={`${stats.homeWinPct}%`}    pct={stats.homeWinPct}         color="bg-accent-win" />
      </div>
    </div>
  )
}
