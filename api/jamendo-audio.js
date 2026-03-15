/**
 * Vercel Edge Function: Jamendo audio proxy
 *
 * Proxies Jamendo storage audio streams through our own domain so the browser
 * never makes a cross-origin request to prod-N.storage.jamendo.com.
 *
 * Usage: /api/jamendo-audio?src=ENCODED_JAMENDO_AUDIO_URL
 */
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const src = searchParams.get('src')

  if (!src || !src.includes('jamendo.com')) {
    return new Response('Missing or invalid src', { status: 400 })
  }

  // Forward Range header so HTML5 audio seek works correctly
  const upstreamHeaders = {}
  const range = req.headers.get('range')
  if (range) upstreamHeaders['range'] = range

  let upstream
  try {
    upstream = await fetch(src, { headers: upstreamHeaders })
  } catch {
    return new Response('Failed to fetch audio', { status: 502 })
  }

  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')

  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}
