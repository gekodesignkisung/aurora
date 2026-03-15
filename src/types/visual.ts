import type { AudioData } from './audio'
import type * as THREE from 'three'

export type VisualMode =
  | 'nebula-cloud'
  | 'star-field'
  | 'crystal-lattice'
  | 'freq-terrain'
  | 'morph-blob'
  | 'tunnel-warp'
  | 'liquid-mercury'
  | 'zombie-dance'

export interface IVisualMode {
  update(audio: AudioData, delta: number, elapsed: number): void
  dispose(): void
  onBeat?(): void
  onModeEnter?(camera?: THREE.PerspectiveCamera): void
  onModeExit?(camera?: THREE.PerspectiveCamera): void
}
