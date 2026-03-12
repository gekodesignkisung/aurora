import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { VisualMode } from '@/types/visual'
import { fetchGenreQueue, fetchThemeQueue, GENRES, THEMES, type GenreId, type ThemeId } from '@/api/deezer'

const VISUAL_MODES: VisualMode[] = [
  'nebula-cloud',
  'star-field',
  'crystal-lattice',
  'freq-terrain',
  'morph-blob',
  'tunnel-warp',
]

const getRandomMode = (): VisualMode => {
  return VISUAL_MODES[Math.floor(Math.random() * VISUAL_MODES.length)]
}

interface PlayerState {
  track: Track | null
  playlist: Track[]
  jamendoQueue: Track[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  visualMode: VisualMode
  isLoadingJamendo: boolean
  playingStreamLabel: string | null

  setTrack: (track: Track | null) => void
  setPlaylist: (tracks: Track[]) => void
  setIsPlaying: (v: boolean) => void
  setCurrentTime: (v: number) => void
  setDuration: (v: number) => void
  setVolume: (v: number) => void
  setVisualMode: (mode: VisualMode) => void
  addLocalTracks: (tracks: Track[]) => void
  nextTrack: () => void
  prevTrack: () => void
  startGenreStream: (genre: GenreId) => Promise<void>
  startThemeStream: (themeId: ThemeId) => Promise<void>
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  track: null,
  playlist: [],
  jamendoQueue: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.5,
  visualMode: 'nebula-cloud',
  isLoadingJamendo: false,
  playingStreamLabel: null,

  setTrack: (track) => set({ track }),
  setPlaylist: (tracks) => set({ playlist: tracks }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (v) => set({ currentTime: v }),
  setDuration: (v) => set({ duration: v }),
  setVolume: (v) => set({ volume: v }),
  setVisualMode: (mode) => set({ visualMode: mode }),

  addLocalTracks: (newTracks) => {
    const { playlist, track } = get()
    const updated = [...playlist, ...newTracks]
    set({ playlist: updated })
    if (!track && newTracks.length > 0) set({ track: newTracks[0] })
  },

  nextTrack: () => {
    const { track, playlist, jamendoQueue } = get()
    const combined = [...playlist, ...jamendoQueue]
    if (combined.length === 0) return
    if (!track) { set({ track: combined[0] }); return }
    const idx = combined.findIndex((t) => t.id === track.id)
    const next = combined[(idx + 1) % combined.length]
    set({ track: next })
    // Prefetch more Jamendo tracks when queue runs low
    if (jamendoQueue.length < 5 && track.genre) {
      fetchGenreQueue(track.genre as GenreId, 20).then((tracks) => {
        set((s) => ({ jamendoQueue: [...s.jamendoQueue, ...tracks] }))
      }).catch(() => {})
    }
  },

  prevTrack: () => {
    const { track, playlist, jamendoQueue } = get()
    const combined = [...playlist, ...jamendoQueue]
    if (combined.length === 0 || !track) return
    const idx = combined.findIndex((t) => t.id === track.id)
    const prev = combined[(idx - 1 + combined.length) % combined.length]
    set({ track: prev })
  },

  startGenreStream: async (genre) => {
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchGenreQueue(genre, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      const label = GENRES.find((g) => g.id === genre)?.label ?? genre
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },

  startThemeStream: async (themeId) => {
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchThemeQueue(themeId, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      const label = THEMES.find((t) => t.id === themeId)?.label ?? themeId
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },
}))
