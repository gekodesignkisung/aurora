import { create } from 'zustand'
import type { Track } from '@/types/track'
import type { VisualMode } from '@/types/visual'
import { fetchGenreQueue, fetchThemeQueue, GENRES, THEMES, type GenreId, type ThemeId } from '@/api/jamendo'

const VISUAL_MODES: VisualMode[] = [
  'nebula-cloud',
  'star-field',
  'crystal-lattice',
  'freq-terrain',
  'morph-blob',
  'tunnel-warp',
  'liquid-mercury',
  'zombie-dance',
]

const getRandomMode = (exclude?: VisualMode): VisualMode => {
  const pool = exclude ? VISUAL_MODES.filter((m) => m !== exclude) : VISUAL_MODES
  return pool[Math.floor(Math.random() * pool.length)]
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
  cachedGenreId: GenreId | null
  cachedThemeId: ThemeId | null

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
  loadGenreQueue: (genre: GenreId) => Promise<void>
  loadThemeQueue: (themeId: ThemeId) => Promise<void>
  startGenreStream: (genre: GenreId) => Promise<void>
  startThemeStream: (themeId: ThemeId) => Promise<void>
  prefetch: (genre: GenreId) => void
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
  cachedGenreId: null,
  cachedThemeId: null,

  setTrack: (track) => {
    const { track: cur, visualMode } = get()
    const changed = track && track.id !== cur?.id
    set({ track, ...(changed ? { visualMode: getRandomMode(visualMode) } : {}) })
  },
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
    if (!track) { set({ track: combined[0], isPlaying: true }); return }
    const idx = combined.findIndex((t) => t.id === track.id)
    const next = combined[(idx + 1) % combined.length]
    set({ track: next, isPlaying: true, visualMode: getRandomMode(get().visualMode) })
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
    set({ track: prev, isPlaying: true, visualMode: getRandomMode(get().visualMode) })
  },

  loadGenreQueue: async (genre) => {
    const { cachedGenreId, jamendoQueue } = get()
    if (cachedGenreId === genre && jamendoQueue.length > 0) return
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchGenreQueue(genre, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, cachedGenreId: genre, cachedThemeId: null })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },

  loadThemeQueue: async (themeId) => {
    const { cachedThemeId, jamendoQueue } = get()
    if (cachedThemeId === themeId && jamendoQueue.length > 0) return
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchThemeQueue(themeId, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, cachedThemeId: themeId, cachedGenreId: null })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },

  startGenreStream: async (genre) => {
    const { cachedGenreId, jamendoQueue } = get()
    const label = GENRES.find((g) => g.id === genre)?.label ?? genre
    // 이미 캐시된 큐가 있으면 즉시 재생
    if (cachedGenreId === genre && jamendoQueue.length > 0) {
      const shuffled = [...jamendoQueue].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label })
      return
    }
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchGenreQueue(genre, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label, cachedGenreId: genre, cachedThemeId: null })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },

  startThemeStream: async (themeId) => {
    const { cachedThemeId, jamendoQueue } = get()
    const label = THEMES.find((t) => t.id === themeId)?.label ?? themeId
    // 이미 캐시된 큐가 있으면 즉시 재생
    if (cachedThemeId === themeId && jamendoQueue.length > 0) {
      const shuffled = [...jamendoQueue].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label })
      return
    }
    set({ isLoadingJamendo: true })
    try {
      const tracks = await fetchThemeQueue(themeId, 30)
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      set({ jamendoQueue: shuffled, track: shuffled[0], isPlaying: true, visualMode: getRandomMode(), playingStreamLabel: label, cachedThemeId: themeId, cachedGenreId: null })
    } finally {
      set({ isLoadingJamendo: false })
    }
  },

  prefetch: (genre) => {
    const { cachedGenreId, jamendoQueue } = get()
    if (cachedGenreId === genre && jamendoQueue.length > 0) return
    fetchGenreQueue(genre, 30).then((tracks) => {
      if (tracks.length === 0) return
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      set((s) => {
        // 이미 다른 장르가 로드됐으면 덮어쓰지 않음
        if (s.cachedGenreId !== null && s.cachedGenreId !== genre) return {}
        return { jamendoQueue: shuffled, cachedGenreId: genre }
      })
    }).catch(() => {})
  },
}))
