import type { Track } from '@/types/track'

// Use Vercel serverless functions to proxy Deezer API (avoids CORS issues)
const BASE = '/api'

export const GENRES = [
  { id: 'electro',    label: 'Electro',    deezerId: 106 },
  { id: 'dance',      label: 'Dance',      deezerId: 113 },
  { id: 'hiphop',     label: 'Hip-Hop',    deezerId: 116 },
  { id: 'pop',        label: 'Pop',        deezerId: 132 },
  { id: 'rock',       label: 'Rock',       deezerId: 152 },
  { id: 'rnb',        label: 'R&B',        deezerId: 165 },
  { id: 'jazz',       label: 'Jazz',       deezerId: 129 },
  { id: 'metal',      label: 'Metal',      deezerId: 464 },
  { id: 'classical',  label: 'Classical',  deezerId: 98  },
  { id: 'alternative',label: 'Alternative',deezerId: 85  },
] as const

export type GenreId = typeof GENRES[number]['id']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTrack(t: any, genre: string): Track {
  return {
    id: String(t.id),
    name: t.title,
    artist: t.artist?.name ?? '',
    src: t.preview,           // 30-second mp3 preview
    duration: t.duration ?? 30,
    coverUrl: t.album?.cover_medium ?? t.album?.cover ?? undefined,
    source: 'jamendo',        // reuse source type
    genre,
  }
}

// Themes use Deezer search API with curated keywords
export const THEMES = [
  { id: 'workout',  label: '🏋️ Workout',  query: 'workout gym energy'   },
  { id: 'hits',     label: '🔥 Hits',      query: 'top hits pop 2024'    },
  { id: 'chill',    label: '😌 Chill',     query: 'chill lofi relax'     },
  { id: 'party',    label: '🎉 Party',     query: 'party dance club'     },
  { id: 'sleep',    label: '🌙 Sleep',     query: 'sleep ambient calm'   },
  { id: 'focus',    label: '☕ Focus',     query: 'focus study deep work' },
  { id: 'romance',  label: '❤️ Romance',  query: 'romance love ballad'  },
  { id: 'roadtrip', label: '🚗 Roadtrip', query: 'roadtrip driving rock' },
  { id: 'morning',  label: '🌅 Morning',  query: 'morning acoustic happy'},
  { id: 'evening',  label: '🍷 Evening',  query: 'evening jazz dinner'  },
] as const

export type ThemeId = typeof THEMES[number]['id']

export async function fetchThemeQueue(themeId: ThemeId, limit = 25): Promise<Track[]> {
  const theme = THEMES.find((t) => t.id === themeId)
  if (!theme) return []
  try {
    const res = await fetch(`${BASE}/deezer-search?q=${encodeURIComponent(theme.query)}&limit=${limit}`)
    const json = await res.json()
    const tracks: Track[] = (json.data ?? [])
      .filter((t: { preview: string }) => !!t.preview)
      .map((t: unknown) => mapTrack(t, themeId))
    return tracks
  } catch {
    return []
  }
}

export async function fetchGenreQueue(genre: GenreId, limit = 25): Promise<Track[]> {
  const g = GENRES.find((x) => x.id === genre)
  if (!g) return []

  try {
    const res = await fetch(`${BASE}/deezer-chart?genreId=${g.deezerId}&limit=${limit}`)
    const json = await res.json()
    const tracks: Track[] = (json.data ?? [])
      .filter((t: { preview: string }) => !!t.preview)
      .map((t: unknown) => mapTrack(t, genre))
    return tracks
  } catch {
    return []
  }
}
