import { cn } from '@/lib/cn'
import type { Injury } from '@/types'

const severityConfig = {
  high:    { dot: 'bg-accent-loss', text: 'text-accent-loss', badge: 'bg-accent-lossBg border-accent-loss/30 text-accent-loss' },
  medium:  { dot: 'bg-accent-draw', text: 'text-accent-draw', badge: 'bg-accent-drawBg border-accent-draw/30 text-accent-draw' },
  low:     { dot: 'bg-accent-win',  text: 'text-accent-win',  badge: 'bg-accent-winBg  border-accent-win/30  text-accent-win' },
  unknown: { dot: 'bg-text-muted',  text: 'text-text-muted',  badge: 'bg-surface-raised border-surface-border text-text-muted' },
}

interface InjuryListProps {
  injuries: Injury[]
}

export function InjuryList({ injuries }: InjuryListProps) {
  if (injuries.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <span className="text-accent-win text-lg">✓</span>
        <span className="text-sm text-text-secondary">Sem lesões reportadas</span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-surface-border">
      {injuries.map((inj, i) => {
        const cfg = severityConfig[inj.severity]
        return (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{inj.player}</span>
                {inj.isKeyPlayer && (
                  <span className="text-2xs px-1 py-0.5 rounded bg-brand/10 text-brand font-bold">CHAVE</span>
                )}
              </div>
              <span className="text-xs text-text-muted">{inj.team} · {inj.type}</span>
            </div>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', cfg.badge)}>
              {inj.status}
            </span>
          </div>
        )
      })}
    </div>
  )
}
