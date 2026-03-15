import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const THETA_SEGS = 64
const PHI_SEGS   = 32
const BASE_R     = 10

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}

export class MorphBlob implements IVisualMode {
  private geo: THREE.BufferGeometry
  private baseNormals: Float32Array
  private positions: Float32Array
  private colors: Float32Array
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private hue = 0
  private beatFlash = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene

    const sphereGeo = new THREE.SphereGeometry(BASE_R, THETA_SEGS, PHI_SEGS)
    const posAttr = sphereGeo.attributes.position
    const count   = posAttr.count

    this.baseNormals = new Float32Array(count * 3)
    this.positions   = new Float32Array(count * 3)
    this.colors      = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i)
      const len = Math.sqrt(x*x + y*y + z*z) || 1
      this.baseNormals[i*3]   = x/len
      this.baseNormals[i*3+1] = y/len
      this.baseNormals[i*3+2] = z/len
      this.positions[i*3] = x; this.positions[i*3+1] = y; this.positions[i*3+2] = z
      this.colors[i*3] = this.colors[i*3+1] = this.colors[i*3+2] = 1
    }

    this.geo = sphereGeo
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.colors,    3).setUsage(THREE.DynamicDrawUsage))

    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
    }))
    scene.add(this.mesh)
  }

  update(audio: AudioData, delta: number, elapsed: number): void {
    const { frequencies, bass, mid, treble, beat } = audio
    const freqLen = frequencies.length

    if (beat) { this.beatFlash = 1.0; this.hue = (this.hue + 0.12) % 1 }
    else this.beatFlash = Math.max(0, this.beatFlash - delta * 4)
    this.hue = (this.hue + delta * (0.03 + treble * 0.1)) % 1

    const count = this.positions.length / 3

    for (let i = 0; i < count; i++) {
      const nx = this.baseNormals[i*3], ny = this.baseNormals[i*3+1], nz = this.baseNormals[i*3+2]

      // Map longitude angle to frequency bin
      const theta = Math.atan2(nz, nx)
      const normTheta = (theta + Math.PI) / (Math.PI * 2)
      const binIdx = freqLen > 0 ? Math.floor(normTheta * Math.min(freqLen-1, 255)) : 0
      const amp = freqLen > 0 ? frequencies[binIdx] / 255 : 0

      // Circular ring pattern: concentric waves from pole
      const phi = Math.acos(Math.max(-1, Math.min(1, ny)))
      const circularWave = Math.sin(phi * 6 + elapsed * 2.5) * mid * 2.5
      const displacement = BASE_R + amp * 4.5 * (1 + bass * 0.6) + circularWave + this.beatFlash * 2

      this.positions[i*3]   = nx * displacement
      this.positions[i*3+1] = ny * displacement
      this.positions[i*3+2] = nz * displacement

      const h = (this.hue + normTheta * 0.5 + amp * 0.25) % 1
      const l = 0.1 + amp * 0.75 + this.beatFlash * 0.2
      const [r, g, b] = hsl2rgb(h, 1.0, l)
      this.colors[i*3] = r; this.colors[i*3+1] = g; this.colors[i*3+2] = b
    }

    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate    = true
    this.geo.computeVertexNormals()

    this.mesh.rotation.y += delta * (0.25 + mid * 0.5)
    this.mesh.rotation.z =  Math.sin(elapsed * 0.18) * 0.3
    this.mesh.position.x = Math.cos(elapsed * 0.25) * 3
    this.mesh.position.z = Math.sin(elapsed * 0.25) * 3

  }

  dispose(): void {
    this.geo.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.scene.remove(this.mesh)
  }
}
