/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API-Football key from RapidAPI / api-sports.io */
  readonly VITE_API_FOOTBALL_KEY: string
  /** Set to "true" to force mock data regardless of API key */
  readonly VITE_USE_MOCK: string
  /** Current football season year, e.g. "2024" */
  readonly VITE_FOOTBALL_SEASON: string
  /**
   * Comma-separated league IDs to watch.
   * Defaults: 2=UCL, 3=UEL, 39=PL, 140=LaLiga, 78=Bundesliga, 135=SerieA, 61=Ligue1, 94=Primeira
   */
  readonly VITE_WATCHED_LEAGUES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
