import { useState, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { GENRES, THEMES, type GenreId, type ThemeId } from '@/api/deezer'
import type { Track } from '@/types/track'

interface Props {
  open: boolean
  onClose: () => void
}

export default function MusicPanel({ open, onClose }: Props) {
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<'local' | 'genre' | 'theme'>('genre')
  const [selectedTheme, setSelectedTheme] = useState<ThemeId | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { track: currentTrack, playlist, jamendoQueue, isPlaying, setTrack, setIsPlaying, addLocalTracks, startGenreStream, startThemeStream, isLoadingJamendo } = usePlayerStore()
  const { selectedGenre, setGenre } = useUIStore()


  const allTracks: Track[] = tab === 'local' ? playlist : jamendoQueue

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('audio/'))
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
    onClose()
  }, [addLocalTracks, onClose])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    zIndex: 40, display: 'flex', flexDirection: 'column',
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
    pointerEvents: 'auto',
  }

  return (
    <>
      {/* Backdrop — only covers area outside the panel (left side) */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, right: 320,
            zIndex: 39, pointerEvents: 'auto',
          }}
        />
      )}

      {/* Panel */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ padding: '16px 26px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { id: 'genre',  label: '장르',  color: '#dddddd', bg: 'transparent'   },
                { id: 'theme',  label: '테마',  color: '#dddddd', bg: 'transparent'   },
                { id: 'local',  label: '로컬',  color: '#dddddd', bg: 'transparent' },
              ] as const).map((t) => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      padding: '4px 8px', borderRadius: 0, fontSize: 14, fontWeight: 600,
                      border: 'none',
                      borderBottom: isActive ? '2px solid #dddddd' : 'none',
                      paddingBottom: isActive ? '2px' : '4px',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: 'transparent',
                      color: '#dddddd',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <button
              onClick={onClose}
              style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* Tab content: local file drop zone */}
          {tab === 'local' && (
            <>
              <label
                htmlFor="music-file-input"
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  display: 'block',
                  border: `2px dashed ${dragging ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: 12, padding: '20px 16px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragging ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="28" height="28" fill="rgba(255,255,255,0.4)" viewBox="0 0 24 24" style={{ margin: '0 auto 8px' }}>
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                </svg>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>
                  음악 파일을 드래그하거나 클릭
                </p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                  MP3, WAV, FLAC, AAC, OGG
                </p>
              </label>
              <input
                id="music-file-input"
                ref={fileInputRef}
                type="file" accept="audio/*" multiple
                onChange={onFileChange}
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
              />
            </>
          )}

          {/* Genre tab */}
          {tab === 'genre' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {GENRES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGenre(g.id as GenreId)}
                    style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12,
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: selectedGenre === g.id ? '#dddddd' : 'rgba(255,255,255,0.1)',
                      color: selectedGenre === g.id ? '#000' : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => selectedGenre && startGenreStream(selectedGenre)}
                disabled={!selectedGenre || isLoadingJamendo}
                style={{
                  width: '100%', padding: '8px', borderRadius: 999, fontSize: 13,
                  fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: '#dddddd', color: '#000',
                  opacity: (!selectedGenre || isLoadingJamendo || isPlaying) ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {isLoadingJamendo ? '로딩 중…' : '▶'}
              </button>
            </div>
          )}

          {/* Theme tab */}
          {tab === 'theme' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id as ThemeId)}
                    style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12,
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: selectedTheme === t.id ? '#dddddd' : 'rgba(255,255,255,0.1)',
                      color: selectedTheme === t.id ? '#000' : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => selectedTheme && startThemeStream(selectedTheme)}
                disabled={!selectedTheme || isLoadingJamendo}
                style={{
                  width: '100%', padding: '8px', borderRadius: 999, fontSize: 13,
                  fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: '#dddddd', color: '#000',
                  opacity: (!selectedTheme || isLoadingJamendo || isPlaying) ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {isLoadingJamendo ? '로딩 중…' : '▶'}
              </button>
            </div>
          )}
        </div>

        {/* Track list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {allTracks.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: 160,
              color: 'rgba(255,255,255,0.25)', fontSize: 13, gap: 8,
            }}>
              <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
              <span>{tab === 'genre' ? '장르를 선택 후 시작하세요' : tab === 'theme' ? '테마를 선택 후 시작하세요' : ''}</span>
            </div>
          ) : (
            allTracks.map((t) => (
              <div
                key={t.id}
                onClick={() => { setTrack(t); setIsPlaying(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  padding: '10px 16px 10px 36px', cursor: 'pointer',
                  background: currentTrack?.id === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: currentTrack?.id === t.id ? 'white' : 'rgba(255,255,255,0.75)',
                    fontSize: 13, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.name}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{t.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            {allTracks.length > 0 ? `${allTracks.length}개 트랙` : tab === 'local' ? '로컬 파일 재생' : 'Deezer 무료 스트리밍'  }
          </p>
        </div>
      </div>
    </>
  )
}
