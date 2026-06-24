import type { HistoryEntry, MarketPerformance } from '@/types'

export const MOCK_HISTORY: HistoryEntry[] = [
  { id:'h-1', date:'2026-06-23T19:00:00Z', gameLabel:'PSG vs Monaco', league:'Ligue 1', market:'BTTS', pick:'Ambas Marcam: Sim', oddPredicted:1.72, oddPlaced:1.72, stakeEuroCents:2000, outcome:'WIN', profitLossEuroCents:1440, confidence:78 },
  { id:'h-2', date:'2026-06-23T16:30:00Z', gameLabel:'Man City vs Tottenham', league:'Premier League', market:'1X2', pick:'Man City Vence', oddPredicted:1.55, oddPlaced:1.55, stakeEuroCents:2000, outcome:'WIN', profitLossEuroCents:1100, confidence:82 },
  { id:'h-3', date:'2026-06-22T20:00:00Z', gameLabel:'Ajax vs PSV', league:'Eredivisie', market:'OVER_25', pick:'Mais de 2.5 Golos', oddPredicted:1.65, oddPlaced:1.65, stakeEuroCents:1500, outcome:'WIN', profitLossEuroCents:975, confidence:71 },
  { id:'h-4', date:'2026-06-22T17:00:00Z', gameLabel:'Atletico vs Sevilla', league:'La Liga', market:'1X2', pick:'Atlético Vence', oddPredicted:1.90, oddPlaced:1.90, stakeEuroCents:2000, outcome:'LOSS', profitLossEuroCents:-2000, confidence:65 },
  { id:'h-5', date:'2026-06-21T20:45:00Z', gameLabel:'Milan vs Roma', league:'Serie A', market:'BTTS', pick:'Ambas Marcam: Sim', oddPredicted:1.80, oddPlaced:1.80, stakeEuroCents:1500, outcome:'WIN', profitLossEuroCents:1200, confidence:74 },
  { id:'h-6', date:'2026-06-21T15:00:00Z', gameLabel:'Brighton vs Everton', league:'Premier League', market:'1X2', pick:'Brighton Vence', oddPredicted:1.70, oddPlaced:1.70, stakeEuroCents:2000, outcome:'WIN', profitLossEuroCents:1400, confidence:70 },
  { id:'h-7', date:'2026-06-20T20:00:00Z', gameLabel:'Bayer Leverkusen vs Freiburg', league:'Bundesliga', market:'1X2', pick:'Leverkusen Vence', oddPredicted:1.45, oddPlaced:1.45, stakeEuroCents:2500, outcome:'WIN', profitLossEuroCents:1125, confidence:85 },
  { id:'h-8', date:'2026-06-20T18:00:00Z', gameLabel:'Villarreal vs Athletic', league:'La Liga', market:'DOUBLE_CHANCE', pick:'1X', oddPredicted:1.35, oddPlaced:1.35, stakeEuroCents:3000, outcome:'LOSS', profitLossEuroCents:-3000, confidence:62 },
  { id:'h-9', date:'2026-06-19T20:45:00Z', gameLabel:'Chelsea vs Newcastle', league:'Premier League', market:'OVER_25', pick:'Mais de 2.5 Golos', oddPredicted:1.90, oddPlaced:1.90, stakeEuroCents:1500, outcome:'WIN', profitLossEuroCents:1350, confidence:66 },
  { id:'h-10', date:'2026-06-19T15:00:00Z', gameLabel:'Lens vs Marseille', league:'Ligue 1', market:'BTTS', pick:'Ambas Marcam: Sim', oddPredicted:1.85, oddPlaced:null, stakeEuroCents:null, outcome:'WIN', profitLossEuroCents:null, confidence:72 },
  { id:'h-11', date:'2026-06-18T20:00:00Z', gameLabel:'Porto vs Sporting', league:'Liga Portugal', market:'1X2', pick:'Porto Vence', oddPredicted:2.10, oddPlaced:2.10, stakeEuroCents:1000, outcome:'LOSS', profitLossEuroCents:-1000, confidence:58 },
  { id:'h-12', date:'2026-06-18T17:30:00Z', gameLabel:'Wolves vs Aston Villa', league:'Premier League', market:'1X2', pick:'Aston Villa Vence', oddPredicted:1.95, oddPlaced:1.95, stakeEuroCents:2000, outcome:'WIN', profitLossEuroCents:1900, confidence:69 },
  { id:'h-13', date:'2026-06-17T20:45:00Z', gameLabel:'Lazio vs Napoli', league:'Serie A', market:'BTTS', pick:'Ambas Marcam: Sim', oddPredicted:1.75, oddPlaced:1.75, stakeEuroCents:2000, outcome:'VOID', profitLossEuroCents:0, confidence:70 },
  { id:'h-14', date:'2026-06-17T18:30:00Z', gameLabel:'Dortmund vs Hoffenheim', league:'Bundesliga', market:'OVER_25', pick:'Mais de 2.5 Golos', oddPredicted:1.60, oddPlaced:1.60, stakeEuroCents:2000, outcome:'WIN', profitLossEuroCents:1200, confidence:76 },
]

export const MOCK_MARKET_PERFORMANCE: MarketPerformance[] = [
  { market:'BTTS',          total:28, wins:20, losses:6,  voids:2, accuracyRate:0.769, roi:18.4, profitLossEuroCents:820000 },
  { market:'OVER_25',       total:22, wins:14, losses:8,  voids:0, accuracyRate:0.636, roi:9.2,  profitLossEuroCents:380000 },
  { market:'1X2',           total:35, wins:20, losses:15, voids:0, accuracyRate:0.571, roi:4.8,  profitLossEuroCents:240000 },
  { market:'DOUBLE_CHANCE', total:12, wins:7,  losses:5,  voids:0, accuracyRate:0.583, roi:3.1,  profitLossEuroCents:110000 },
  { market:'MULTIPLE',      total:8,  wins:2,  losses:6,  voids:0, accuracyRate:0.250, roi:-42,  profitLossEuroCents:-840000 },
]
