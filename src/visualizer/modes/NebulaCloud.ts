import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const RING_RES = 256
const RING_LAYERS = 5

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}

interface FreqRing {
  geo: THREE.BufferGeometry
  positions: Float32Array
  mat: THREE.LineBasicMaterial
  line: THREE.LineLoop
  baseRadius: number
  dispAmp: number
  freqOffset: number
  hueOffset: number
  zOffset: number
  rotSpeed: number
}

export class NebulaCloud implements IVisualMode {
  private freqRings: FreqRing[] = []
  private ringGroup: THREE.Group
  private beatFlash = 0

  constructor(scene: THREE.Scene) {
    this.ringGroup = new THREE.Group()
    scene.add(this.ringGroup)

    const ringConfigs = [
      { baseRadius: 16, dispAmp: 5,   freqOffset: 0.00, hueOffset: 0.00, zOffset:  0,  rotSpeed:  0.12 },
      { baseRadius: 13, dispAmp: 4,   freqOffset: 0.20, hueOffset: 0.20, zOffset:  3,  rotSpeed: -0.08 },
      { baseRadius: 19, dispAmp: 6,   freqOffset: 0.05, hueOffset: 0.45, zOffset: -3,  rotSpeed:  0.06 },
      { baseRadius: 10, dispAmp: 3.5, freqOffset: 0.40, hueOffset: 0.65, zOffset:  5,  rotSpeed: -0.15 },
      { baseRadius: 22, dispAmp: 7,   freqOffset: 0.10, hueOffset: 0.80, zOffset: -6,  rotSpeed:  0.04 },
    ]

    for (const cfg of ringConfigs) {
      const pts = new Float32Array(RING_RES * 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3).setUsage(THREE.DynamicDrawUsage))

      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const line = new THREE.LineLoop(geo, mat)
      line.position.z = cfg.zOffset
      this.ringGroup.add(line)

      this.freqRings.push({
        geo, positions: pts, mat, line,
        baseRadius: cfg.baseRadius,
        dispAmp: cfg.dispAmp,
        freqOffset: cfg.freqOffset,
        hueOffset: cfg.hueOffset,
        zOffset: cfg.zOffset,
        rotSpeed: cfg.rotSpeed,
      })
    }
  }

  update(audio: AudioData, delta: number, elapsed: number) {
    const { bass, mid, volume, spectralCentroid, beat, frequencies } = audio
    const bins = frequencies.length

    if (beat) this.beatFlash = 1.0
    else this.beatFlash = Math.max(0, this.beatFlash - delta * 5)

    const globalHue = (elapsed * 0.04 + spectralCentroid * 0.25) % 1

    this.ringGroup.rotation.y = elapsed * (0.05 + mid * 0.03)
    this.ringGroup.rotation.x = elapsed * 0.03

    for (const ring of this.freqRings) {
      ring.line.rotation.z += ring.rotSpeed * delta

      const hue = (globalHue + ring.hueOffset) % 1
      const [lr, lg, lb] = hsl2rgb(hue, 1.0, 0.55 + bass * 0.2 + this.beatFlash * 0.25)
      ring.mat.color.setRGB(lr, lg, lb)
      ring.mat.opacity = 0.5 + volume * 0.4 + this.beatFlash * 0.1

      const disp = ring.dispAmp * (1 + bass * 0.7 + this.beatFlash * 0.25)

      for (let j = 0; j < RING_RES; j++) {
        const angle = (j / RING_RES) * Math.PI * 2
        const freqT = ((j / RING_RES) + ring.freqOffset) % 1
        const binIdx = bins > 0 ? Math.floor(freqT * Math.min(bins - 1, 511)) : 0
        const amp = bins > 0 ? frequencies[binIdx] / 255 : 0
        const binIdx2 = bins > 0 ? Math.min(binIdx * 2, bins - 1) : 0
        const amp2 = bins > 0 ? frequencies[binIdx2] / 255 : 0

        const r = ring.baseRadius + amp * disp + amp2 * disp * 0.3
        ring.positions[j*3]   = Math.cos(angle) * r
        ring.positions[j*3+1] = Math.sin(angle) * r
        ring.positions[j*3+2] = 0
      }

      ring.geo.attributes.position.needsUpdate = true
    }
  }

  dispose() {
    for (const ring of this.freqRings) {
      ring.geo.dispose()
      ring.mat.dispose()
    }
    this.ringGroup.removeFromParent()
  }
}
