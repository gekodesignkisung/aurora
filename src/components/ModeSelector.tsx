import { usePlayerStore } from '@/store/playerStore'
import type { VisualMode } from '@/types/visual'

const MODES: { id: VisualMode; label: string; key: string }[] = [
  { id: 'nebula-cloud',    label: 'Nebula', key: '1' },
  { id: 'star-field',     label: 'Star Field',    key: '2' },
  { id: 'crystal-lattice',label: 'Crystal',  key: '3' },
  { id: 'freq-terrain',   label: 'Terrain',  key: '4' },
  { id: 'morph-blob',     label: 'Blob',     key: '5' },
  { id: 'tunnel-warp',    label: 'Tunnel',   key: '6' },
]

export default function ModeSelector() {
  const { visualMode, setVisualMode } = usePlayerStore()

  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, overflow: 'auto' }}>
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => setVisualMode(m.id)}
          title={`키 ${m.key}`}
          style={{
            padding: '6px 12px', borderRadius: 50, fontSize: 10, fontWeight: 600,
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: visualMode === m.id ? 'white' : 'rgba(255,255,255,0.2)',
            color: visualMode === m.id ? 'black' : 'white',
            fontFamily: 'Inter, -apple-system, sans-serif',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (visualMode !== m.id) e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
          }}
          onMouseLeave={(e) => {
            if (visualMode !== m.id) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
