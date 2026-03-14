import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const COUNT = 2000

export class StarField implements IVisualMode {
  private geo: THREE.BufferGeometry
  private points: THREE.Points
  private positions: Float32Array
  private baseX: Float32Array   // base XY — shimmer applied as pure offset
  private baseY: Float32Array
  private colors: Float32Array
  private material: THREE.PointsMaterial

  private hue = 0
  private flash = 0
  private boost = 0

  private camera: THREE.PerspectiveCamera | null = null
  private rollVel = 0
  private rollDir = 1
  private _col = new THREE.Color()

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry()
    this.positions = new Float32Array(COUNT * 3)
    this.baseX     = new Float32Array(COUNT)
    this.baseY     = new Float32Array(COUNT)
    this.colors    = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 60
      const y = (Math.random() - 0.5) * 60
      this.baseX[i] = x
      this.baseY[i] = y
      this.positions[i*3]   = x
      this.positions[i*3+1] = y
      this.positions[i*3+2] = (Math.random() - 0.5) * 800
      this.colors[i*3] = this.colors[i*3+1] = this.colors[i*3+2] = 1
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))

    this.material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geo, this.material)
    scene.add(this.points)
  }

  onModeEnter(camera?: THREE.PerspectiveCamera) {
    if (camera) { this.camera = camera; camera.rotation.z = 0 }
  }

  onModeExit(camera?: THREE.PerspectiveCamera) {
    if (camera) camera.rotation.z = 0
    this.camera = null
  }

  update(audio: AudioData, delta: number, elapsed: number) {
    const { bass, treble, volume, beat } = audio

    if (beat) {
      this.flash = 1.0
      this.boost = 1.0
      this.rollVel += this.rollDir * (0.25 + bass * 0.4)
      this.rollDir *= -1
    }
    this.flash = Math.max(0, this.flash - delta * 6)
    this.boost = Math.max(0, this.boost - delta * 3)

    if (this.camera) {
      this.rollVel *= Math.pow(0.04, delta)
      this.rollVel -= this.camera.rotation.z * 8 * delta
      this.camera.rotation.z += this.rollVel * delta
    }

    this.hue = (this.hue + delta * 0.06 + (beat ? 0.08 : 0)) % 1
    this._col.setHSL(this.hue, 1.0, 0.5 + this.flash * 0.5)
    const col = this._col

    const speed = 15 + volume * 60 + this.boost * 120
    const shimmer = treble * 1.5

    for (let i = 0; i < COUNT; i++) {
      this.positions[i*3+2] -= speed * delta

      if (this.positions[i*3+2] < -400) {
        const x = (Math.random() - 0.5) * 60
        const y = (Math.random() - 0.5) * 60
        this.baseX[i] = x
        this.baseY[i] = y
        this.positions[i*3+2] = 30
      }

      // Shimmer as pure offset from base — never drifts
      const sx = Math.sin(i * 0.07 + elapsed * 2.1) * shimmer
      const sy = Math.cos(i * 0.09 + elapsed * 1.9) * shimmer
      this.positions[i*3]   = this.baseX[i] + sx
      this.positions[i*3+1] = this.baseY[i] + sy

      this.colors[i*3]   = col.r
      this.colors[i*3+1] = col.g
      this.colors[i*3+2] = col.b
    }

    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate    = true

    this.material.size    = 0.15 + bass * 1.2 + this.flash * 0.8
    this.material.opacity = 0.6 + volume * 0.4
  }

  dispose() {
    this.geo.dispose()
    this.material.dispose()
    this.points.removeFromParent()
  }
}
