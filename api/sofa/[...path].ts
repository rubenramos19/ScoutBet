// Vercel serverless proxy for api.sofascore.com
// Route: /api/sofa/*  →  https://api.sofascore.com/api/v1/*
// Bypasses CORS — browser calls /api/sofa/..., Vercel proxies server-side

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSegments = (req.query.path as string[] | undefined) ?? []
  const upstreamPath = '/' + pathSegments.join('/')
  const query = { ...req.query }
  delete query.path
  const qs = new URLSearchParams(query as Record<string, string>).toString()
  const url = `https://api.sofascore.com/api/v1${upstreamPath}${qs ? '?' + qs : ''}`

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.sofascore.com/',
        'Accept': 'application/json',
      },
    })

    if (upstream.status === 204) {
      return res.status(204).end()
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: upstream.statusText })
    }

    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
