import { useCallback, useEffect, useRef } from 'react'
import { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import ModeSelector from './ModeSelector'

function fmt(s: number) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>
  analyzerRef: React.RefObject<AudioAnalyzer | null>
}

export default function PlayerControls({ audioRef, analyzerRef }: Props) {
  const {
    track, isPlaying, currentTime, duration, volume,
    setIsPlaying, setCurrentTime, setDuration, setVolume,
    nextTrack, prevTrack,
  } = usePlayerStore()
  const setMusicPanelOpen = useUIStore((s) => s.setMusicPanelOpen)

  const analyzerConnected = useRef(false)

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
    const onEnd   = () => { nextTrack() }
    const onPlay  = () => { setIsPlaying(true); analyzerRef.current?.resume() }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
    }
  }, [audioRef, analyzerRef, setCurrentTime, setDuration, setIsPlaying, nextTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.src = track.src
    audio.volume = volume
    audio.load()
    ensureAnalyzer()
    audio.play().catch(() => { setIsPlaying(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume, audioRef])

  const wasPlayingRef = useRef(false)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    // If no track, open music panel
    if (!track) {
      setMusicPanelOpen(true)
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
  }, [audioRef, isPlaying, track, ensureAnalyzer, setMusicPanelOpen])

  useKeyboardShortcuts(audioRef, togglePlay)

  // Keep playback going even when window loses focus
  useEffect(() => {
    const handleBlur = () => {
      wasPlayingRef.current = isPlaying
    }
    const handleFocus = () => {
      analyzerRef.current?.resume()
      const audio = audioRef.current
      if (audio && wasPlayingRef.current && audio.paused) {
        audio.play().catch(() => {})
      }
    }
    const interval = setInterval(() => {
      analyzerRef.current?.resume()
      const audio = audioRef.current
      if (audio && wasPlayingRef.current && audio.paused) {
        audio.play().catch(() => {})
      }
    }, 1000)

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [isPlaying, analyzerRef, audioRef])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      padding: '50px', gap: '10px',
      pointerEvents: 'auto',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Top: Track info */}
      {track && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          {track.coverUrl ? (
            <img
              src={track.coverUrl}
              alt=""
              style={{ width: 60, height: 60, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: 4, flexShrink: 0,
              background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" fill="rgba(0,0,0,0.2)" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          )}
          <div>
            <p style={{
              color: 'white', fontWeight: 500, fontSize: 18, lineHeight: 'normal',
              margin: 0,
            }}>
              {track.name}
            </p>
            <p style={{ color: '#bbb', fontSize: 16, lineHeight: 'normal', marginTop: 2, margin: '2px 0 0 0' }}>
              {track.artist}
            </p>
          </div>
        </div>
      )}

      {/* Center: Spacer */}
      <div style={{ flex: '1 0 0' }} />

      {/* Bottom: Row 1 - Play button + Main progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {/* Play button */}
        <button
          onClick={togglePlay}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'transparent', border: 'none',
            color: '#dddddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
            padding: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          {isPlaying
            ? <img src="/icon-pause.svg" alt="pause" style={{ width: 48, height: 48 }} />
            : <img src="/icon-play.svg" alt="play" style={{ width: 48, height: 48 }} />
          }
        </button>

        {/* Main progress bar */}
        <div style={{ flex: '1 0 0', position: 'relative', height: 52, display: 'flex', alignItems: 'center', marginLeft: 20 }}>
          <div style={{
            position: 'absolute', width: '100%', height: 2,
            background: 'rgba(255,255,255,0.5)', borderRadius: 50,
          }} />
          <input
            type="range"
            min={0} max={100}
            value={progress}
            onChange={(e) => {
              const audio = audioRef.current
              if (!audio || !duration) return
              audio.currentTime = (Number(e.target.value) / 100) * duration
            }}
            style={{
              position: 'absolute', width: '100%', height: 52, cursor: 'pointer',
              appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
              background: 'transparent', border: 'none', outline: 'none',
              zIndex: 5, padding: 0, margin: 0,
              opacity: 0,
            } as React.CSSProperties}
          />
          <div style={{
            position: 'absolute', left: `${progress}%`, transform: 'translateX(-50%)',
            width: 14, height: 14, background: '#d9d9d9', borderRadius: '50%',
            zIndex: 10, pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Bottom: Row 2 - Volume control + Effects buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 72, paddingRight: 72, flexShrink: 0 }}>
        {/* Volume control */}
        <div style={{ width: 150, height: 20, position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 20 }}>
          <div style={{
            position: 'absolute', width: '100%', height: 2,
            background: 'rgba(255,255,255,0.2)', borderRadius: 50,
          }} />
          <input
            type="range"
            min={0} max={100}
            value={volume * 100}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            style={{
              position: 'absolute', width: '100%', height: 20, cursor: 'pointer',
              appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
              background: 'transparent', border: 'none', outline: 'none',
              zIndex: 5, padding: 0, margin: 0,
              opacity: 0,
            } as React.CSSProperties}
          />
          <div style={{
            position: 'absolute', left: `${volume * 100}%`, transform: 'translateX(-50%)',
            width: 14, height: 14, background: 'white', borderRadius: '50%',
            zIndex: 10, pointerEvents: 'none',
          }} />
        </div>

        {/* Effects buttons */}
        <ModeSelector />
      </div>
    </div>
  )
}
