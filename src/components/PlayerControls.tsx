import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import { usePlayerStore } from '@/store/playerStore'
import type { Track } from '@/types/track'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResponsive } from '@/hooks/useResponsive'
import { GENRES, THEMES } from '@/api/jamendo'
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
  const {
    track, isPlaying, currentTime, duration, volume,
    setIsPlaying, setCurrentTime, setDuration, setVolume,
    nextTrack, prevTrack, playingStreamLabel, startGenreStream, startThemeStream,
  } = usePlayerStore()
  const { setMusicPanelOpen, selectedGenre, selectedTheme, currentPanelTab, setGenre } = useUIStore()
  const { isMobile } = useResponsive()
  const analyzerConnected = useRef(false)
  const trackTransitionRef = useRef(false)
  const skipEffectPlayRef = useRef(false)  // set by gesture handlers to prevent track effect double-play
  const lastTrackRef = useRef(track)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const pad = isMobile ? '20px' : '50px'

  // Volume slider
  const volTrackRef = useRef<HTMLDivElement>(null)
  const volDraggingRef = useRef(false)
  const [volDragging, setVolDragging] = useState(false)
  const calcVol = useCallback((clientY: number) => {
    const el = volTrackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setVolume(Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height)))
  }, [setVolume])

  // Geometry for ring based on screen size
  const geo = getGeometry(isMobile)
  const ARC_LEN = getArcLength(geo.R)
  const CIRCUM = 2 * Math.PI * geo.R

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
    const onPlay     = () => { setIsPlaying(true); setIsAudioLoading(false); analyzerRef.current?.resume() }
    const onPause    = () => { if (!trackTransitionRef.current) setIsPlaying(false) }
    const onWaiting  = () => setIsAudioLoading(true)
    const onPlaying  = () => setIsAudioLoading(false)
    const onCanPlay  = () => setIsAudioLoading(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('canplay', onCanPlay)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('canplay', onCanPlay)
    }
  }, [audioRef, analyzerRef, setCurrentTime, setDuration, setIsPlaying, nextTrack])

  // Track change: load and play — skipped if gesture handler already called play()
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (skipEffectPlayRef.current) {
      // next/prev gesture handler already set src and called play() — don't interfere
      skipEffectPlayRef.current = false
      return
    }
    window.dispatchEvent(new Event('aurora:trackChange'))
    trackTransitionRef.current = true
    userPausedRef.current = false
    setIsAudioLoading(true)
    audio.src = track.src
    audio.volume = volume
    ensureAnalyzer()
    audio.play()
      .then(() => { trackTransitionRef.current = false; analyzerRef.current?.resume() })
      .catch(() => { trackTransitionRef.current = false; setIsAudioLoading(false); setIsPlaying(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track])

  // Sync audio element with isPlaying state (pause/resume only — track loading is handled above)
  const prevIsPlayingRef = useRef(isPlaying)
  useEffect(() => {
    const prev = prevIsPlayingRef.current
    prevIsPlayingRef.current = isPlaying
    if (prev === isPlaying) return  // no change
    const audio = audioRef.current
    if (!audio || trackTransitionRef.current) return  // track effect handles this
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, audioRef, setIsPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume, audioRef])

  // true = 사용자가 명시적으로 pause 누름 / false = 자동재생 모드
  const userPausedRef = useRef(false)

  // Play a new track synchronously within user gesture context (avoids autoplay policy blocks)
  const gesturePlayTrack = useCallback((newTrack: Track) => {
    const audio = audioRef.current
    if (!audio) return
    skipEffectPlayRef.current = true      // tell track effect to skip (we handle it here)
    trackTransitionRef.current = true
    userPausedRef.current = false
    setIsAudioLoading(true)
    window.dispatchEvent(new Event('aurora:trackChange'))
    ensureAnalyzer()
    audio.src = newTrack.src
    audio.volume = volume
    audio.play()
      .then(() => { trackTransitionRef.current = false; analyzerRef.current?.resume() })
      .catch(() => {
        skipEffectPlayRef.current = false
        trackTransitionRef.current = false
        setIsAudioLoading(false)
        setIsPlaying(false)
      })
  }, [audioRef, analyzerRef, volume, ensureAnalyzer, setIsPlaying])

  const handleNext = useCallback(() => {
    nextTrack()  // update store synchronously
    const newTrack = usePlayerStore.getState().track
    if (newTrack) gesturePlayTrack(newTrack)
  }, [nextTrack, gesturePlayTrack])

  const handlePrev = useCallback(() => {
    prevTrack()  // update store synchronously
    const newTrack = usePlayerStore.getState().track
    if (newTrack) gesturePlayTrack(newTrack)
  }, [prevTrack, gesturePlayTrack])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    ensureAnalyzer()

    // Already have audio loaded (track or stream) — just toggle
    if (audio.src) {
      if (!audio.paused) {
        audio.pause()
        userPausedRef.current = true
      } else {
        userPausedRef.current = false
        ensureAnalyzer()
        // play() must be called synchronously inside user gesture — no await before this
        audio.play().catch(() => setIsPlaying(false))
      }
      return
    }

    // Nothing loaded yet — start a new stream
    userPausedRef.current = false
    if (selectedTheme) {
      startThemeStream(selectedTheme)
    } else if (selectedGenre) {
      setGenre(selectedGenre)
      startGenreStream(selectedGenre)
    } else {
      const defaultGenreId = GENRES[0].id as typeof GENRES[0]['id']
      setGenre(defaultGenreId)
      startGenreStream(defaultGenreId)
    }
  }, [audioRef, isPlaying, ensureAnalyzer, selectedTheme, selectedGenre, setGenre, startGenreStream, startThemeStream])

  useKeyboardShortcuts(audioRef, togglePlay)

  // Listen for pause requests from MusicPanel
  useEffect(() => {
    const handler = () => { audioRef.current?.pause() }
    window.addEventListener('aurora:pause', handler)
    return () => window.removeEventListener('aurora:pause', handler)
  }, [audioRef])

  // Unlock AudioContext on user gesture from any UI element (e.g. MusicPanel)
  useEffect(() => {
    const handler = () => { ensureAnalyzer() }
    window.addEventListener('aurora:unlockAudio', handler)
    return () => window.removeEventListener('aurora:unlockAudio', handler)
  }, [ensureAnalyzer])

  // Media Session API — 모바일 백그라운드 재생 허용
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!track) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artist,
      album: track.album ?? '',
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' }] : [],
    })
  }, [track])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => {
      userPausedRef.current = false
      audioRef.current?.play().catch(() => {})
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      userPausedRef.current = true
      audioRef.current?.pause()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack())
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
  }, [audioRef, prevTrack, nextTrack])

  // visibilitychange — 탭 복귀 시 AudioContext 재개
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        analyzerRef.current?.resume()
        const a = audioRef.current
        if (a && a.src && !userPausedRef.current && a.paused) a.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [analyzerRef, audioRef])

  useEffect(() => {
    const onFocus = () => {
      analyzerRef.current?.resume()
      const a = audioRef.current
      if (a && a.src && !userPausedRef.current && a.paused) a.play().catch(() => {})
    }
    const iv = setInterval(() => {
      analyzerRef.current?.resume()
      const a = audioRef.current
      if (a && a.src && !userPausedRef.current && a.paused) a.play().catch(() => {})
    }, 1000)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(iv)
    }
  }, [analyzerRef, audioRef])

  if (track) lastTrackRef.current = track

  const progress   = duration > 0 ? currentTime / duration : 0
  const filled     = progress * ARC_LEN

  const btnSize  = isMobile ? 70 : 80
  const btnGap   = isMobile ? 60 : 100
  const volH     = 120

  let displayLabel: string | null = null
  if (playingStreamLabel) {
    displayLabel = playingStreamLabel
  } else if (currentPanelTab === 'genre' && selectedGenre) {
    displayLabel = GENRES.find(g => g.id === selectedGenre)?.label ?? null
  } else if (currentPanelTab === 'theme' && selectedTheme) {
    displayLabel = THEMES.find(t => t.id === selectedTheme)?.label ?? null
  }

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

  const ringEl = (
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
        cursor: 'pointer', padding: 0, transition: 'transform 0.15s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)' }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.5)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)' }}
      >
        {isAudioLoading
          ? (
            <svg width={geo.btnSize} height={geo.btnSize} viewBox="0 0 40 40" style={{ animation: 'aurora-spin 0.9s linear infinite' }}>
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3"
                strokeDasharray="40 60" strokeLinecap="round" />
            </svg>
          )
          : isPlaying
            ? <img src="/icon-pause.svg" alt="pause" style={{ width: geo.btnSize, height: geo.btnSize }} />
            : <img src="/icon-play.svg"  alt="play"  style={{ width: geo.btnSize, height: geo.btnSize }} />
        }
      </button>
    </div>
  )

  const genreLabelEl = displayLabel && !track ? (
    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 14 : 16, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 1, transition: 'opacity 0.4s ease' }}>
      {displayLabel}
    </p>
  ) : null

  const infoEl = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: isMobile ? 260 : 360, opacity: track ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: track ? 'auto' : 'none' }}>
      {track?.name && (
        <p style={{ color: 'rgba(255,255,255,1)', fontSize: isMobile ? 16 : 18, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '4px' }}>
          {(() => { const rem = Math.max(0, duration - currentTime); return `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(Math.floor(rem % 60)).padStart(2, '0')}` })()}
        </p>
      )}
      {(track?.name ?? lastTrackRef.current?.name) && (
        <p style={{ color: '#ffffff', fontSize: isMobile ? 20 : 24, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center', fontWeight: 400, letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {track?.name ?? lastTrackRef.current?.name}
        </p>
      )}
      {(track?.artist ?? lastTrackRef.current?.artist) && (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? 15 : 17, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, textAlign: 'center', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {track?.artist ?? lastTrackRef.current?.artist}
        </p>
      )}
    </div>
  )

  const controlsEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: btnGap, opacity: (track || playingStreamLabel) ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: (track || playingStreamLabel) ? 'auto' : 'none' }}>
      <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
      >
        <img src="/icon-prev.svg" alt="prev" style={{ width: btnSize, height: btnSize }} />
      </button>
      {/* Volume slider — desktop only (iOS Safari blocks JS volume control) */}
      {!isMobile && (
        <div style={{ position: 'relative', width: 44, height: volH, flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: 2, height: '100%', background: 'rgba(255,255,255,0.3)', borderRadius: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 2, height: `${volume * 100}%`, background: '#ffffff', borderRadius: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: `${volume * 100}%`, transform: `translateX(-50%) translateY(50%) scale(${volDragging ? 1.5 : 1})`, width: 20, height: 20, background: '#ffffff', borderRadius: '50%', pointerEvents: 'none', transition: volDragging ? 'none' : 'transform 0.15s' }} />
          <input
            type="range" min={0} max={100} value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            onMouseDown={() => setVolDragging(true)}
            onMouseUp={() => setVolDragging(false)}
            onTouchStart={() => setVolDragging(true)}
            onTouchEnd={() => setVolDragging(false)}
            style={{
              position: 'absolute', inset: 0,
              width: volH, height: 44,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              opacity: 0, cursor: 'pointer', margin: 0,
              WebkitAppearance: 'none', appearance: 'none',
              touchAction: 'none',
            } as React.CSSProperties}
          />
        </div>
      )}
      <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
      >
        <img src="/icon-next.svg" alt="next" style={{ width: btnSize, height: btnSize }} />
      </button>
    </div>
  )

  return (
    <>
      {/* ── Top left: Album thumbnail + vertical text ── */}
      {(
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start',
            padding: pad,
            pointerEvents: 'none',
            fontFamily: 'Inter, -apple-system, sans-serif',
            zIndex: 2,
            overflow: 'visible',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, flexShrink: 0, pointerEvents: track ? 'auto' : 'none', opacity: track ? 1 : 0, transition: 'opacity 0.4s ease' }}>
              {lastTrackRef.current?.coverUrl ? (
                <img src={lastTrackRef.current.coverUrl} alt="" style={{ width: 48, height: 48, borderRadius: 0, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 48, height: 48, background: 'white', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" fill="rgba(0,0,0,0.2)" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              )}
              <div style={{ overflow: 'hidden', maxHeight: 200, width: 20 }}>
                <p style={{ writingMode: 'vertical-rl', WebkitWritingMode: 'vertical-rl', color: '#ffffff', fontWeight: 400, fontSize: 16, opacity: 0.8, margin: 0, whiteSpace: 'nowrap' } as React.CSSProperties}>{lastTrackRef.current?.album}</p>
              </div>
            </div>
          </div>
      )}

      {/* ── Bottom background ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 140,
        background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))',
        zIndex: 1, pointerEvents: 'none',
      }} />

      {/* ── Bottom center: Mode buttons ── */}
      <div style={{
          position: 'fixed', bottom: isMobile ? 42 : 40, left: 0, right: 0,
          display: 'flex', justifyContent: isMobile ? 'flex-start' : 'center',
          pointerEvents: 'none',
          paddingTop: 0,
          paddingRight: isMobile ? '16px' : pad,
          paddingBottom: 20,
          paddingLeft: isMobile ? '16px' : pad,
          zIndex: 2,
          overflow: isMobile ? 'hidden' : 'visible',
        }}>
          <div style={{ pointerEvents: 'auto', overflow: isMobile ? 'hidden' : 'visible', width: '100%' }}>
            <ModeSelector />
          </div>
        </div>

      {isMobile ? (
        <>
          {/* ── Mobile: Ring centered ── */}
          <div style={{
            position: 'fixed',
            top: `calc(50% - ${geo.SVG_SIZE / 2 - 30}px + 30px)`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}>
            {ringEl}
          </div>
          {/* ── Mobile: Info + controls below ring ── */}
          <div style={{
            position: 'fixed',
            top: `calc(50% + ${geo.SVG_SIZE / 2 - geo.btnSize / 2 - 55}px + 30px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            pointerEvents: 'auto',
            minWidth: 'max-content',
            zIndex: 2,
          }}>
            {genreLabelEl}
            {infoEl}
            {controlsEl}
          </div>
        </>
      ) : (
        /* ── Desktop: Horizontal layout (Figma) — above ModeSelector ── */
        <div style={{
          position: 'fixed',
          bottom: '140px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 30,
          pointerEvents: 'auto',
          zIndex: 3,
        }}>
          {/* Left: Volume slider (300px column) */}
          <div style={{
            width: 300, minWidth: 300, flexShrink: 0, height: geo.SVG_SIZE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingTop: 10,
          }}>
            <div style={{ position: 'relative', width: 160, height: 44, flexShrink: 0, transform: 'translateX(30px)' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: '100%', height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 1, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: `${volume * 100}%`, height: 2, background: '#ffffff', borderRadius: 1, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: `${volume * 100}%`, transform: `translate(-50%, -50%) scale(${volDragging ? 1.5 : 1})`, width: 20, height: 20, background: '#ffffff', borderRadius: '50%', pointerEvents: 'none', transition: volDragging ? 'none' : 'transform 0.15s' }} />
              <input
                type="range" min={0} max={100} value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                onMouseDown={() => setVolDragging(true)}
                onMouseUp={() => setVolDragging(false)}
                onTouchStart={() => setVolDragging(true)}
                onTouchEnd={() => setVolDragging(false)}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', margin: 0,
                  WebkitAppearance: 'none', appearance: 'none',
                  touchAction: 'none',
                } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Prev button */}
          <button
            onClick={handlePrev}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              opacity: (track || playingStreamLabel) ? 1 : 0.25,
              transition: 'opacity 0.4s ease, transform 0.15s',
              width: 80, height: 80, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
          >
            <img src="/icon-prev.svg" alt="prev" style={{ width: 80, height: 80, display: 'block' }} />
          </button>

          {/* Ring + time below */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {ringEl}
            <p style={{
              color: '#cccccc', fontSize: 16,
              fontFamily: 'Inter, -apple-system, sans-serif',
              letterSpacing: '3.2px', textAlign: 'center',
              margin: '-28px 0 0 0',
              opacity: track ? 1 : 0, transition: 'opacity 0.4s ease',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
              {(() => { const rem = Math.max(0, duration - currentTime); return `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(Math.floor(rem % 60)).padStart(2, '0')}` })()}
            </p>
          </div>

          {/* Next button */}
          <button
            onClick={handleNext}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              opacity: (track || playingStreamLabel) ? 1 : 0.25,
              transition: 'opacity 0.4s ease, transform 0.15s',
              width: 80, height: 80, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
          >
            <img src="/icon-next.svg" alt="next" style={{ width: 80, height: 80, display: 'block' }} />
          </button>

          {/* Right: Track info or genre label (300px column) */}
          <div style={{
            width: 300, minWidth: 300, flexShrink: 0, height: geo.SVG_SIZE,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, paddingTop: 10,
          }}>
            {(track?.name ?? lastTrackRef.current?.name) ? (
              <div style={{ opacity: track ? 1 : 0, transition: 'opacity 0.4s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: '100%', transform: 'translateX(-30px)' }}>
                <p style={{ color: '#ffffff', fontSize: 18, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240, textAlign: 'center' }}>
                  {track?.name ?? lastTrackRef.current?.name}
                </p>
                <p style={{ color: '#cccccc', fontSize: 14, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240, textAlign: 'center' }}>
                  {track?.artist ?? lastTrackRef.current?.artist}
                </p>
              </div>
            ) : displayLabel ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>
                {displayLabel}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
