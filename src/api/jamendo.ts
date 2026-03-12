import type { Track } from '@/types/track'

const CLIENT_ID = '3daa4c49'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTrack(t: any, genre: string): Track {
  return {
    id: String(t.id),
    name: t.name,
    artist: t.artist_name,
    src: t.audio,
    duration: t.duration ?? 0,
    coverUrl: t.image ?? undefined,
    source: 'jamendo',
    genre,
  }
}

export async function fetchGenreQueue(genre: GenreId, limit = 20): Promise<Track[]> {
  const tag = GENRES.find((g) => g.id === genre)?.tag ?? genre
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    format: 'json',
    limit: String(limit),
    tags: tag,
    audioformat: 'mp3',
    imagesize: '300',
    boost: 'popularity_week',
  })
  try {
    const res = await fetch(`${BASE}/tracks/?${params}`)
    const json = await res.json()
    return (json.results ?? []).map((t: unknown) => mapTrack(t, genre))
  } catch {
    return []
  }
}
