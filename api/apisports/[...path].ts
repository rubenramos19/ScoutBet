import type { VercelRequest, VercelResponse } from '@vercel/node'
import https from 'https'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.VITE_API_FOOTBALL_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'VITE_API_FOOTBALL_KEY not set' })
  }

  const pathParam = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path ?? ''
  const queryParams = { ...req.query }
  delete queryParams.path

  const qs = new URLSearchParams(
    Object.entries(queryParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ''])
  ).toString()

  const targetUrl = `https://v3.football.api-sports.io/${pathParam}${qs ? '?' + qs : ''}`

  const upstream = await fetch(targetUrl, {
    headers: {
      'x-apisports-key': apiKey,
      'Accept': 'application/json',
    },
  })

  const body = await upstream.text()
  res.status(upstream.status)
    .setHeader('Content-Type', 'application/json')
    .send(body)
}
