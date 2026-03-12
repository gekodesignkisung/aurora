import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const COUNT = 5000
const RING_RES = 80
const MAX_RINGS = 12

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}

interface Ring {
  mesh: THREE.Line
  mat: THREE.LineBasicMaterial
  life: number   // 1 → 0
  hue: number
  zPos: number
}

export class StarField implements IVisualMode {
  private geo: THREE.BufferGeometry
  private points: THREE.Points
  private positions: Float32Array
  private material: THREE.PointsMaterial

  private rings: Ring[] = []
  private ringHue = 0

  private beatFlash = 0

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry()
    this.positions = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      // Circular distribution using polar coordinates
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 30  // sqrt for uniform distribution
      this.positions[i*3]   = Math.cos(angle) * radius
      this.positions[i*3+1] = Math.sin(angle) * radius
      this.positions[i*3+2] = (Math.random() - 0.5) * 500 - 50
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.15,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geo, this.material)
    scene.add(this.points)

    // Pre-build ring pool (unit circle in XY, scale drives apparent size)
    const ringPts = new Float32Array((RING_RES + 1) * 3)
    for (let j = 0; j <= RING_RES; j++) {
      const a = (j / RING_RES) * Math.PI * 2
      ringPts[j*3]   = Math.cos(a)
      ringPts[j*3+1] = Math.sin(a)
      ringPts[j*3+2] = 0
    }

    for (let k = 0; k < MAX_RINGS; k++) {
      const rGeo = new THREE.BufferGeometry()
      rGeo.setAttribute('position', new THREE.BufferAttribute(ringPts.slice(), 3))
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      const mesh = new THREE.Line(rGeo, mat)
      mesh.visible = false
      scene.add(mesh)
      this.rings.push({ mesh, mat, life: 0, hue: 0, zPos: 0 })
    }
  }

  private spawnRing(bass: number) {
    const ring = this.rings.find(r => r.life <= 0)
    if (!ring) return
    ring.life = 1.0
    ring.hue = this.ringHue
    ring.zPos = -5 - bass * 10    // spawn slightly in front
    this.ringHue = (this.ringHue + 0.15) % 1
    ring.mesh.scale.set(1, 1, 1)
    ring.mesh.position.z = ring.zPos
    ring.mesh.visible = true
  }

  update(audio: AudioData, delta: number, elapsed: number) {
    const { bass, mid, treble, volume, beat, spectralCentroid } = audio
    const speed = 15 + bass * 280 + this.beatFlash * 120

    if (beat) {
      this.beatFlash = 1.0
      this.spawnRing(bass)
      this.spawnRing(bass)
    } else {
      this.beatFlash = Math.max(0, this.beatFlash - delta * 3)
    }

    // Move stars toward camera
    for (let i = 0; i < COUNT; i++) {
      this.positions[i*3+2] += speed * delta

      if (this.positions[i*3+2] > 30) {
        // Reset with circular distribution
        const angle = Math.random() * Math.PI * 2
        const radius = Math.sqrt(Math.random()) * 30
        this.positions[i*3]   = Math.cos(angle) * radius
        this.positions[i*3+1] = Math.sin(angle) * radius
        this.positions[i*3+2] = -500
      }

      // Treble drift + mid sway
      this.positions[i*3]   += Math.sin(i * 0.1 + elapsed * 0.5) * (treble * 6 + mid * 2) * delta
      this.positions[i*3+1] += Math.cos(i * 0.13 + elapsed * 0.4) * (treble * 6 + mid * 2) * delta

      // Beat scatter
      if (beat && i < 2000) {
        this.positions[i*3]   += (Math.random() - 0.5) * (6 + bass * 8)
        this.positions[i*3+1] += (Math.random() - 0.5) * (6 + bass * 8)
      }
    }
    this.geo.attributes.position.needsUpdate = true

    const h = 0.6 - spectralCentroid * 0.5
    this.material.color.setHSL(h, 0.8 + mid * 0.2, 0.6 + this.beatFlash * 0.4)
    this.material.size    = 0.1 + bass * 0.55 + this.beatFlash * 0.5
    this.material.opacity = 0.55 + volume * 0.4 + this.beatFlash * 0.05

    // Update rings
    for (const ring of this.rings) {
      if (ring.life <= 0) continue
      ring.life = Math.max(0, ring.life - delta * 0.7)
      const radius = 0.5 + (1 - ring.life) * 110
      ring.mesh.scale.set(radius, radius, 1)
      ring.mat.opacity = ring.life * 1.2
      const [r, g, b] = hsl2rgb(ring.hue, 1.0, 0.75 + bass * 0.2)
      ring.mat.color.setRGB(r, g, b)
      if (ring.life <= 0) ring.mesh.visible = false
    }
  }

  dispose() {
    this.geo.dispose()
    this.material.dispose()
    this.points.removeFromParent()
    for (const r of this.rings) {
      r.mesh.geometry.dispose()
      r.mat.dispose()
      r.mesh.removeFromParent()
    }
  }
}
