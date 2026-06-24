import { cn } from '@/lib/cn'
import { formatPct } from '@/lib/format'
import type { MarketPerformance } from '@/types'

const marketLabels: Record<string, string> = {
  BTTS:          'Ambas Marcam',
  OVER_25:       'Over 2.5 Golos',
  '1X2':         'Resultado Final',
  DOUBLE_CHANCE: 'Dupla Hipótese',
  MULTIPLE:      'Combinadas',
}

interface MarketTableProps {
  data: MarketPerformance[]
}

export function MarketTable({ data }: MarketTableProps) {
  const sorted = [...data].sort((a, b) => b.accuracyRate - a.accuracyRate)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {['Mercado', 'Total', 'WIN', 'LOSS', 'Acerto', 'ROI'].map(h => (
              <th key={h} className="text-left py-2.5 px-3 text-2xs font-bold text-text-muted uppercase tracking-wider first:pl-0 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const roiPositive = row.roi >= 0
            return (
              <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-raised/50 transition-colors">
                <td className="py-3 font-semibold text-text-primary">
                  {marketLabels[row.market] ?? row.market}
                </td>
                <td className="py-3 px-3 text-text-secondary tabular-nums">{row.total}</td>
                <td className="py-3 px-3 text-accent-win font-bold tabular-nums">{row.wins}</td>
                <td className="py-3 px-3 text-accent-loss font-bold tabular-nums">{row.losses}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', row.accuracyRate >= 0.6 ? 'bg-accent-win' : row.accuracyRate >= 0.5 ? 'bg-accent-draw' : 'bg-accent-loss')}
                        style={{ width: `${row.accuracyRate * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-text-primary">
                      {formatPct(row.accuracyRate)}
                    </span>
                  </div>
                </td>
                <td className={cn('py-3 px-3 text-right font-bold font-mono tabular-nums', roiPositive ? 'text-accent-win' : 'text-accent-loss')}>
                  {roiPositive ? '+' : ''}{row.roi.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
