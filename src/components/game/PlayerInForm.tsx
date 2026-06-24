import type { PlayerInForm as PlayerInFormType } from '@/types'

interface PlayerInFormProps {
  players: PlayerInFormType[]
}

export function PlayerInFormList({ players }: PlayerInFormProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {players.map((p, i) => (
        <div key={i} className="flex items-center gap-3 bg-surface-raised rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand/30 to-purple-500/30 flex items-center justify-center text-xl shrink-0">
            ⚽
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{p.player}</p>
            <p className="text-xs text-text-muted truncate">{p.team}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-accent-win font-semibold">⚽ {p.goalsSeason}</span>
              <span className="text-xs text-brand font-semibold">🅰 {p.assistsSeason}</span>
              <span className="text-xs text-text-muted">Últimos 5: {p.goalsLast5}G {p.assistsLast5}A</span>
            </div>
          </div>
          {p.ratingAvg !== null && (
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-accent-win tabular-nums">{p.ratingAvg.toFixed(1)}</p>
              <p className="text-2xs text-text-muted">rating</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
