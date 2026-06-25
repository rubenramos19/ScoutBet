import type { PlayerInForm as PlayerInFormType } from '@/types'

interface PlayerInFormProps {
  players: PlayerInFormType[]
}

export function PlayerInFormList({ players }: PlayerInFormProps) {
  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="text-2xl">🔒</span>
        <p className="text-sm text-text-muted">Dados de jogadores não disponíveis</p>
        <p className="text-xs text-text-muted/60 max-w-xs leading-relaxed">
          A API ESPN pública não fornece estatísticas individuais de jogadores.
        </p>
      </div>
    )
  }
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
              {p.goalsSeason != null && (
                <span className="text-xs text-accent-win font-semibold">⚽ {p.goalsSeason}</span>
              )}
              {p.assistsSeason != null && (
                <span className="text-xs text-brand font-semibold">🅰 {p.assistsSeason}</span>
              )}
              {(p.goalsLast5 != null || p.assistsLast5 != null) && (
                <span className="text-xs text-text-muted">
                  Ult. 5: {p.goalsLast5 ?? '—'}G {p.assistsLast5 ?? '—'}A
                </span>
              )}
              {p.position && (
                <span className="text-xs text-text-muted">{p.position}</span>
              )}
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
