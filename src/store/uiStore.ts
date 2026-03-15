import { create } from 'zustand'
import type { GenreId, ThemeId } from '@/api/jamendo'

type ActivePanel = 'queue' | 'genres' | null
type MusicPanelTab = 'genre' | 'theme' | 'local' | 'url'

interface UIState {
  showUI: boolean
  activePanel: ActivePanel
  selectedGenre: GenreId | null
  selectedTheme: ThemeId | null
  error: string | null
  musicPanelOpen: boolean
  currentPanelTab: MusicPanelTab

  setShowUI: (v: boolean) => void
  setActivePanel: (p: ActivePanel) => void
  setGenre: (g: GenreId | null) => void
  setTheme: (t: ThemeId | null) => void
  setError: (msg: string | null) => void
  setMusicPanelOpen: (v: boolean) => void
  setCurrentPanelTab: (tab: MusicPanelTab) => void
}

export const useUIStore = create<UIState>((set) => ({
  showUI: true,
  activePanel: 'genres',
  selectedGenre: 'electronic',
  selectedTheme: null,
  error: null,
  musicPanelOpen: false,
  currentPanelTab: 'genre',

  setShowUI: (v) => set({ showUI: v }),
  setActivePanel: (p) => set({ activePanel: p }),
  setGenre: (g) => set({ selectedGenre: g }),
  setTheme: (t) => set({ selectedTheme: t }),
  setError: (msg) => set({ error: msg }),
  setMusicPanelOpen: (v) => set({ musicPanelOpen: v }),
  setCurrentPanelTab: (tab) => set({ currentPanelTab: tab }),
}))
