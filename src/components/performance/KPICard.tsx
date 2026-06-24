import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'

interface KPICardProps {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  accent?: 'default' | 'green' | 'red' | 'amber'
  note?: string
}

const accentClasses = {
  default: 'text-text-primary',
  green:   'text-accent-win',
  red:     'text-accent-loss',
  amber:   'text-accent-draw',
}

export function KPICard({ label, value, delta, trend, accent = 'default', note }: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendClass = trend === 'up' ? 'text-accent-win' : trend === 'down' ? 'text-accent-loss' : 'text-text-muted'

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{label}</p>
      <p className={cn('text-3xl font-black tabular-nums tracking-tight', accentClasses[accent])}>
        {value}
      </p>
      {(delta || note) && (
        <div className="flex items-center gap-1.5 mt-2">
          {delta && <TrendIcon size={12} className={trendClass} />}
          {delta && <span className={cn('text-xs font-semibold', trendClass)}>{delta}</span>}
          {note && <span className="text-xs text-text-muted">{note}</span>}
        </div>
      )}
    </div>
  )
}
