// ─── TheSportsDB API Client ────────────────────────────────────────────────────
// Free tier — no API key required.
// Base URL: https://www.thesportsdb.com/api/v1/json/3/
//
// Key endpoints used:
//   eventsday.php?d=YYYY-MM-DD&s=Soccer  → all soccer events for a date
//   eventsnextleague.php?id=LEAGUE_ID    → next 15 events in a league
//   eventslast5.php?id=TEAM_ID           → last 5 events for a team
//
// No daily rate limit documented for the free tier.

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SportsDbEvent {
  idEvent:           string
  idAPIfootball:     string | null
  strTimestamp:      string | null   // UTC ISO: "2026-06-24T22:00:00" (no trailing Z)
  strEvent:          string          // "Morocco vs Haiti"
  strSport:          string          // "Soccer"
  strLeague:         string          // "FIFA World Cup"
  idLeague:          string          // "4429"
  strSeason:         string          // "2026"
  strHomeTeam:       string
  strAwayTeam:       string
  intHomeScore:      string | null   // null if not played yet
  intAwayScore:      string | null
  strStatus:         string          // "NS" | "1H" | "HT" | "2H" | "FT" | "PST" | "CANC"
  strPostponed:      string          // "yes" | "no"
  dateEvent:         string          // "YYYY-MM-DD"
  dateEventLocal:    string | null
  strTime:           string | null   // "22:00:00" (UTC)
  strTimeLocal:      string | null
  strGroup:          string | null   // "C" (World Cup group)
  intRound:          string | null
  idHomeTeam:        string
  idAwayTeam:        string
  strHomeTeamBadge:  string | null   // logo URL
  strAwayTeamBadge:  string | null
  strLeagueBadge:    string | null
  strVenue:          string | null
  strCity:           string | null
  strCountry:        string | null
  strThumb:          string | null   // match artwork
  strResult:         string | null   // "2 - 1" when finished
}

interface SdbResponse {
  events: SportsDbEvent[] | null
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

async function sdbFetch(endpoint: string): Promise<SportsDbEvent[]> {
  const url = BASE_URL + endpoint
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal:  AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ' — ' + endpoint)
  const json = (await res.json()) as SdbResponse
  return json.events ?? []
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** All soccer events for a given date (YYYY-MM-DD). Primary dashboard feed. */
export async function getEventsToday(date: string): Promise<SportsDbEvent[]> {
  return sdbFetch('/eventsday.php?d=' + date + '&s=Soccer')
}

/** Next ~15 scheduled events for a league (by TheSportsDB league ID). */
export async function getLeagueEvents(leagueId: string): Promise<SportsDbEvent[]> {
  return sdbFetch('/eventsnextleague.php?id=' + leagueId)
}

/** Last 5 events for a team (by TheSportsDB team ID). */
export async function getTeamEvents(teamId: string): Promise<SportsDbEvent[]> {
  return sdbFetch('/eventslast5.php?id=' + teamId)
}

/** Today's date in YYYY-MM-DD (UTC). */
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── League IDs (TheSportsDB) ───────────────────────────────────────────────────
// Used by DiagnosticsPage and discovery fallback.

export const SDB_LEAGUES = [
  { id: '4429', label: 'FIFA World Cup' },
  { id: '4417', label: 'UEFA Euro' },
  { id: '4418', label: 'Copa America' },
  { id: '4424', label: 'UEFA Nations League' },
  { id: '4480', label: 'UEFA Champions League' },
  { id: '4423', label: 'FIFA Club World Cup' },
  { id: '4481', label: 'UEFA Europa League' },
  { id: '4328', label: 'Premier League' },
  { id: '4335', label: 'La Liga' },
  { id: '4331', label: 'Bundesliga' },
  { id: '4332', label: 'Serie A' },
  { id: '4334', label: 'Ligue 1' },
  { id: '4344', label: 'Primeira Liga' },
] as const
