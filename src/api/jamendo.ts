import type { Track } from '@/types/track'

const CLIENT_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID ?? 'b6747d04'
const BASE = 'https://api.jamendo.com/v3.0'

export const GENRES = [
  { id: 'electronic', label: 'Electronic', tag: 'electronic' },
  { id: 'ambient',    label: 'Ambient',    tag: 'ambient' },
  { id: 'rock',       label: 'Rock',       tag: 'rock' },
  { id: 'hiphop',     label: 'Hip-Hop',    tag: 'hiphop' },
  { id: 'jazz',       label: 'Jazz',       tag: 'jazz' },
  { id: 'classical',  label: 'Classical',  tag: 'classical' },
  { id: 'metal',      label: 'Metal',      tag: 'metal' },
  { id: 'pop',        label: 'Pop',        tag: 'pop' },
] as const

export type GenreId = typeof GENRES[number]['id']

export const THEMES = [
  { id: 'workout',  label: 'Workout',  tag: 'energetic' },
  { id: 'chill',    label: 'Chill',    tag: 'chillout' },
  { id: 'focus',    label: 'Focus',    tag: 'study' },
  { id: 'party',    label: 'Party',    tag: 'dance' },
  { id: 'sleep',    label: 'Sleep',    tag: 'sleep' },
  { id: 'morning',  label: 'Morning',  tag: 'acoustic' },
  { id: 'roadtrip', label: 'Roadtrip', tag: 'rock' },
  { id: 'romance',  label: 'Romance',  tag: 'love' },
] as const

export type ThemeId = typeof THEMES[number]['id']

function decodeHtml(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
}

/**
 * Route Jamendo storage audio URLs through our own Edge Function proxy.
 * This avoids CORS issues caused by the client_id being registered for localhost.
 * In development (localhost) the original URL is used directly.
 */
function proxyAudioUrl(src: string): string {
  if (!src || !src.includes('storage.jamendo.com')) return src
  // Only proxy when running in production (non-localhost origin)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return src
  return `/api/jamendo-audio?src=${encodeURIComponent(src)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTrack(t: any, genre: string): Track {
  return {
    id: String(t.id),
    name: decodeHtml(t.name ?? ''),
    artist: decodeHtml(t.artist_name ?? ''),
    src: proxyAudioUrl(t.audio),
    duration: t.duration ?? 0,
    coverUrl: t.image ?? undefined,
    source: 'jamendo',
    genre,
    album: t.album_name ? decodeHtml(t.album_name) : undefined,
  }
}

async function fetchByTag(tag: string, limit: number): Promise<Track[]> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    format: 'json',
    limit: String(limit),
    tags: tag,
    audioformat: 'mp32',
    imagesize: '300',
    boost: 'popularity_week',
  })
  try {
    const res = await fetch(`${BASE}/tracks/?${params}`)
    const json = await res.json()
    return (json.results ?? []).map((t: unknown) => mapTrack(t, tag))
  } catch {
    return []
  }
}

export async function fetchGenreQueue(genre: GenreId, limit = 20): Promise<Track[]> {
  const tag = GENRES.find((g) => g.id === genre)?.tag ?? genre
  return fetchByTag(tag, limit)
}

export async function fetchThemeQueue(themeId: ThemeId, limit = 20): Promise<Track[]> {
  const tag = THEMES.find((t) => t.id === themeId)?.tag ?? themeId
  return fetchByTag(tag, limit)
}
