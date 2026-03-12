'use client'
import { useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useIdleHide } from '@/hooks/useIdleHide'
import type { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import PlayerControls from './PlayerControls'
import MusicPanel from './MusicPanel'
import DropZone from './DropZone'

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>
  analyzerRef: React.RefObject<AudioAnalyzer | null>
}

export default function UIOverlay({ audioRef, analyzerRef }: Props) {
  useIdleHide()
  const showUI = useUIStore((s) => s.showUI)
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <DropZone />
      {/* Panel toggle button — top right */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        style={{
          position: 'fixed', top: '50px', right: '50px', zIndex: 20,
          width: 72, height: 72, borderRadius: '50%',
          background: 'none',
          border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', transition: 'background 0.2s',
          pointerEvents: 'auto',
          padding: 0,
        }}
      >
        <img src="/icon-menu.svg" alt="menu" style={{ width: 72, height: 72 }} />
      </button>
      {/* Player controls fade with idle timer */}
      <div style={{ display: showUI ? 'block' : 'none' }}>
        <PlayerControls audioRef={audioRef} analyzerRef={analyzerRef} />
      </div>
      <MusicPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
