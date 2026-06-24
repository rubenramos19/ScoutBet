interface StatBarProps {
  label: string
  value: number | string
  pct?: number   // 0–100, controls bar fill
  color?: string // tailwind bg class
}

export function StatBar({ label, value, pct = 0, color = 'bg-brand' }: StatBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-bold text-text-primary tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}
