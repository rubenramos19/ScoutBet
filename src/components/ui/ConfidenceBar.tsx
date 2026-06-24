import { cn } from '@/lib/cn'
import { confidenceColor } from '@/lib/format'

interface ConfidenceBarProps {
  value: number  // 0–100
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const colorClasses = {
  green: 'bg-accent-win',
  amber: 'bg-accent-draw',
  red:   'bg-accent-loss',
}

const textColorClasses = {
  green: 'text-accent-win',
  amber: 'text-accent-draw',
  red:   'text-accent-loss',
}

export function ConfidenceBar({ value, showLabel = true, size = 'md', className }: ConfidenceBarProps) {
  const color = confidenceColor(value)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex-1 bg-surface-raised rounded-full overflow-hidden',
        size === 'sm' ? 'h-1' : 'h-1.5',
      )}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClasses[color])}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('font-bold tabular-nums text-xs shrink-0', textColorClasses[color])}>
          {value}%
        </span>
      )}
    </div>
  )
}

/** Circular score display used on sidebar game cards */
export function ScoreRing({ value, size = 32 }: { value: number; size?: number }) {
  const color = confidenceColor(value)
  const stroke = 3
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ

  const strokeColor = color === 'green' ? '#22C55E' : color === 'amber' ? '#F59E0B' : '#EF4444'
  const textColor = strokeColor

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1E2A3A" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={strokeColor} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-black tabular-nums"
        style={{ fontSize: size * 0.28, color: textColor }}
      >
        {value}
      </span>
    </div>
  )
}
