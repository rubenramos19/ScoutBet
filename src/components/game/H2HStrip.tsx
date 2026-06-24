import type { H2HResult } from '@/types'

const config: Record<H2HResult, { label: string; classes: string }> = {
  H: { label: 'C', classes: 'bg-accent-winBg  text-accent-win  border-accent-win/30' },
  A: { label: 'F', classes: 'bg-accent-lossBg text-accent-loss border-accent-loss/30' },
  D: { label: 'E', classes: 'bg-accent-drawBg text-accent-draw border-accent-draw/30' },
}

interface H2HStripProps {
  results: H2HResult[]
  homeTeam: string
  awayTeam: string
}

export function H2HStrip({ results, homeTeam, awayTeam }: H2HStripProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">C = {homeTeam} venceu · F = {awayTeam} venceu · E = Empate</span>
      </div>
      <div className="flex items-center gap-2">
        {results.map((r, i) => {
          const { label, classes } = config[r]
          return (
            <div key={i} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black ${classes}`}>
              {label}
            </div>
          )
        })}
        <span className="ml-2 text-xs text-text-muted">(mais recente →)</span>
      </div>
    </div>
  )
}
