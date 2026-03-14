const HISTORY_SIZE = 30   // ~0.5 sec at 60fps — faster adaptation to song dynamics
const BEAT_THRESHOLD = 1.5  // slightly higher since raw data has sharper peaks
const MIN_BEAT_INTERVAL_MS = 200
const WARMUP_FRAMES = HISTORY_SIZE  // skip beat detection until history is filled

export class BeatDetector {
  private energyHistory: number[] = []
  private lastBeatTime = 0
  private frameCount = 0
  bpm = 120

  private beatTimes: number[] = []

  detect(bass: number, _volume: number): { beat: boolean; bpm: number } {
    const now = performance.now()
    const energy = bass * bass

    // Rolling mean
    this.energyHistory.push(energy)
    if (this.energyHistory.length > HISTORY_SIZE) this.energyHistory.shift()
    this.frameCount++

    // Skip detection during warmup so zero-filled history doesn't cause false positives
    if (this.frameCount < WARMUP_FRAMES) return { beat: false, bpm: this.bpm }

    const mean = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length

    const beat =
      mean > 0.001 &&  // guard against silent sections
      energy > mean * BEAT_THRESHOLD &&
      now - this.lastBeatTime > MIN_BEAT_INTERVAL_MS

    if (beat) {
      this.lastBeatTime = now
      this.beatTimes.push(now)
      if (this.beatTimes.length > 8) this.beatTimes.shift()
      if (this.beatTimes.length >= 2) {
        const intervals: number[] = []
        for (let i = 1; i < this.beatTimes.length; i++) {
          intervals.push(this.beatTimes[i] - this.beatTimes[i - 1])
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        this.bpm = Math.round(60000 / avgInterval)
      }
    }

    return { beat, bpm: this.bpm }
  }
}
