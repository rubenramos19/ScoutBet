// ─── Data Quality Score ───────────────────────────────────────────────────────
// IMPORTANT (audit S-02): this is a DATA QUALITY score (0–100), NOT a
// probability. It answers "how complete/reliable is our data for this game?"
// Probability estimation is deferred to Sprint 6 (motor de probabilidade).
//
// Weights are placeholders — Sprint 6 backtesting will validate and adjust.

import type { Game, ScoreBreakdown } from '@/types'

interface ScoreResult {
  total: number
  breakdown: ScoreBreakdown
}

/** Clamp a value to [min, max] */
const clamp = (v: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, v))

export function calculateDataQualityScore(game: Game): ScoreResult {
  const home = game.homeTeamStats
  const away = game.awayTeamStats

  // 1. Form data completeness (25 pts)
  const homeFormComplete = home.formLast5.length >= 5 ? 1 : home.formLast5.length / 5
  const awayFormComplete = away.formLast5.length >= 5 ? 1 : away.formLast5.length / 5
  const formScore = ((homeFormComplete + awayFormComplete) / 2) * 25

  // 2. Goals data quality (15 pts)
  const avgGoals = (home.goalsForAvg + away.goalsForAvg) / 2
  const goalScore = clamp(avgGoals / 3.0, 0, 1) * 15

  // 3. Defensive data quality (10 pts)
  const avgAgainst = (home.goalsAgainstAvg + away.goalsAgainstAvg) / 2
  const defScore = clamp((3.0 - avgAgainst) / 3.0, 0, 1) * 10

  // 4. Venue data quality (10 pts)
  const homeDominance = home.homeWinPct - away.awayWinPct
  const venueScore = clamp((homeDominance + 50) / 100, 0, 1) * 10

  // 5. H2H data completeness (15 pts)
  const h2hComplete = game.h2h.last5.length >= 5 ? 1 : game.h2h.last5.length / 5
  const h2hGoalQuality = clamp(game.h2h.avgTotalGoals / 4, 0, 1)
  const h2hScore = h2hComplete * 10 + h2hGoalQuality * 5

  // 6. Injury data quality (15 pts — penalise missing key players)
  const keyPlayerInjuries = game.injuries.filter(i => i.isKeyPlayer)
  const injuryPenalty = keyPlayerInjuries.reduce((acc, inj) => {
    return acc + (inj.severity === 'high' ? 4 : inj.severity === 'medium' ? 2 : 1)
  }, 0)
  const injuryScore = clamp(15 - injuryPenalty, 0, 15)

  // 7. Motivation placeholder (10 pts) — Sprint 3 will use standings data
  const motivationScore = 7  // neutral default until standings API (audit S-03)

  const total = Math.round(
    formScore + goalScore + defScore + venueScore +
    h2hScore + injuryScore + motivationScore
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

/** Simple rule-based confidence for a bet type (NOT Kelly input — audit K-01) */
export function ruleBasedConfidence(
  market: string,
  game: Game,
): number {
  const stats = game.stats
  switch (market) {
    case 'BTTS':
      return Math.round(clamp(stats.bttsPct, 0, 100))
    case 'OVER_25':
      return Math.round(clamp(stats.over25Pct, 0, 100))
    case '1X2':
      return Math.round(clamp(stats.homeWinPct, 0, 100))
    default:
      return 55
  }
}
