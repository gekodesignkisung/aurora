import { useCallback, useEffect, useRef } from 'react'
import { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResponsive } from '@/hooks/useResponsive'
import ModeSelector from './ModeSelector'

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>
  analyzerRef: React.RefObject<AudioAnalyzer | null>
}

// Arc geometry — matches Figma: radius 100px, 270° arc, starts at 7:30 (135° in SVG coords)
const R           = 100
const CX          = 110   // SVG center (with 10px overflow padding)
const CY          = 110
const SVG_SIZE    = 220
const STROKE      = 2
const CIRCUM      = 2 * Math.PI * R         // ≈ 628.3
const START_DEG   = 135                     // 7:30 position in SVG (0° = 3 o'clock, CW)
const TOTAL_DEG   = 270                     // 270° arc
const ARC_LEN     = (TOTAL_DEG / 360) * CIRCUM  // ≈ 471.2


export default function PlayerControls({ audioRef, analyzerRef }: Props) {
  const {
    track, isPlaying, currentTime, duration, volume,
    setIsPlaying, setCurrentTime, setDuration, setVolume,
    nextTrack, prevTrack, playingStreamLabel,
  } = usePlayerStore()
  const { setMusicPanelOpen } = useUIStore()
  const { isMobile } = useResponsive()
  const analyzerConnected = useRef(false)
  const pad = isMobile ? '20px' : '50px'

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
    audio.play().catch(() => setIsPlaying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume, audioRef])

  const wasPlayingRef = useRef(false)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track) { setMusicPanelOpen(true); return }
    ensureAnalyzer()
    if (isPlaying) {
      audio.pause()
      wasPlayingRef.current = false
    } else {
      audio.play().catch(() => {})
      wasPlayingRef.current = true
    }
  }, [audioRef, isPlaying, track, ensureAnalyzer, setMusicPanelOpen])

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
    const sx   = SVG_SIZE / rect.width
    const sy   = SVG_SIZE / rect.height
    const x    = (e.clientX - rect.left) * sx - CX
    const y    = (e.clientY - rect.top)  * sy - CY
    let   ang  = Math.atan2(y, x) * (180 / Math.PI)
    if (ang < 0) ang += 360
    let norm = ang - START_DEG
    if (norm < 0) norm += 360
    const p = Math.max(0, Math.min(1, norm / TOTAL_DEG))
    const audio = audioRef.current
    if (audio && duration) audio.currentTime = p * duration
  }, [audioRef, duration])

  return (
    <>
      {/* ── Top right: Track info  +  Bottom: Mode buttons ── */}
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end',
        padding: pad,
        pointerEvents: 'none',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        {track && (
          // Figma 1-20: 60×235 — thumbnail top, vertical text below
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, flexShrink: 0, pointerEvents: 'auto' }}>
            {/* Thumbnail — 60×60 */}
            {track.coverUrl ? (
              <img src={track.coverUrl} alt="" style={{ width: 60, height: 60, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 60, height: 60, background: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── Bottom center: Mode buttons ── */}
      <div style={{
        position: 'fixed', bottom: isMobile ? 12 : pad, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
        padding: `0 ${isMobile ? '12px' : pad}`,
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <ModeSelector />
        </div>
      </div>

      {/* ── Ring — fixed at exact screen center ── */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
      }}>
        <div style={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE }}>
          <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{ display: 'block', overflow: 'visible' }}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={STROKE}
              strokeDasharray={`${ARC_LEN} ${CIRCUM - ARC_LEN}`} strokeLinecap="round"
              transform={`rotate(${START_DEG} ${CX} ${CY})`} />
            {filled > 0 && (
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#ffffff" strokeWidth={STROKE}
                strokeDasharray={`${filled} ${CIRCUM - filled}`} strokeLinecap="round"
                transform={`rotate(${START_DEG} ${CX} ${CY})`}
                style={{ transition: 'stroke-dasharray 0.25s linear' }} />
            )}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="transparent" strokeWidth={28}
              style={{ cursor: 'pointer' }} onClick={onArcClick} />
          </svg>
          <button onClick={togglePlay} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 100, height: 100, borderRadius: '50%',
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
              ? <img src="/icon-pause.svg" alt="pause" style={{ width: 100, height: 100 }} />
              : <img src="/icon-play.svg"  alt="play"  style={{ width: 100, height: 100 }} />
            }
          </button>
        </div>
      </div>

      {/* ── Volume slider + Prev/Next — fixed, centered below ring ── */}
      {(() => {
        const btnSize  = 80
        const btnGap   = isMobile ? 30 : 50
        const volH     = 150
        return (
          <div style={{
            position: 'fixed',
            top: `calc(50% + ${SVG_SIZE / 2 - 10}px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 8 : 16,
            pointerEvents: 'auto',
          }}>
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
            {/* Genre / Theme / Local label */}
            {(track?.source === 'local' || playingStreamLabel) && (
              <p style={{ color: '#cccccc', fontSize: isMobile ? 13 : 16, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center' }}>
                {track?.source === 'local' ? 'Local' : playingStreamLabel}
              </p>
            )}
          </div>
        )
      })()}
    </>
  )
}
