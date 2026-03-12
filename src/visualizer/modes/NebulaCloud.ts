import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const COUNT = 30000

/** Soft radial-gradient texture — gives each particle a glowing blur effect */
function makeBlurTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0.00, 'rgba(255,255,255,1.0)')
  grad.addColorStop(0.15, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.40, 'rgba(255,255,255,0.4)')
  grad.addColorStop(0.70, 'rgba(255,255,255,0.1)')
  grad.addColorStop(1.00, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}

export class NebulaCloud implements IVisualMode {
  private geo: THREE.BufferGeometry
  private points: THREE.Points
  private positions: Float32Array
  private velocities: Float32Array
  private basePositions: Float32Array
  private colors: Float32Array
  private baseHues: Float32Array
  private material: THREE.PointsMaterial
  private beatFlash = 0
  private swirlAngle = 0
  private baseRadius = 14

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry()
    this.positions    = new Float32Array(COUNT * 3)
    this.velocities   = new Float32Array(COUNT * 3)
    this.basePositions= new Float32Array(COUNT * 3)
    this.colors       = new Float32Array(COUNT * 3)
    this.baseHues     = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = this.baseRadius * (0.5 + Math.random() * 0.8)
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)
      this.positions[i*3]=this.basePositions[i*3]=x
      this.positions[i*3+1]=this.basePositions[i*3+1]=y
      this.positions[i*3+2]=this.basePositions[i*3+2]=z
      // hue from azimuthal angle so spiral arms have distinct colors
      this.baseHues[i] = theta / (Math.PI * 2)
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.15,           // smaller particles
      map: makeBlurTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.001,     // discard fully transparent corners
    })

    this.points = new THREE.Points(this.geo, this.material)
    scene.add(this.points)
  }

  update(audio: AudioData, delta: number, elapsed: number) {
    const { bass, mid, treble, volume, spectralCentroid, beat, frequencies } = audio
    const bins = frequencies.length

    if (beat) { this.beatFlash = 1.0; this.swirlAngle += 0.25 }
    else this.beatFlash = Math.max(0, this.beatFlash - delta * 5)

    // Swirl speed reacts to mid
    this.swirlAngle += delta * (0.15 + mid * 0.6)

    const scale = 1 + bass * 0.12 + this.beatFlash * 0.05
    const globalHue = (elapsed * 0.04 + spectralCentroid * 0.25) % 1

    this.material.size = 0.1 + volume * 0.15 + this.beatFlash * 0.08
    this.material.opacity = 0.45 + volume * 0.3 + this.beatFlash * 0.15

    for (let i = 0; i < COUNT; i++) {
      const bx = this.basePositions[i*3]
      const by = this.basePositions[i*3+1]
      const bz = this.basePositions[i*3+2]

      // Turbulence — very gentle drift
      const t = elapsed * (0.04 + treble * 0.05) + i * 0.0008
      const nx = Math.sin(t + bz * 0.04) * (0.05 + treble * 0.08)
      const ny = Math.cos(t + bx * 0.04) * (0.05 + treble * 0.08)
      const nz = Math.sin(t * 1.2 + by * 0.04) * (0.05 + treble * 0.08)

      // Swirl: very light tangential force
      const rxy = Math.sqrt(bx*bx + by*by) + 0.001
      const tx = (-by / rxy) * mid * 0.15
      const ty = ( bx / rxy) * mid * 0.15

      // Beat explosion
      if (beat && i < 8000) {
        const strength = 0.6 + bass * 0.8
        const len = Math.sqrt(bx*bx + by*by + bz*bz) || 1
        this.velocities[i*3]   += (bx/len) * strength
        this.velocities[i*3+1] += (by/len) * strength
        this.velocities[i*3+2] += (bz/len) * strength
      }

      // Higher damping = smoother return to base
      const damping = beat ? 0.90 : 0.97
      this.velocities[i*3]   *= damping
      this.velocities[i*3+1] *= damping
      this.velocities[i*3+2] *= damping

      this.positions[i*3]   = bx * scale + nx + tx + this.velocities[i*3]   * delta
      this.positions[i*3+1] = by * scale + ny + ty + this.velocities[i*3+1] * delta
      this.positions[i*3+2] = bz * scale + nz      + this.velocities[i*3+2] * delta

      // Per-particle color from azimuthal hue + global shift
      const binIdx = bins > 0 ? Math.floor((i / COUNT) * Math.min(bins-1, 255)) : 0
      const amp = bins > 0 ? frequencies[binIdx] / 255 : 0
      const h = (this.baseHues[i] + globalHue) % 1
      const l = 0.45 + amp * 0.35 + this.beatFlash * 0.2
      const [r, g, b] = hsl2rgb(h, 1.0, l)
      this.colors[i*3]=r; this.colors[i*3+1]=g; this.colors[i*3+2]=b
    }

    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true

    this.points.rotation.y = elapsed * (0.006 + mid * 0.008)
    this.points.rotation.x = elapsed * 0.003 + bass * 0.01
  }

  dispose() {
    this.geo.dispose()
    this.material.map?.dispose()
    this.material.dispose()
    this.points.removeFromParent()
  }
}
