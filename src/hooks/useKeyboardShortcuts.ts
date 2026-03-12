import { useEffect } from 'react'
import { usePlayerStore } from '@/store/playerStore'

const MODES = ['nebula-cloud', 'star-field', 'crystal-lattice', 'freq-terrain', 'morph-blob', 'tunnel-warp'] as const

export function useKeyboardShortcuts(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  togglePlay: () => void,
) {
  const { nextTrack, prevTrack, setVisualMode } = usePlayerStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowRight') nextTrack()
      if (e.code === 'ArrowLeft') prevTrack()
      if (e.code === 'KeyM' && audioRef.current) {
        audioRef.current.muted = !audioRef.current.muted
      }
      const num = parseInt(e.key)
      if (num >= 1 && num <= 6) setVisualMode(MODES[num - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, nextTrack, prevTrack, setVisualMode, audioRef])
}
