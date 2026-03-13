export type TrackSource = 'local' | 'jamendo'

export interface Track {
  id: string
  name: string
  artist: string
  src: string
  duration: number
  coverUrl?: string
  source: TrackSource
  genre?: string
  album?: string
}
