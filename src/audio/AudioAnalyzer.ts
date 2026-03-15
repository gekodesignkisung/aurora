import type { AudioData } from '@/types/audio'
import { BeatDetector } from './BeatDetector'

const FFT_SIZE = 4096

export class AudioAnalyzer {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private beatAnalyser: AnalyserNode | null = null   // zero-smoothing for tight beat detection
  private source: MediaElementAudioSourceNode | null = null
  private frequencies: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE / 2)
  private beatFrequencies: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE / 2)
  private waveform: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE / 2)
  private connected = false
  private detector = new BeatDetector()

  connect(audio: HTMLAudioElement) {
    if (this.connected) return
    if (!this.context) {
      this.context = new AudioContext()
    }

    // Visual analyser — smoothed for stable frequency display
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.analyser.smoothingTimeConstant = 0.75

    // Beat analyser — no smoothing, catches transients immediately
    this.beatAnalyser = this.context.createAnalyser()
    this.beatAnalyser.fftSize = FFT_SIZE
    this.beatAnalyser.smoothingTimeConstant = 0.0

    this.source = this.context.createMediaElementSource(audio)
    this.source.connect(this.analyser)
    this.source.connect(this.beatAnalyser)
    this.analyser.connect(this.context.destination)

    this.frequencies     = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    this.beatFrequencies = new Uint8Array(this.beatAnalyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    this.waveform        = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    this.connected = true
  }

  resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      return this.context.resume()
    }
    return Promise.resolve()
  }

  isConnected() { return this.connected }

  getAudioData(): AudioData {
    if (!this.analyser || !this.context) {
      return this.silence()
    }

    this.analyser.getByteFrequencyData(this.frequencies)
    this.analyser.getByteTimeDomainData(this.waveform)
    this.beatAnalyser!.getByteFrequencyData(this.beatFrequencies)

    const sampleRate = this.context.sampleRate
    const binSize = sampleRate / FFT_SIZE
    const bins = this.frequencies.length

    const bassEnd   = Math.floor(250 / binSize)
    const midStart  = Math.floor(500 / binSize)
    const midEnd    = Math.floor(2000 / binSize)
    const trebStart = Math.floor(4000 / binSize)

    const bass   = this.bandAvg(this.frequencies, 0, bassEnd) / 255
    const mid    = this.bandAvg(this.frequencies, midStart, midEnd) / 255
    const treble = this.bandAvg(this.frequencies, trebStart, bins - 1) / 255

    // Beat bass from zero-smoothing analyser — raw transient
    const beatBass = this.bandAvg(this.beatFrequencies, 0, bassEnd) / 255

    // RMS volume
    let rms = 0
    for (let i = 0; i < this.waveform.length; i++) {
      const v = (this.waveform[i] - 128) / 128
      rms += v * v
    }
    const volume = Math.sqrt(rms / this.waveform.length)

    // Spectral centroid
    const spectralCentroid = this.computeCentroid(bins)

    const { beat, bpm } = this.detector.detect(beatBass, volume)

    return { bass, mid, treble, volume, beat, bpm, spectralCentroid, frequencies: this.frequencies, waveform: this.waveform }
  }

  dispose() {
    this.analyser?.disconnect()
    this.beatAnalyser?.disconnect()
    this.source?.disconnect()
    this.context?.close()
    this.connected = false
  }

  private bandAvg(buf: Uint8Array, start: number, end: number): number {
    if (start >= end) return 0
    let sum = 0
    for (let i = start; i <= end; i++) sum += buf[i]
    return sum / (end - start + 1)
  }

  private computeCentroid(bins: number): number {
    let num = 0, den = 0
    for (let i = 0; i < bins; i++) {
      num += i * this.frequencies[i]
      den += this.frequencies[i]
    }
    return den === 0 ? 0 : Math.min(num / den / bins, 1)
  }

  private silence(): AudioData {
    return {
      bass: 0, mid: 0, treble: 0, volume: 0,
      beat: false, bpm: 120, spectralCentroid: 0,
      frequencies: new Uint8Array(0),
      waveform: new Uint8Array(0),
    }
  }
}
