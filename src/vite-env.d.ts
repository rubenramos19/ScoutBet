/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API-Football key (legacy) */
  readonly VITE_API_FOOTBALL_KEY: string
  /** Set to "true" to force mock data */
  readonly VITE_USE_MOCK: string
  /** Current football season year */
  readonly VITE_FOOTBALL_SEASON: string
  /** Comma-separated league IDs */
  readonly VITE_WATCHED_LEAGUES: string
  /**
   * RapidAPI key for SofaScore.
   * https://rapidapi.com/search/sofascore
   * Set in .env: VITE_RAPIDAPI_KEY=your_key_here
   */
  readonly VITE_RAPIDAPI_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
