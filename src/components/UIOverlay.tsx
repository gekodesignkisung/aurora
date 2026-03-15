'use client'
import { useUIStore } from '@/store/uiStore'
import { useResponsive } from '@/hooks/useResponsive'
import type { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import PlayerControls from './PlayerControls'
import MusicPanel from './MusicPanel'
import DropZone from './DropZone'

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>
  analyzerRef: React.RefObject<AudioAnalyzer | null>
}

export default function UIOverlay({ audioRef, analyzerRef }: Props) {
  const { isMobile } = useResponsive()
  const musicPanelOpen = useUIStore((s) => s.musicPanelOpen)
  const setMusicPanelOpen = useUIStore((s) => s.setMusicPanelOpen)

  const buttonSize = isMobile ? 56 : 72
  const buttonPosition = isMobile ? '16px' : '50px'

  return (
    <>
      <DropZone />
      {/* Panel toggle button — top right */}
      <div style={{
        position: 'fixed', top: buttonPosition, right: buttonPosition, zIndex: 20,
        opacity: musicPanelOpen ? 0 : 1, pointerEvents: musicPanelOpen ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
      }}>
        <button
          onClick={() => setMusicPanelOpen(true)}
          style={{
            width: buttonSize, height: buttonSize, borderRadius: '50%',
            background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', padding: 0, transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
        >
          <img src="/icon-menu.svg" alt="menu" style={{ width: buttonSize, height: buttonSize }} />
        </button>
      </div>
      <PlayerControls audioRef={audioRef} analyzerRef={analyzerRef} />
      <MusicPanel open={musicPanelOpen} onClose={() => setMusicPanelOpen(false)} />
      <div style={{
        position: 'fixed', bottom: 16, right: 20, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        color: '#fff', fontSize: 12,
        fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none',
      }}>
        <span style={{ opacity: 0.3, position: 'relative', top: 2 }}>©2026 Prototype by Kisung</span>
        <img src="/logo-corca.svg" alt="" style={{ height: 20, opacity: 0.3, marginLeft: 10 }} />
      </div>
    </>
  )
}
