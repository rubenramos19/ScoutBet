// Vercel serverless proxy for api.football-data.org
// Route: /api/fd/*  →  https://api.football-data.org/v4/*

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSegments = (req.query.path as string[] | undefined) ?? []
  const upstreamPath = '/' + pathSegments.join('/')
  const query = { ...req.query }
  delete query.path
  const qs = new URLSearchParams(query as Record<string, string>).toString()
  const url = `https://api.football-data.org/v4${upstreamPath}${qs ? '?' + qs : ''}`

  const token = process.env.VITE_FOOTBALL_DATA_TOKEN ?? ''

  try {
    const upstream = await fetch(url, {
      headers: {
        'X-Auth-Token': token,
        'Accept': 'application/json',
      },
    })

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '')
      return res.status(upstream.status).json({ error: upstream.statusText, detail: body.slice(0, 200) })
    }

    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
