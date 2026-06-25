import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const afKey   = env.VITE_API_FOOTBALL_KEY ?? ''
  const fdToken = env.VITE_FOOTBALL_DATA_TOKEN ?? ''

  const mask = (k: string) =>
    k.length >= 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : k ? '(too short)' : '(empty)'

  console.log('[vite.config] api-sports key:', mask(afKey))
  console.log('[vite.config] football-data token:', mask(fdToken))

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/apisports': {
          target: 'https://v3.football.api-sports.io',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/apisports/, ''),
          headers: { 'x-apisports-key': afKey },
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              const full = `https://v3.football.api-sports.io${proxyReq.path}`
              console.log(`[proxy -> api-sports] key: ${mask(afKey)} | URL: ${full}`)
            })
            proxy.on('proxyRes', (proxyRes) => {
              console.log(`[proxy <- api-sports] status: ${proxyRes.statusCode}`)
            })
            proxy.on('error', (err) => {
              console.error('[proxy api-sports error]', err.message)
            })
          },
        },
        '/api/fd': {
          target: 'https://api.football-data.org/v4',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/fd/, ''),
          headers: {
            'X-Auth-Token': fdToken,
            'Accept': 'application/json',
          },
        },
      },
    },
  }
})
