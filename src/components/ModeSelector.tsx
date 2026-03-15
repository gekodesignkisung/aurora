import { usePlayerStore } from '@/store/playerStore'
import { useResponsive } from '@/hooks/useResponsive'
import { useRef, useLayoutEffect } from 'react'
import type { VisualMode } from '@/types/visual'

const MODES: { id: VisualMode; label: string; key: string }[] = [
  { id: 'nebula-cloud',    label: 'Nebula Cloud', key: '1' },
  { id: 'star-field',     label: 'Star Field', key: '2' },
  { id: 'crystal-lattice',label: 'Crystal Lattice', key: '3' },
  { id: 'freq-terrain',   label: 'Freq Terrain', key: '4' },
  { id: 'morph-blob',     label: 'Morph Blob', key: '5' },
  { id: 'tunnel-warp',    label: 'Tunnel Warp', key: '6' },
  { id: 'liquid-mercury',       label: 'Liquid Mercury', key: '7' },
  { id: 'zombie-dance',      label: 'Zombie Dance', key: '8' },
]

export default function ModeSelector() {
  const { visualMode, setVisualMode } = usePlayerStore()
  const { isMobile } = useResponsive()
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to selected button on mobile
  useLayoutEffect(() => {
    if (!isMobile || !containerRef.current) return

    const selectedButton = containerRef.current.querySelector(
      `button[data-mode="${visualMode}"]`
    ) as HTMLElement

    if (!selectedButton) return

    // Use scrollIntoView to center the button in the container
    selectedButton.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [visualMode, isMobile])

  return (
    <div ref={containerRef} style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, overflowX: isMobile ? 'auto' : 'visible', alignItems: 'flex-start', justifyContent: isMobile ? 'flex-start' : 'center', paddingTop: 8, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', width: isMobile ? 'calc(100% - 32px)' : 'auto', minWidth: 0 }}>
      {MODES.map((m) => (
        <button
          key={m.id}
          data-mode={m.id}
          onClick={() => setVisualMode(m.id)}
          style={{
            padding: '10px 22px',
            paddingTop: '12px',
            borderRadius: 50,
            fontSize: 12,
            fontWeight: 400,
            border: visualMode === m.id ? '2px solid #ddd' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'transparent',
            color: visualMode === m.id ? '#ddd' : '#ffffff',
            fontFamily: 'Inter, -apple-system, sans-serif',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => {
            if (!isMobile && visualMode !== m.id) e.currentTarget.style.background = 'rgba(255,255,255,0.4)'
          }}
          onMouseLeave={(e) => {
            if (!isMobile) e.currentTarget.style.background = 'transparent'
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
