import { useState, useEffect } from 'react'
import { BookmarkPlus, Check } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfidenceBar } from '@/components/ui/ConfidenceBar'
import { OddBadge } from '@/components/ui/OddBadge'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { betService } from '@/services/betService'
import { bankrollService } from '@/services/bankrollService'
import { storage, STORAGE_KEYS } from '@/lib/storage'
import type { BankrollConfig } from '@/types'

interface BetRecommendationProps {
  market:     string
  pick:       string
  odd:        number
  confidence: number
  reasoning:  string
  gameId:     string
  gameLabel:  string
  league:     string
  matchDate:  string
}

const marketLabels: Record<string, string> = {
  '1X2':          'Resultado Final',
  'BTTS':         'Ambas Marcam',
  'OVER_25':      'Over 2.5 Golos',
  'UNDER_25':     'Under 2.5 Golos',
  'DOUBLE_CHANCE':'Dupla Hipótese',
  'HALF_TIME':    'Resultado Intervalo',
}

export function BetRecommendation({
  market, pick, odd, confidence, reasoning,
  gameId, gameLabel, league, matchDate,
}: BetRecommendationProps) {
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [stake,   setStake]   = useState<number | null>(null)

  useEffect(() => {
    setSaved(betService.isPickSaved(gameId, market))
    // Calculate stake preview
    const cfg = storage.get<BankrollConfig>(STORAGE_KEYS.BANKROLL)
    if (cfg) {
      const { stakeCents } = bankrollService.calculateFlatStake(
        cfg.currentAmountCents, cfg.riskProfile, confidence,
      )
      setStake(stakeCents)
    }
  }, [gameId, market, confidence])

  async function handleSave() {
    if (saved || saving) return
    setSaving(true)
    storage.get<BankrollConfig>(STORAGE_KEYS.BANKROLL)
    await betService.savePick({
      gameId,
      gameLabel,
      league,
      matchDate,
      market:        market as any,
      pick,
      oddPredicted:  odd,
      confidence,
      reasoning,
      stakeEuroCents: stake,
    })
    setSaved(true)
    setSaving(false)
  }

  return (
    <Card className={cn('transition-all duration-200', saved && 'border-accent-win/30')}>
      <CardBody className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="blue" size="sm">{marketLabels[market] ?? market}</Badge>
          </div>
          <h3 className="text-base font-black text-text-primary mb-1">{pick}</h3>
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            💡 {reasoning}
          </p>
          <ConfidenceBar value={confidence} size="sm" className="max-w-48" />
          {stake && !saved && (
            <p className="text-xs text-text-muted mt-2">
              Stake sugerida: <span className="text-accent-win font-bold">€{(stake / 100).toFixed(2)}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <OddBadge odd={odd} size="lg" />
          <Button
            variant={saved ? 'win' : 'secondary'}
            size="sm"
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saved
              ? <><Check size={12} /> Guardado</>
              : saving
                ? '...'
                : <><BookmarkPlus size={12} /> Guardar</>
            }
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
