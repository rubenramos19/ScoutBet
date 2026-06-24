// ─── Formatting Utilities ─────────────────────────────────────────────────────
// All dates assumed UTC in storage; displayed in Europe/Lisbon (audit A-03).

import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'

/** Format an ISO UTC string to local time HH:mm */
export function formatTime(isoUtc: string): string {
  try {
    const d = parseISO(isoUtc)
    return format(d, 'HH:mm', { locale: pt })
  } catch {
    return '--:--'
  }
}

/** Format an ISO UTC string to a human-readable date */
export function formatDate(isoUtc: string): string {
  try {
    const d = parseISO(isoUtc)
    if (isToday(d))     return 'Hoje'
    if (isTomorrow(d))  return 'Amanhã'
    if (isYesterday(d)) return 'Ontem'
    return format(d, "d 'de' MMM", { locale: pt })
  } catch {
    return '—'
  }
}

/** Format integer euro-cents as a currency string: 10050 → "€100.50" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** Format a P&L value with sign and colour class hint */
export function formatPL(cents: number): { text: string; positive: boolean } {
  const positive = cents >= 0
  const text = (positive ? '+' : '') + formatCents(cents)
  return { text, positive }
}

/** Format an odd to 2 decimal places */
export function formatOdd(odd: number): string {
  return odd.toFixed(2)
}

/** Format a percentage: 0.724 → "72.4%" */
export function formatPct(ratio: number, decimals = 1): string {
  return (ratio * 100).toFixed(decimals) + '%'
}

/** Format a direct percentage number: 72 → "72%" */
export function formatPctNum(pct: number, decimals = 0): string {
  return pct.toFixed(decimals) + '%'
}

/** Return colour token name based on confidence 0–100 */
export function confidenceColor(confidence: number): 'green' | 'amber' | 'red' {
  if (confidence >= 75) return 'green'
  if (confidence >= 60) return 'amber'
  return 'red'
}

/** Return Tailwind text colour class for confidence */
export function confidenceTextClass(confidence: number): string {
  const c = confidenceColor(confidence)
  return c === 'green' ? 'text-accent-win'
       : c === 'amber' ? 'text-accent-draw'
       : 'text-accent-loss'
}

/** Map BetOutcome to display label and colour class */
export function outcomeDisplay(outcome: 'WIN' | 'LOSS' | 'VOID' | 'PUSH'): {
  label: string
  textClass: string
  bgClass: string
} {
  switch (outcome) {
    case 'WIN':  return { label: 'WIN',  textClass: 'text-accent-win',  bgClass: 'bg-accent-winBg' }
    case 'LOSS': return { label: 'LOSS', textClass: 'text-accent-loss', bgClass: 'bg-accent-lossBg' }
    case 'VOID': return { label: 'VOID', textClass: 'text-text-muted',  bgClass: 'bg-surface-raised' }
    case 'PUSH': return { label: 'PUSH', textClass: 'text-accent-draw', bgClass: 'bg-accent-drawBg' }
  }
}
