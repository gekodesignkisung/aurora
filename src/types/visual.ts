import type { AudioData } from './audio'

export type VisualMode =
  | 'nebula-cloud'
  | 'star-field'
  | 'crystal-lattice'
  | 'freq-terrain'
  | 'morph-blob'
  | 'tunnel-warp'

export interface IVisualMode {
  update(audio: AudioData, delta: number, elapsed: number): void
  dispose(): void
  onBeat?(): void
  onModeEnter?(): void
  onModeExit?(): void
}
