import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const GRID = 6
const SPACING = 5
const COUNT = GRID * GRID * GRID

// Tone palette: warm gold → magenta → cyan
const TONE_HUES = [0.08, 0.85, 0.55]

export class CrystalLattice implements IVisualMode {
  private mesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()
  private basePositions: THREE.Vector3[] = []
  private lights: THREE.PointLight[] = []
  private mat: THREE.MeshPhongMaterial
  private beatFlash = 0
  private hueOffset = 0
  private vel: THREE.Vector3[] = []
  // Per-instance spin
  private spinAngles: THREE.Vector3[] = []
  private spinSpeeds: THREE.Vector3[] = []

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(0.6, 0)
    this.mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x222222,
      shininess: 160,
    })

    this.mesh = new THREE.InstancedMesh(geo, this.mat, COUNT)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const offset = ((GRID - 1) * SPACING) / 2
    let idx = 0
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        for (let z = 0; z < GRID; z++) {
          const pos = new THREE.Vector3(
            x * SPACING - offset,
            y * SPACING - offset,
            z * SPACING - offset,
          )
          this.basePositions.push(pos)
          this.vel.push(new THREE.Vector3())
          // Random initial angles and spin speeds
          this.spinAngles.push(new THREE.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
          ))
          this.spinSpeeds.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 1.4,
            (Math.random() - 0.5) * 0.6,
          ))
          this.dummy.position.copy(pos)
          this.dummy.scale.setScalar(1)
          this.dummy.rotation.set(0, 0, 0)
          this.dummy.updateMatrix()
          this.mesh.setMatrixAt(idx++, this.dummy.matrix)
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    scene.add(this.mesh)

    // 3 lights matching tone palette
    const lightColors = [0xffcc44, 0xff44bb, 0x44ddff]
    for (const col of lightColors) {
      const l = new THREE.PointLight(col, 4, 100)
      scene.add(l)
      this.lights.push(l)
    }
  }

  update(audio: AudioData, delta: number, elapsed: number) {
    const { frequencies, bass, mid, treble, beat } = audio
    const bins = frequencies.length

    if (beat) this.beatFlash = 1.0
    else this.beatFlash = Math.max(0, this.beatFlash - delta * 5)

    this.hueOffset += delta * (0.04 + treble * 0.2)

    // Orbit lights
    const radius = 20 + bass * 12
    for (let li = 0; li < this.lights.length; li++) {
      const angle = elapsed * 0.55 + (li / this.lights.length) * Math.PI * 2
      this.lights[li].position.set(
        Math.cos(angle) * radius,
        Math.sin(elapsed * 0.35 + li) * 10,
        Math.sin(angle) * radius,
      )
      this.lights[li].intensity = 3 + bass * 10 + this.beatFlash * 8
      const lhue = (TONE_HUES[li] + this.hueOffset * 0.3) % 1
      this.lights[li].color.setHSL(lhue, 1.0, 0.65)
    }

    this.mesh.rotation.y = elapsed * 0.12
    this.mesh.rotation.x = elapsed * 0.07

    // Spin speed multiplier reacts to energy
    const spinMult = 1 + bass * 3 + this.beatFlash * 4

    for (let i = 0; i < COUNT; i++) {
      const binIdx = bins > 0 ? Math.floor((i / COUNT) * Math.min(bins - 1, 511)) : 0
      const amp = bins > 0 ? (frequencies[binIdx] / 255) : 0

      if (beat) {
        const dir = this.basePositions[i].clone().normalize()
        this.vel[i].copy(dir).multiplyScalar(4 + bass * 10)
      }
      this.vel[i].multiplyScalar(0.88)

      const wave = Math.sin(elapsed * 2.0 + i * 0.07) * (0.3 + mid * 1.0)
      this.dummy.position
        .copy(this.basePositions[i])
        .addScaledVector(this.basePositions[i].clone().normalize(), wave)
        .add(this.vel[i])

      // Per-instance spin
      this.spinAngles[i].x += delta * this.spinSpeeds[i].x * spinMult
      this.spinAngles[i].y += delta * this.spinSpeeds[i].y * spinMult
      this.spinAngles[i].z += delta * this.spinSpeeds[i].z * spinMult
      this.dummy.rotation.set(this.spinAngles[i].x, this.spinAngles[i].y, this.spinAngles[i].z)

      const s = 0.3 + amp * 2.5 + (beat ? 0.4 : 0) + this.beatFlash * 0.3
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)

      // Tone color
      const t = (i / COUNT + this.hueOffset * 0.5) % 1
      const toneIdx = t * TONE_HUES.length
      const toneA = TONE_HUES[Math.floor(toneIdx) % TONE_HUES.length]
      const toneB = TONE_HUES[Math.ceil(toneIdx)  % TONE_HUES.length]
      const hue = toneA + (toneB - toneA) * (toneIdx % 1)
      const lightness = 0.55 + amp * 0.3 + this.beatFlash * 0.15
      this.mesh.setColorAt(i, new THREE.Color().setHSL(hue, 0.95, lightness))
    }

    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
    this.mesh.removeFromParent()
    for (const l of this.lights) l.removeFromParent()
  }
}
