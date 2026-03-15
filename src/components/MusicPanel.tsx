import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { useResponsive } from '@/hooks/useResponsive'
import { GENRES, THEMES, type GenreId, type ThemeId } from '@/api/jamendo'
import type { Track } from '@/types/track'

interface Props {
  open: boolean
  onClose: () => void
}

// Figma design tokens (node 3-23)
const S = {
  colorText:          '#CCCCCC',
  colorSub:           '#999999',
  colorBg:            '#000000',
  font:               'Inter, -apple-system, sans-serif',
  pad:                30,
  gap:                30,
  tagRadius:          50,
  tagPadH:            15,
  tagPadV:            7,
  tagFontSize:        14,
  tagFontWeight:      600,
  trackTitleSize:     16,
  trackTitleWeight:   400,
  trackArtistSize:    14,
  trackArtistWeight:  500,
  trackGap:           30,
  playRowHeight:      60,
  playRowRadius:      500,
}

export default function MusicPanel({ open, onClose }: Props) {
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<'genre' | 'theme' | 'local' | 'url'>('genre')
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isMobile } = useResponsive()

  const {
    track: currentTrack, playlist, jamendoQueue, isPlaying,
    setTrack, setIsPlaying,
    addLocalTracks, startGenreStream, startThemeStream, isLoadingJamendo,
    loadGenreQueue, loadThemeQueue, prefetch,
  } = usePlayerStore()
  const { selectedGenre, setGenre, selectedTheme, setTheme: setSelectedTheme, setCurrentPanelTab } = useUIStore()

  // Update current tab in UIStore
  useEffect(() => {
    setCurrentPanelTab(tab)
  }, [tab, setCurrentPanelTab])

  // Auto-select first theme when switching to theme tab with no selection
  useEffect(() => {
    if (tab === 'theme' && !selectedTheme) {
      setSelectedTheme(THEMES[0].id as ThemeId)
    }
  }, [tab, selectedTheme, setSelectedTheme])

  // Load playlist when panel opens or genre/theme changes
  useEffect(() => {
    if (open && tab === 'genre' && selectedGenre) {
      loadGenreQueue(selectedGenre)
    }
  }, [open, tab, selectedGenre, loadGenreQueue])

  useEffect(() => {
    if (open && tab === 'theme' && selectedTheme) {
      loadThemeQueue(selectedTheme)
    }
  }, [open, tab, selectedTheme, loadThemeQueue])

  const allTracks: Track[] = tab === 'local' ? playlist : jamendoQueue

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|opus|wma|aiff?)$/i.test(f.name))
    if (arr.length === 0) return
    const tracks: Track[] = arr.map((f) => ({
      id: `${f.name}-${f.size}`,
      name: f.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local File',
      src: URL.createObjectURL(f),
      duration: 0,
      source: 'local' as const,
    }))
    addLocalTracks(tracks)
    if (tracks.length > 0) {
      setTrack(tracks[0])
      setIsPlaying(true)
    }
    onClose()
  }, [addLocalTracks, setTrack, setIsPlaying, onClose])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const hov = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '0.6' },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '1' },
    onMouseDown:  (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '1' },
    onMouseUp:    (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '0.6' },
  }

  const panelW: number | string = isMobile ? '100%' : 380
  const addUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    const name = url.split('/').pop()?.split('?')[0] ?? 'URL Track'
    const track: Track = { id: url, name, artist: 'URL', src: url, duration: 0, source: 'local' }
    setTrack(track)
    setIsPlaying(true)
    setUrlInput('')
    onClose()
  }, [urlInput, setTrack, setIsPlaying, onClose])

  const canPlay = (tab === 'genre' && !!selectedGenre) || (tab === 'theme' && !!selectedTheme) || (tab === 'local' && playlist.length > 0) || (tab === 'url' && !!urlInput.trim())
  const handlePlay = () => {
    window.dispatchEvent(new Event('aurora:unlockAudio'))
    if (tab === 'genre' && selectedGenre) { startGenreStream(selectedGenre); onClose() }
    if (tab === 'theme' && selectedTheme) { startThemeStream(selectedTheme); onClose() }
    if (tab === 'local' && playlist.length > 0) {
      const target = currentTrack && playlist.find(t => t.id === currentTrack.id) ? currentTrack : playlist[0]
      setTrack(target); setIsPlaying(true); onClose()
    }
    if (tab === 'url') addUrl()
  }

  return (
    <>
      {/* Backdrop — covers left side (panel opens from right) */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, bottom: 0,
            left: 0, right: isMobile ? 0 : 380,
            zIndex: 39, pointerEvents: 'auto',
          }}
        />
      )}

      {/* Panel — fades in/out */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: panelW,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 40, display: 'flex', flexDirection: 'column',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
        fontFamily: S.font,
        overflow: 'hidden',
      } as React.CSSProperties}>

        {/* ── 고정 상단 영역 ── */}
        <div style={{ flexShrink: 0, padding: S.pad, paddingBottom: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Top row: Navigation + Close button */}
          <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -10 }}>
            {/* Navigation: Genre / Theme / Local */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {(['genre', 'theme', 'local', 'url'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  background: 'none', border: 'none', padding: 0, paddingBottom: 8,
                  borderBottom: tab === id ? '2px solid #CCCCCC' : '2px solid transparent',
                  cursor: 'pointer',
                  color: '#ffffff', fontSize: 16, fontWeight: 700, fontFamily: S.font,
                  transition: 'all 0.2s',
                }}
              >
                {id === 'genre' ? 'Genre' : id === 'theme' ? 'Theme' : id === 'local' ? 'Local' : 'URL'}
              </button>
            ))}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s', marginBottom: 8 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1.5)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.2)' }}
            >
              <img src="/icon-close.svg" alt="close" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>

          {/* Genre tags */}
          {tab === 'genre' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GENRES.map((g) => {
                const active = selectedGenre === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => setGenre(g.id as GenreId)}
                    style={{
                      padding: `${S.tagPadV}px ${S.tagPadH}px`,
                      borderRadius: S.tagRadius,
                      fontSize: S.tagFontSize, fontWeight: S.tagFontWeight, fontFamily: S.font,
                      border: active ? '2px solid transparent' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                      color: active ? '#000000' : S.colorText,
                    }}
                    onMouseEnter={(e) => { prefetch(g.id as GenreId); if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Theme tags */}
          {tab === 'theme' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {THEMES.map((t) => {
                const active = selectedTheme === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id as ThemeId)}
                    style={{
                      padding: `${S.tagPadV}px ${S.tagPadH}px`,
                      borderRadius: S.tagRadius,
                      fontSize: S.tagFontSize, fontWeight: S.tagFontWeight, fontFamily: S.font,
                      border: '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                      color: active ? '#000000' : S.colorText,
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Local file upload */}
          {tab === 'local' && (
            <div>
              <label
                htmlFor="music-file-input"
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, height: 200,
                  border: `2px dashed ${dragging ? '#999999' : '#666666'}`,
                  borderRadius: 20,
                  background: dragging ? 'rgba(255,255,255,0.03)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <img src="/icon-folder.svg" alt="" style={{ width: 60, height: 60 }} />
                <div style={{ opacity: 1, textAlign: 'center' }}>
                  <p style={{ color: '#CCCCCC', fontSize: 16, fontWeight: 600, fontFamily: S.font, margin: 0, lineHeight: '30px' }}>
                    Drag or click music files
                  </p>
                  <p style={{ color: '#999999', fontSize: 14, fontWeight: 400, fontFamily: S.font, margin: 0, lineHeight: '30px' }}>
                    MP3, WAV, FLAC, AAC, OGG
                  </p>
                </div>
              </label>
              <input
                id="music-file-input" ref={fileInputRef}
                type="file" accept="audio/*" multiple
                onChange={onFileChange}
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
              />
            </div>
          )}

          {/* URL input */}
          {tab === 'url' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addUrl() }}
                placeholder="https://example.com/audio.mp3"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '14px 18px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#CCCCCC', fontSize: 14, fontFamily: S.font,
                  outline: 'none',
                }}
              />
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: S.font, margin: 0 }}>
                MP3, M4A, AAC, OGG, WAV, MP4, WebM URLs supported
              </p>
            </div>
          )}

          {/* Play button */}
          {(tab === 'genre' || tab === 'theme' || tab === 'local' || tab === 'url') && (
            <button
              onClick={handlePlay}
              disabled={!canPlay || isLoadingJamendo}
              style={{
                height: S.playRowHeight, borderRadius: S.playRowRadius,
                border: '2px solid #CCCCCC', background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                paddingTop: 21, paddingBottom: 21, paddingLeft: 22, paddingRight: 22, gap: 10,
                cursor: canPlay && !isLoadingJamendo ? 'pointer' : 'default',
                opacity: !canPlay || isLoadingJamendo ? 0.3 : (isPlaying ? 0.5 : 1),
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={(e) => { if (canPlay && !isLoadingJamendo) e.currentTarget.style.transform = 'scale(1.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)' }}
            onMouseUp={(e) => { if (canPlay && !isLoadingJamendo) e.currentTarget.style.transform = 'scale(1.03)' }}
            >
              {isLoadingJamendo
                ? <span style={{ color: S.colorText, fontSize: 13, fontFamily: S.font }}>Loading…</span>
                : <>
                    <img src="/icon-play-list.svg" alt="play" style={{ width: 30, height: 30 }} />
                    <span style={{ color: S.colorText, fontSize: 14, fontFamily: S.font, letterSpacing: '0.08em' }}>
                      {tab === 'url' ? 'Play URL' : 'Playlist'}
                    </span>
                  </>
              }
            </button>
          )}
        </div>

        {/* ── 스크롤 하단 영역 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `${S.pad}px ${S.pad + 25}px`, display: 'flex', flexDirection: 'column', gap: S.gap }}>

          {/* Track list */}
          {allTracks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.trackGap }}>
              {allTracks.map((t) => {
                const isCurrent = currentTrack?.id === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => { window.dispatchEvent(new Event('aurora:unlockAudio')); setTrack(t); setIsPlaying(true); onClose() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.15s', padding: '11px 26px', margin: '-11px -26px', borderRadius: 20, background: isCurrent ? 'rgba(153,153,153,0.2)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'rgba(153,153,153,0.2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isCurrent ? 'rgba(153,153,153,0.2)' : 'transparent' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        color: isCurrent ? '#ffffff' : S.colorText,
                        fontSize: 14, fontWeight: S.trackTitleWeight, fontFamily: S.font,
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.name}
                      </p>
                      <p style={{
                        color: '#888888',
                        fontSize: 13, fontWeight: 400, fontFamily: S.font,
                        margin: '4px 0 0',
                      }}>
                        {t.artist}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {allTracks.length === 0 && tab !== 'local' && tab !== 'url' && (
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13, fontFamily: S.font, margin: 0 }}>
              {tab === 'genre' ? 'Select genre and play' : 'Select theme and play'}
            </p>
          )}

        </div>

      </div>
    </>
  )
}
