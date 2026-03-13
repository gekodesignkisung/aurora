import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResponsive } from '@/hooks/useResponsive'
import { GENRES, THEMES } from '@/api/deezer'
import ModeSelector from './ModeSelector'

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>
  analyzerRef: React.RefObject<AudioAnalyzer | null>
}

// Arc geometry constants
const STROKE      = 2
const START_DEG   = 135                     // 7:30 position in SVG (0° = 3 o'clock, CW)
const TOTAL_DEG   = 270                     // 270° arc

// Size configuration helper
const getGeometry = (isMobile: boolean) => {
  if (isMobile) {
    const R = 85
    return { R, CX: 95, CY: 95, SVG_SIZE: 190, btnSize: 85 }
  }
  const R = 100
  return { R, CX: 110, CY: 110, SVG_SIZE: 220, btnSize: 100 }
}

const getArcLength = (R: number) => {
  const circum = 2 * Math.PI * R
  return (TOTAL_DEG / 360) * circum
}


export default function PlayerControls({ audioRef, analyzerRef }: Props) {
  const [showUI, setShowUI] = useState(true)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    track, isPlaying, currentTime, duration, volume,
    setIsPlaying, setCurrentTime, setDuration, setVolume,
    nextTrack, prevTrack, playingStreamLabel, loadGenreQueue,
  } = usePlayerStore()
  const { setMusicPanelOpen, selectedGenre, selectedTheme, currentPanelTab, setGenre } = useUIStore()
  const { isMobile } = useResponsive()
  const analyzerConnected = useRef(false)
  const pad = isMobile ? '20px' : '50px'

  // Geometry for ring based on screen size
  const geo = getGeometry(isMobile)
  const ARC_LEN = getArcLength(geo.R)
  const CIRCUM = 2 * Math.PI * geo.R

  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    setShowUI(true)
    hideTimeoutRef.current = setTimeout(() => setShowUI(false), 30000)
  }, [])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [resetHideTimer])

  const ensureAnalyzer = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!analyzerRef.current) analyzerRef.current = new AudioAnalyzer()
    if (!analyzerConnected.current) {
      analyzerRef.current.connect(audio)
      analyzerConnected.current = true
    }
    analyzerRef.current.resume()
  }, [audioRef, analyzerRef])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime  = () => setCurrentTime(audio.currentTime)
    const onDur   = () => setDuration(audio.duration)
    const onEnd   = () => nextTrack()
    const onPlay  = () => { setIsPlaying(true);  analyzerRef.current?.resume() }
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [audioRef, analyzerRef, setCurrentTime, setDuration, setIsPlaying, nextTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.src = track.src
    audio.volume = volume
    audio.load()
    ensureAnalyzer()
    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('Playback failed:', err)
        setIsPlaying(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume, audioRef])

  const wasPlayingRef = useRef(false)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track) {
      // Load and play default genre (first in list) on first play
      const defaultGenreId = GENRES[0].id as typeof GENRES[0]['id']
      ensureAnalyzer()
      setGenre(defaultGenreId)
      loadGenreQueue(defaultGenreId)
      setIsPlaying(true)
      return
    }
    ensureAnalyzer()
    if (isPlaying) {
      audio.pause()
      wasPlayingRef.current = false
    } else {
      audio.play().catch(() => {})
      wasPlayingRef.current = true
    }
  }, [audioRef, isPlaying, track, ensureAnalyzer, setGenre, loadGenreQueue, setIsPlaying])

  useKeyboardShortcuts(audioRef, togglePlay)

  // Listen for pause requests from MusicPanel
  useEffect(() => {
    const handler = () => { audioRef.current?.pause() }
    window.addEventListener('aurora:pause', handler)
    return () => window.removeEventListener('aurora:pause', handler)
  }, [audioRef])

  useEffect(() => {
    const onBlur  = () => { wasPlayingRef.current = isPlaying }
    const onFocus = () => {
      analyzerRef.current?.resume()
      const a = audioRef.current
      if (a && wasPlayingRef.current && a.paused) a.play().catch(() => {})
    }
    const iv = setInterval(() => {
      analyzerRef.current?.resume()
      const a = audioRef.current
      if (a && wasPlayingRef.current && a.paused) a.play().catch(() => {})
    }, 1000)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      clearInterval(iv)
    }
  }, [isPlaying, analyzerRef, audioRef])

  const progress   = duration > 0 ? currentTime / duration : 0
  const filled     = progress * ARC_LEN

  // Click on arc ring → scrub
  const onArcClick = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    const svg  = e.currentTarget.closest('svg')!
    const rect = svg.getBoundingClientRect()
    const sx   = geo.SVG_SIZE / rect.width
    const sy   = geo.SVG_SIZE / rect.height
    const x    = (e.clientX - rect.left) * sx - geo.CX
    const y    = (e.clientY - rect.top)  * sy - geo.CY
    let   ang  = Math.atan2(y, x) * (180 / Math.PI)
    if (ang < 0) ang += 360
    let norm = ang - START_DEG
    if (norm < 0) norm += 360
    const p = Math.max(0, Math.min(1, norm / TOTAL_DEG))
    const audio = audioRef.current
    if (audio && duration) audio.currentTime = p * duration
  }, [audioRef, duration, geo])

  return (
    <>
      {/* Full screen activity tracker */}
      <div style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'auto',
        zIndex: 0,
      }}
        onMouseMove={resetHideTimer}
        onClick={(e) => {
          e.stopPropagation()
          resetHideTimer()
        }}
      />

      {/* ── Top right: Track info  +  Bottom: Mode buttons ── */}
      {showUI && (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end',
          padding: pad,
          pointerEvents: 'none',
          fontFamily: 'Inter, -apple-system, sans-serif',
          zIndex: 2,
          overflow: 'visible',
        }}>
          {track && (
            // Figma 1-20: 60×235 — thumbnail top, vertical text below
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, flexShrink: 0, pointerEvents: 'auto' }}>
              {/* Thumbnail — 60×60 */}
              {track.coverUrl ? (
                <img src={track.coverUrl} alt="" style={{ width: 60, height: 60, borderRadius: 0, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 60, height: 60, background: 'white', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" fill="rgba(0,0,0,0.2)" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              )}
              {/* Vertical text — title + artist side by side, flowing downward */}
              <div style={{ display: 'flex', gap: 2, maxHeight: isMobile ? 200 : 300, overflow: 'hidden' }}>
                <p style={{ writingMode: 'vertical-rl', color: '#BBBBBB', fontWeight: 400, fontSize: isMobile ? 13 : 18, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</p>
                <p style={{ writingMode: 'vertical-rl', color: '#ffffff', fontWeight: 400, fontSize: isMobile ? 14 : 20, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom center: Mode buttons ── */}
      {showUI && (
        <div style={{
          position: 'fixed', bottom: isMobile ? 22 : 60, left: 0, right: 0,
          display: 'flex', justifyContent: isMobile ? 'flex-start' : 'center',
          pointerEvents: 'none',
          padding: `0 ${isMobile ? '16px' : pad}`,
          paddingBottom: 20,
          zIndex: 2,
          overflow: isMobile ? 'hidden' : 'visible',
        }}>
          <div style={{ pointerEvents: 'auto', overflow: isMobile ? 'hidden' : 'visible', width: '100%' }}>
            <ModeSelector />
          </div>
        </div>
      )}

      {/* ── Ring — fixed at exact screen center ── */}
      {(showUI || !isMobile) && (
      <div style={{
        position: 'fixed', top: `calc(50% - ${geo.SVG_SIZE / 2}px)`, left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
      }}>
        <div style={{ position: 'relative', width: geo.SVG_SIZE, height: geo.SVG_SIZE }}>
          <svg width={geo.SVG_SIZE} height={geo.SVG_SIZE} viewBox={`0 0 ${geo.SVG_SIZE} ${geo.SVG_SIZE}`} style={{ display: 'block', overflow: 'visible' }}>
            <circle cx={geo.CX} cy={geo.CY} r={geo.R} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={STROKE}
              strokeDasharray={`${ARC_LEN} ${CIRCUM - ARC_LEN}`} strokeLinecap="round"
              transform={`rotate(${START_DEG} ${geo.CX} ${geo.CY})`} />
            {filled > 0 && (
              <circle cx={geo.CX} cy={geo.CY} r={geo.R} fill="none" stroke="#ffffff" strokeWidth={STROKE}
                strokeDasharray={`${filled} ${CIRCUM - filled}`} strokeLinecap="round"
                transform={`rotate(${START_DEG} ${geo.CX} ${geo.CY})`}
                style={{ transition: 'stroke-dasharray 0.25s linear' }} />
            )}
            <circle cx={geo.CX} cy={geo.CY} r={geo.R} fill="none" stroke="transparent" strokeWidth={28}
              style={{ cursor: 'pointer' }} onClick={onArcClick} />
          </svg>
          <button onClick={togglePlay} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: geo.btnSize, height: geo.btnSize, borderRadius: '50%',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, transition: 'transform 0.15s, opacity 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; e.currentTarget.style.opacity = '1' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.5)'; e.currentTarget.style.opacity = '1' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
          >
            {isPlaying
              ? <img src="/icon-pause.svg" alt="pause" style={{ width: geo.btnSize, height: geo.btnSize }} />
              : <img src="/icon-play.svg"  alt="play"  style={{ width: geo.btnSize, height: geo.btnSize }} />
            }
          </button>
        </div>
      </div>
      )}

      {/* ── Volume slider + Prev/Next — fixed, centered below ring ── */}
      {showUI && (() => {
        const btnSize  = isMobile ? 70 : 80
        const btnGap   = isMobile ? 70 : 100
        const volH     = 120
        const labelTopOffset = isMobile ? 20 : 0
        return (
          <div style={{
            position: 'fixed',
            top: `calc(50% + ${geo.SVG_SIZE / 2 - geo.btnSize / 2 - labelTopOffset}px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 20 : 32,
            pointerEvents: 'auto',
            minWidth: 'max-content',
            zIndex: 2,
          }}>
            {(() => {
              let displayLabel: string | null = null
              if (playingStreamLabel) {
                displayLabel = playingStreamLabel
              } else if (currentPanelTab === 'genre' && selectedGenre) {
                displayLabel = GENRES.find(g => g.id === selectedGenre)?.label ?? null
              } else if (currentPanelTab === 'theme' && selectedTheme) {
                displayLabel = THEMES.find(t => t.id === selectedTheme)?.label ?? null
              }
              return (track?.source === 'local' || displayLabel) && (
                <p style={{ color: '#ffffff', fontSize: isMobile ? 13 : 16, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center', fontWeight: 500 }}>
                  {track?.source === 'local' ? 'Local' : displayLabel}
                </p>
              )
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: btnGap }}>
              <button onClick={prevTrack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s, opacity 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)'; e.currentTarget.style.opacity = '1' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
              >
                <img src="/icon-prev.svg" alt="prev" style={{ width: btnSize, height: btnSize }} />
              </button>
              {/* Volume slider */}
              <div style={{ position: 'relative', width: 20, height: volH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: 2, height: '100%', background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                <div style={{ position: 'absolute', bottom: 0, width: 2, height: `${volume * 100}%`, background: '#ffffff', borderRadius: 1, transition: 'height 0.05s' }} />
                <div style={{ position: 'absolute', bottom: `${volume * 100}%`, transform: 'translateY(50%)', width: 20, height: 20, background: '#ffffff', borderRadius: '50%', pointerEvents: 'none', transition: 'transform 0.15s, opacity 0.15s' }} />
                <input type="range" min={0} max={100} value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  onMouseEnter={(e) => { const h = e.currentTarget.previousElementSibling as HTMLElement; if (h) { h.style.transform = 'translateY(50%) scale(1.2)'; h.style.opacity = '0.6' } }}
                  onMouseLeave={(e) => { const h = e.currentTarget.previousElementSibling as HTMLElement; if (h) { h.style.transform = 'translateY(50%) scale(1)'; h.style.opacity = '1' } }}
                  onMouseDown={(e) => { const h = e.currentTarget.previousElementSibling as HTMLElement; if (h) { h.style.transform = 'translateY(50%) scale(1.5)'; h.style.opacity = '1' } }}
                  onMouseUp={(e) => { const h = e.currentTarget.previousElementSibling as HTMLElement; if (h) { h.style.transform = 'translateY(50%) scale(1.2)'; h.style.opacity = '0.6' } }}
                  style={{ position: 'absolute', width: volH, height: 20, transform: 'rotate(-90deg)', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', outline: 'none', opacity: 0, zIndex: 5 } as React.CSSProperties}
                />
              </div>
              <button onClick={nextTrack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s, opacity 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)'; e.currentTarget.style.opacity = '1' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.opacity = '0.6' }}
              >
                <img src="/icon-next.svg" alt="next" style={{ width: btnSize, height: btnSize }} />
              </button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
