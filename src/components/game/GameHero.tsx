import { Clock, Radio } from 'lucide-react'
import { FormStrip } from '@/components/ui/FormBadge'
import { ScoreRing } from '@/components/ui/ConfidenceBar'
import { StatBar } from '@/components/ui/StatBar'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Game } from '@/types'

function TeamLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="w-12 h-12 object-contain rounded shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="text-4xl shrink-0">⚽</span>
}

interface GameHeroProps {
  game: Game
}

export function GameHero({ game }: GameHeroProps) {
  const { homeTeam, awayTeam, homeTeamStats, awayTeamStats, stats } = game
  const isLive   = game.status === 'LIVE'
  const finished = game.status === 'FINISHED'

  const fmt    = (v: number | null | undefined, dec = 1): string =>
    v != null ? v.toFixed(dec) : '—'
  const fmtPct = (v: number | null | undefined): string =>
    v != null ? `${v}%` : '—'

  const h2hTotal = game.h2h.homeWins + game.h2h.draws + game.h2h.awayWins

  return (
    <div className={cn(
      'bg-surface-card border rounded-xl p-6',
      isLive ? 'border-accent-win/30 shadow-[0_0_20px_rgba(34,197,94,0.07)]' : 'border-surface-border'
    )}>
      {/* League + time + round */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-bold text-brand uppercase tracking-widest">{game.league}</span>
          <span className="text-xs text-text-muted ml-3">{game.round}</span>
        </div>
        {isLive ? (
          <div className="flex items-center gap-1.5 text-accent-win">
            <Radio size={13} className="animate-pulse" />
            <span className="text-sm font-bold">AO VIVO</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-text-muted">
            <Clock size={13} />
            <span className="text-sm font-mono font-bold">
              {finished ? 'FT' : formatTime(game.date)}
            </span>
          </div>
        )}
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-4 mb-6">
        {/* Home */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <TeamLogo logoUrl={homeTeam.logoUrl} name={homeTeam.name} />
            <div>
              <h2 className="text-xl font-black text-text-primary">{homeTeam.name}</h2>
              <p className="text-xs text-text-muted">{fmt(homeTeamStats.goalsForAvg)} g/jogo</p>
            </div>
          </div>
          <FormStrip form={homeTeamStats.formLast5} size="md" />
        </div>

        {/* Centre: score (live/finished) or H2H summary + data quality ring */}
        <div className="flex flex-col items-center gap-3 shrink-0 px-2">
          {(isLive || finished) && game.homeScore !== null && game.awayScore !== null ? (
            <div className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2',
              isLive ? 'bg-accent-winBg border border-accent-win/20' : 'bg-surface-raised'
            )}>
              <span className="text-3xl font-black tabular-nums text-text-primary">{game.homeScore}</span>
              <span className="text-text-muted font-bold text-lg">-</span>
              <span className="text-3xl font-black tabular-nums text-text-primary">{game.awayScore}</span>
            </div>
          ) : (
            <ScoreRing value={game.dataQualityScore} size={52} />
          )}
          {h2hTotal > 0 ? (
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
          ) : (
            <p className="text-2xs text-text-muted">Sem H2H</p>
          )}
          <p className="text-2xs text-text-muted">H2H histórico</p>
        </div>

        {/* Away */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-3 mb-3">
            <div>
              <h2 className="text-xl font-black text-text-primary">{awayTeam.name}</h2>
              <p className="text-xs text-text-muted">{fmt(awayTeamStats.goalsForAvg)} g/jogo</p>
            </div>
            <TeamLogo logoUrl={awayTeam.logoUrl} name={awayTeam.name} />
          </div>
          <div className="flex justify-end">
            <FormStrip form={awayTeamStats.formLast5} size="md" />
          </div>
        </div>
      </div>

      {/* Stats bars */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4 border-t border-surface-border">
        <StatBar
          label="Média Golos/Jogo"
          value={fmt(stats.avgGoals)}
          pct={stats.avgGoals != null ? (stats.avgGoals / 5) * 100 : 0}
          color="bg-brand"
        />
        <StatBar
          label="Ambas Marcam %"
          value={fmtPct(stats.bttsPct)}
          pct={stats.bttsPct ?? 0}
          color="bg-purple-500"
        />
        <StatBar
          label="Over 2.5 Golos %"
          value={fmtPct(stats.over25Pct)}
          pct={stats.over25Pct ?? 0}
          color="bg-teal-500"
        />
        <StatBar
          label="Vitória Casa %"
          value={fmtPct(stats.homeWinPct)}
          pct={stats.homeWinPct ?? 0}
          color="bg-accent-win"
        />
      </div>
    </div>
  )
}
