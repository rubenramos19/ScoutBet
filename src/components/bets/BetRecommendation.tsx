import { useState } from 'react'
import { BookmarkPlus, BookmarkCheck } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfidenceBar } from '@/components/ui/ConfidenceBar'
import { OddBadge } from '@/components/ui/OddBadge'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

interface BetRecommendationProps {
  market: string
  pick: string
  odd: number
  confidence: number
  reasoning: string
  gameLabel?: string
}

const marketLabels: Record<string, string> = {
  '1X2': 'Resultado Final',
  'BTTS': 'Ambas Marcam',
  'OVER_25': 'Over 2.5 Golos',
  'UNDER_25': 'Under 2.5 Golos',
  'DOUBLE_CHANCE': 'Dupla Hipótese',
  'HALF_TIME': 'Resultado Intervalo',
}

export function BetRecommendation({ market, pick, odd, confidence, reasoning, gameLabel }: BetRecommendationProps) {
  const [saved, setSaved] = useState(false)

  return (
    <Card className={cn('transition-all duration-200', saved && 'border-accent-win/30')}>
      <CardBody className="flex items-start gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="blue" size="sm">{marketLabels[market] ?? market}</Badge>
            {gameLabel && <span className="text-2xs text-text-muted">{gameLabel}</span>}
          </div>
          <h3 className="text-base font-black text-text-primary mb-2">{pick}</h3>
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            💡 {reasoning}
          </p>
          <ConfidenceBar value={confidence} size="sm" className="max-w-48" />
        </div>

        {/* Odd + action */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <OddBadge odd={odd} size="lg" />
          <Button
            variant={saved ? 'win' : 'secondary'}
            size="sm"
            onClick={() => setSaved(s => !s)}
          >
            {saved ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
