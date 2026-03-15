import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const RING_COUNT  = 24
const RING_SEGS   = 80
const TUNNEL_LEN  = 1000
const CAMERA_Z    = 30

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}

interface Ring {
  line: THREE.Line
  mat: THREE.LineBasicMaterial
  zPos: number
  spinDir: number
  phase: number
}

export class TunnelWarp implements IVisualMode {
  private rings: Ring[] = []
  private scene: THREE.Scene
  private hue = 0
  private beatFlash = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene

    // Pre-build unit circle positions (shared geometry)
    const unitPts = new Float32Array((RING_SEGS + 1) * 3)
    for (let j = 0; j <= RING_SEGS; j++) {
      const a = (j / RING_SEGS) * Math.PI * 2
      unitPts[j*3] = Math.cos(a); unitPts[j*3+1] = Math.sin(a); unitPts[j*3+2] = 0
    }

    for (let k = 0; k < RING_COUNT; k++) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(unitPts.slice(), 3))
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
      const line = new THREE.Line(geo, mat)
      const zPos = CAMERA_Z - 5 - (k / RING_COUNT) * TUNNEL_LEN
      line.position.z = zPos
      scene.add(line)
      this.rings.push({ line, mat, zPos, spinDir: k % 2 === 0 ? 1 : -1, phase: (k / RING_COUNT) * Math.PI * 2 })
    }
  }

  update(audio: AudioData, delta: number, elapsed: number): void {
    const { frequencies, bass, mid, treble, beat } = audio
    const freqLen = frequencies.length

    if (beat) { this.beatFlash = 1.0; this.hue = (this.hue + 0.14) % 1 }
    else this.beatFlash = Math.max(0, this.beatFlash - delta * 3)
    this.hue = (this.hue + delta * (0.025 + treble * 0.08)) % 1

    const speed = 35 + bass * 120 + this.beatFlash * 60

    for (const ring of this.rings) {
      ring.zPos += speed * delta
      if (ring.zPos > CAMERA_Z - 2) ring.zPos -= TUNNEL_LEN
      ring.line.position.z = ring.zPos

      // Whole tunnel drifts slowly together (no ring.phase — uniform offset)
      const driftX = Math.sin(elapsed * 0.28) * 4 + Math.sin(elapsed * 0.11) * 2
      const driftY = Math.cos(elapsed * 0.21) * 3 + Math.cos(elapsed * 0.08) * 1.5
      ring.line.position.x = driftX
      ring.line.position.y = driftY

      // Depth ratio: 0 = near camera, 1 = far
      const depth = Math.max(0, (CAMERA_Z - ring.zPos) / TUNNEL_LEN)

      // World radius proportional to depth → constant apparent screen size (tunnel effect)
      const binIdx = freqLen > 0 ? Math.floor(depth * Math.min(freqLen-1, 127)) : 0
      const amp    = freqLen > 0 ? frequencies[binIdx] / 255 : 0.1
      // Slow size pulse per ring (grow/shrink independently)
      const sizePulse = 1 + Math.sin(elapsed * 0.5 + ring.phase) * 0.28
      const radiusAmp = sizePulse * (1 + amp * 0.85 + this.beatFlash * 0.25)
      const radius = (CAMERA_Z - ring.zPos) * 0.225 * Math.pow(radiusAmp, 0.9)
      // All rings share the same slow ellipse cycle (circle → ellipse → circle)
      const morphT  = Math.sin(elapsed * 0.22) * 0.5 + 0.5   // 0~1, period ~28s
      const stretch = morphT * 0.55                            // max 55% stretch
      const ellipseX = 1 + stretch
      const ellipseY = 1 - stretch * 0.5                      // compensate area
      ring.line.scale.set(radius * ellipseX, radius * ellipseY, 1)

      // Twist each ring
      ring.line.rotation.z += delta * (0.18 + mid * 0.4) * ring.spinDir

      // Color: hue by depth + time
      const h = (this.hue + depth * 0.5) % 1
      const nearBoost = Math.pow(Math.max(0, 1 - depth), 1.5) * 0.35
      const l = Math.min(0.95, 0.35 + amp * 0.45 + this.beatFlash * 0.2 + nearBoost)
      const [r, g, b] = hsl2rgb(h, 1.0, l)
      ring.mat.color.setRGB(r, g, b)
      const depthFade = Math.pow(Math.max(0, 1 - depth), 1.2)
      ring.mat.opacity = Math.min(1.0, 0.5 + amp * 0.4 + depthFade * 0.6)
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.line.geometry.dispose()
      ring.mat.dispose()
      ring.line.removeFromParent()
    }
  }
}
