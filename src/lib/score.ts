// ─── Data Quality Score ───────────────────────────────────────────────────────
// IMPORTANT: this is a DATA QUALITY score (0–100), NOT a win probability.
// It answers "how complete and reliable is our data for this game?"
//
// Sprint 3: all stats fields are now number | null.
// Missing data → 0 pts for that component (not a fake average).

import type { Game, ScoreBreakdown } from '@/types'

interface ScoreResult {
  total: number
  breakdown: ScoreBreakdown
}

const clamp = (v: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, v))

export function calculateDataQualityScore(game: Game): ScoreResult {
  const home = game.homeTeamStats
  const away = game.awayTeamStats

  // 1. Form data completeness (25 pts)
  const homeForm = home.formLast5.length >= 5 ? 1 : home.formLast5.length / 5
  const awayForm = away.formLast5.length >= 5 ? 1 : away.formLast5.length / 5
  const formScore = ((homeForm + awayForm) / 2) * 25

  // 2. Goals data quality (15 pts) — 0 pts when data missing
  const goalScore = (home.goalsForAvg != null && away.goalsForAvg != null)
    ? clamp(((home.goalsForAvg + away.goalsForAvg) / 2) / 3.0, 0, 1) * 15
    : 0

  // 3. Defensive data quality (10 pts)
  const defScore = (home.goalsAgainstAvg != null && away.goalsAgainstAvg != null)
    ? clamp((3.0 - (home.goalsAgainstAvg + away.goalsAgainstAvg) / 2) / 3.0, 0, 1) * 10
    : 0

  // 4. Venue advantage clarity (10 pts) — neutral 5 pts when unavailable
  const venueScore = (home.homeWinPct != null && away.awayWinPct != null)
    ? clamp(((home.homeWinPct - away.awayWinPct) + 50) / 100, 0, 1) * 10
    : 5

  // 5. H2H data completeness (15 pts)
  const h2h      = game.h2h
  const h2hTotal = h2h.homeWins + h2h.draws + h2h.awayWins
  const h2hDepth = h2hTotal > 0 ? Math.min(h2hTotal / 5, 1) : 0
  const h2hGoals = h2h.avgTotalGoals != null ? clamp(h2h.avgTotalGoals / 4, 0, 1) : 0
  const h2hScore = h2hDepth * 10 + h2hGoals * 5

  // 6. Injury data (15 pts — penalty per key player out)
  const keyInjuries    = game.injuries.filter(i => i.isKeyPlayer)
  const injuryPenalty  = keyInjuries.reduce(
    (acc, inj) => acc + (inj.severity === 'high' ? 4 : inj.severity === 'medium' ? 2 : 1), 0
  )
  const injuryScore = clamp(15 - injuryPenalty, 0, 15)

  // 7. Motivation placeholder (10 pts) — neutral until standings available (Sprint 5)
  const motivationScore = 7

  const total = Math.round(
    formScore + goalScore + defScore + venueScore +
    h2hScore  + injuryScore + motivationScore
  )

  return {
    total: clamp(total, 0, 100),
    breakdown: {
      form:       Math.round(formScore),
      goals:      Math.round(goalScore),
      defense:    Math.round(defScore),
      venue:      Math.round(venueScore),
      h2h:        Math.round(h2hScore),
      injuries:   Math.round(injuryScore),
      motivation: motivationScore,
      total:      clamp(total, 0, 100),
    },
  }
}

// ── Rule-based confidence ─────────────────────────────────────────────────────
// Returns 50 (max uncertainty) when real data is unavailable.
// 50 is explicit "no information" — distinguishable from data-backed estimates.

export function ruleBasedConfidence(market: string, game: Game): number {
  const stats = game.stats
  switch (market) {
    case 'BTTS':
      return stats.bttsPct    != null ? Math.round(clamp(stats.bttsPct,    0, 100)) : 50
    case 'OVER_25':
      return stats.over25Pct  != null ? Math.round(clamp(stats.over25Pct,  0, 100)) : 50
    case '1X2':
      return stats.homeWinPct != null ? Math.round(clamp(stats.homeWinPct, 0, 100)) : 50
    default:
      return 50
  }
}
