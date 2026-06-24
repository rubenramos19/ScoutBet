import { useState } from 'react'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { ConfidenceBar } from '@/components/ui/ConfidenceBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { MultipleSuggestion } from '@/types'

const strategyConfig = {
  CONSERVATIVE: { label: 'Segura 🛡️',    variant: 'win'    as const },
  VALUE:        { label: 'Valor 💎',      variant: 'blue'   as const },
  AGGRESSIVE:   { label: 'Agressiva 🔥', variant: 'default' as const },
  RASPADINHA:   { label: 'Raspadinha 🎰', variant: 'purple' as const },
}

interface MultipleCardProps {
  multiple: MultipleSuggestion
}

export function MultipleCard({ multiple }: MultipleCardProps) {
  const [saved, setSaved] = useState(false)
  const cfg = strategyConfig[multiple.strategy]

  return (
    <Card className="animate-fade-in">
      <CardBody>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            {multiple.strategy === 'RASPADINHA' && (
              <Badge variant="purple" size="sm">ALTO RISCO</Badge>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xs text-text-muted">ODD TOTAL</p>
            <p className="text-2xl font-black text-accent-draw font-mono tabular-nums">
              {multiple.totalOdd.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Selections */}
        <div className="space-y-2 mb-4">
          {multiple.selections.map((sel, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface-raised rounded-lg px-3 py-2.5">
              <div className="w-5 h-5 rounded-full bg-surface-border flex items-center justify-center text-2xs font-black text-text-muted shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xs text-text-muted truncate">{sel.gameLabel}</p>
                <p className="text-xs font-bold text-text-primary truncate">{sel.pick}</p>
              </div>
              <span className="text-xs font-bold font-mono text-accent-draw shrink-0">
                {sel.odd.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Reasoning */}
        <div className="bg-brand/5 border border-brand/10 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-xs text-text-secondary leading-relaxed">💡 {multiple.reasoning}</p>
        </div>

        {multiple.strategy === 'RASPADINHA' && (
          <div className="bg-accent-lossBg border border-accent-loss/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-accent-loss">
              ⚠ Stake máxima: 1% da banca. Capital de diversão — não estratégia principal.
            </p>
          </div>
        )}

        {/* Confidence */}
        <ConfidenceBar value={multiple.confidence} />
      </CardBody>
      <CardFooter className="flex items-center justify-end">
        <Button
          variant={saved ? 'win' : 'secondary'}
          size="sm"
          onClick={() => setSaved(s => !s)}
        >
          {saved ? '✓ Guardado' : '+ Guardar Combinada'}
        </Button>
      </CardFooter>
    </Card>
  )
}
