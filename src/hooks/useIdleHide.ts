import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'

export function useIdleHide(delayMs: number = 4000) {
  const setShowUI = useUIStore((s) => s.setShowUI)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastResetRef = useRef(0)

  useEffect(() => {
    setShowUI(true)

    // Start initial timer to hide UI after delay
    timerRef.current = setTimeout(() => setShowUI(false), delayMs)

    const reset = () => {
      const now = Date.now()
      // Only update if more than 300ms have passed (throttle)
      if (now - lastResetRef.current < 300) return
      lastResetRef.current = now

      setShowUI(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowUI(false), delayMs)
    }

    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      clearTimeout(timerRef.current)
    }
  }, [setShowUI, delayMs])
}
