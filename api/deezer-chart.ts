export const config = {
  runtime: 'nodejs18.x',
}

export default async function handler(req: any, res: any) {
  const { genreId, limit = 30 } = req.query

  if (!genreId) {
    return res.status(400).json({ error: 'genreId required' })
  }

  try {
    const response = await fetch(
      `https://api.deezer.com/chart/${genreId}/tracks?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Aurora/1.0',
        },
      }
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Deezer API error' })
    }

    const data = await response.json()
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(data)
  } catch (error) {
    console.error('Deezer API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
