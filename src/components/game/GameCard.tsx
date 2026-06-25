import { useNavigate } from 'react-router-dom'
import { Clock, Radio } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { FormStrip } from '@/components/ui/FormBadge'
import { ScoreRing } from '@/components/ui/ConfidenceBar'
import { Badge } from '@/components/ui/Badge'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Game } from '@/types'

function TeamLogo({ logoUrl, name, size = 'sm' }: { logoUrl: string | null; name: string; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn(px, 'object-contain rounded-sm shrink-0')}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className={cn(px, 'flex items-center justify-center text-lg shrink-0')}>⚽</span>
}

interface GameCardProps {
  game: Game
}

export function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate()
  const isLive     = game.status === 'LIVE'
  const isFinished = game.status === 'FINISHED'

  return (
    <Card
      hover
      onClick={() => navigate(`/jogo/${game.id}`)}
      className={cn(
        'animate-fade-in relative overflow-hidden',
        isLive && 'border-accent-win/50 shadow-[0_0_20px_rgba(34,197,94,0.12)]',
      )}
    >
      {/* LIVE top bar stripe */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-win via-green-400 to-accent-win animate-pulse" />
      )}

      {/* League + time / live badge */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-2xs font-bold text-brand uppercase tracking-widest truncate">
          {game.league}
        </span>

        {isLive ? (
          <div className="flex items-center gap-1.5 bg-accent-win/10 border border-accent-win/30 rounded-full px-2 py-0.5">
            <Radio size={10} className="text-accent-win animate-pulse" />
            <span className="text-2xs font-black text-accent-win tracking-wide">AO VIVO</span>
            {game.liveMinute && (
              <span className="text-2xs font-mono text-accent-win/80">{game.liveMinute}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-text-muted">
            <Clock size={11} />
            <span className="text-2xs font-mono">{formatTime(game.date)}</span>
          </div>
        )}
      </div>

      {/* Teams + form + score */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">

          {/* Home */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <TeamLogo logoUrl={game.homeTeam.logoUrl} name={game.homeTeam.name} size="sm" />
              <span className={cn(
                'font-bold text-sm truncate',
                isLive && game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore
                  ? 'text-accent-win'
                  : 'text-text-primary',
              )}>
                {game.homeTeam.name}
              </span>
            </div>
            <FormStrip form={game.homeTeamStats.formLast5} size="sm" />
          </div>

          {/* Centre score / ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {isLive && game.homeScore !== null && game.awayScore !== null ? (
              <div className="flex items-center gap-0 bg-accent-win/10 border border-accent-win/30 rounded-xl px-3 py-1.5">
                <span className="text-xl font-black text-text-primary tabular-nums w-6 text-center">
                  {game.homeScore}
                </span>
                <span className="text-accent-win font-bold mx-1">–</span>
                <span className="text-xl font-black text-text-primary tabular-nums w-6 text-center">
                  {game.awayScore}
                </span>
              </div>
            ) : isFinished && game.homeScore !== null ? (
              <div className="flex items-center gap-0 bg-surface-raised rounded-xl px-3 py-1.5">
                <span className="text-base font-black text-text-secondary tabular-nums w-5 text-center">
                  {game.homeScore}
                </span>
                <span className="text-text-muted font-bold mx-1 text-sm">–</span>
                <span className="text-base font-black text-text-secondary tabular-nums w-5 text-center">
                  {game.awayScore}
                </span>
              </div>
            ) : (
              <ScoreRing value={game.dataQualityScore} size={38} />
            )}
            <span className="text-2xs text-text-muted font-bold">
              {isLive ? (game.liveMinute ?? '●') : isFinished ? 'FT' : 'vs'}
            </span>
          </div>

          {/* Away */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <span className={cn(
                'font-bold text-sm truncate',
                isLive && game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore
                  ? 'text-accent-win'
                  : 'text-text-primary',
              )}>
                {game.awayTeam.name}
              </span>
              <TeamLogo logoUrl={game.awayTeam.logoUrl} name={game.awayTeam.name} size="sm" />
            </div>
            <div className="flex justify-end">
              <FormStrip form={game.awayTeamStats.formLast5} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {(game.stats.bttsPct != null || game.stats.over25Pct != null || game.stats.avgGoals != null) && (
        <div className="mx-4 mb-3 flex items-center gap-4 px-3 py-2 bg-surface-raised rounded-lg">
          {game.stats.avgGoals != null && (
            <div className="text-center flex-1">
              <p className="text-2xs text-text-muted">Media Golos</p>
              <p className="text-xs font-bold text-text-primary">{game.stats.avgGoals.toFixed(1)}</p>
            </div>
          )}
          {game.stats.bttsPct != null && (
            <div className="text-center flex-1">
              <p className="text-2xs text-text-muted">BTTS</p>
              <p className="text-xs font-bold text-text-primary">{game.stats.bttsPct}%</p>
            </div>
          )}
          {game.stats.over25Pct != null && (
            <div className="text-center flex-1">
              <p className="text-2xs text-text-muted">Over 2.5</p>
              <p className="text-xs font-bold text-text-primary">{game.stats.over25Pct}%</p>
            </div>
          )}
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
