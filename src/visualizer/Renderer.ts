import * as THREE from 'three'
import type { VisualMode, IVisualMode } from '@/types/visual'
import type { AudioAnalyzer } from '@/audio/AudioAnalyzer'
import { createMode } from './modeRegistry'

// Per-mode background personality: each mode owns a distinct visual environment
const BG_CONFIG: Record<VisualMode, { pattern: number; dim: number; hue: number; hueSpeed: number }> = {
  'nebula-cloud':    { pattern: 0, dim: 0.50, hue: 0.82, hueSpeed: 0.04 }, // radial pulse, blue-purple nebula
  'star-field':      { pattern: 3, dim: 0.06, hue: 0.64, hueSpeed: 0.005 }, // diamond, near-black deep space
  'crystal-lattice': { pattern: 1, dim: 0.40, hue: 0.82, hueSpeed: 0.05 }, // spiral, magenta gem vault
  'freq-terrain':    { pattern: 2, dim: 0.22, hue: 0.38, hueSpeed: 0.02 }, // grid, dark green matrix
  'morph-blob':      { pattern: 10, dim: 0.38, hue: 0.02, hueSpeed: 0.06 }, // diagonal waves, warm red-orange
  'tunnel-warp':     { pattern: 4, dim: 0.28, hue: 0.55, hueSpeed: 0.008 }, // diamond, tunnel
}

export class Renderer {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private bgScene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private orthoCamera: THREE.OrthographicCamera
  private currentMode: IVisualMode | null = null
  private activeVisualMode: VisualMode
  private raf = 0
  private clock = { lastTime: performance.now(), elapsed: 0 }
  private analyzer: AudioAnalyzer | null = null
  private isOrtho = false
  private ambientLight: THREE.AmbientLight

  private bgMesh: THREE.Mesh
  private bgMat: THREE.ShaderMaterial
  private bgHue = 0
  private bgFlash = 0

  constructor(container: HTMLElement, initialMode: VisualMode) {
    this.activeVisualMode = initialMode

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.autoClear = false
    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    this.scene = new THREE.Scene()

    // Background scene
    this.bgScene = new THREE.Scene()
    this.bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime:    { value: 0 },
        uHue:     { value: 0 },
        uFlash:   { value: 0 },
        uBass:    { value: 0 },
        uMid:     { value: 0 },
        uTreble:  { value: 0 },
        uPattern: { value: 0 },
        uDim:     { value: 1 },   // per-mode brightness multiplier
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uHue;
        uniform float uFlash;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uPattern;
        uniform float uDim;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0);
          return l + s*(rgb-0.5)*(1.0-abs(2.0*l-1.0));
        }

        void main() {
          vec2 uv = vUv - 0.5;
          float dist  = length(uv);
          float angle = atan(uv.y, uv.x);
          float t = uTime;
          float p = uPattern;
          float val = 0.0;

          if (p < 1.0) {
            val = sin(dist * 12.0 - t * 2.0 + uBass * 6.0) * 0.5 + 0.5;
          } else if (p < 2.0) {
            val = sin(angle * 4.0 + dist * 8.0 - t * 1.5 + uMid * 4.0) * 0.5 + 0.5;
          } else if (p < 3.0) {
            vec2 g = fract(uv * (6.0 + uBass * 4.0) + t * 0.3) - 0.5;
            val = clamp(1.0 - smoothstep(0.02, 0.08 + uMid * 0.1, abs(g.x))
                            - smoothstep(0.02, 0.08 + uMid * 0.1, abs(g.y)), 0.0, 1.0);
          } else if (p < 4.0) {
            val = sin((uv.x - uv.y) * 10.0 + t * 2.0 + uBass * 8.0) * 0.5 + 0.5;
          } else {
            float d = max(abs(uv.x), abs(uv.y));
            val = sin(d * 18.0 - t * 2.5 + uBass * 5.0) * 0.5 + 0.5;
          }

          float hue   = mod(uHue + val * 0.25 + uTreble * 0.15, 1.0);
          float sat   = 0.8 + uMid * 0.2;
          float light = (0.12 + val * (0.22 + uBass * 0.18) + uFlash * 0.25) * uDim;

          vec3 col = hsl2rgb(hue, sat, clamp(light, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    const bgGeo = new THREE.PlaneGeometry(2, 2)
    this.bgMesh = new THREE.Mesh(bgGeo, this.bgMat)
    this.bgScene.add(this.bgMesh)

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    this.scene.add(this.ambientLight)

    // Directional light for depth
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(10, 15, 10)
    this.scene.add(dirLight)

    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 2000)
    this.camera.position.z = 30

    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.currentMode = createMode(initialMode, this.scene)
    this.currentMode.onModeEnter?.()
    this.isOrtho = false
    this._applyBgConfig(initialMode)

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    this.loop()
  }

  private _applyBgConfig(mode: VisualMode) {
    const cfg = BG_CONFIG[mode]
    this.bgHue = cfg.hue
    this.bgMat.uniforms.uPattern.value = cfg.pattern
    this.bgMat.uniforms.uDim.value     = cfg.dim
  }

  setAnalyzer(a: AudioAnalyzer) { this.analyzer = a }

  setMode(mode: VisualMode) {
    if (mode === this.activeVisualMode) return
    this.currentMode?.onModeExit?.()
    this.currentMode?.dispose()
    this.scene.clear()
    this.scene.add(this.ambientLight)
    this.currentMode = createMode(mode, this.scene)
    this.currentMode.onModeEnter?.()
    this.activeVisualMode = mode
    this.isOrtho = false
    this._applyBgConfig(mode)
  }

  private loop() {
    this.raf = requestAnimationFrame(() => this.loop())
    const now = performance.now()
    const delta = Math.min((now - this.clock.lastTime) / 1000, 0.1)
    this.clock.lastTime = now
    this.clock.elapsed += delta

    const audio = this.analyzer?.getAudioData() ?? {
      bass: 0, mid: 0, treble: 0, volume: 0,
      beat: false, bpm: 120, spectralCentroid: 0,
      frequencies: new Uint8Array(0),
      waveform: new Uint8Array(0),
    }

    if (audio.beat) {
      this.bgFlash = 1.0
    } else {
      this.bgFlash = Math.max(0, this.bgFlash - delta * 5)
    }

    // Hue drifts at mode-specific speed
    const cfg = BG_CONFIG[this.activeVisualMode]
    this.bgHue += delta * (cfg.hueSpeed + audio.treble * 0.04)
    if (audio.beat) this.bgHue += 0.04
    this.bgHue %= 1

    const u = this.bgMat.uniforms
    u.uTime.value   = this.clock.elapsed
    u.uHue.value    = this.bgHue
    u.uFlash.value  = this.bgFlash
    u.uBass.value   = audio.bass
    u.uMid.value    = audio.mid
    u.uTreble.value = audio.treble

    if (!this.isOrtho) {
      this.camera.position.x = Math.sin(this.clock.elapsed * 0.1) * 3
      this.camera.position.y = Math.cos(this.clock.elapsed * 0.08) * 2
    }

    this.currentMode?.update(audio, delta, this.clock.elapsed)

    const cam = this.isOrtho ? this.orthoCamera : this.camera

    this.renderer.clear()
    this.renderer.render(this.bgScene, this.orthoCamera)
    this.renderer.clearDepth()
    this.renderer.render(this.scene, cam)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.currentMode?.dispose()
    this.bgMat.dispose()
    this.bgMesh.geometry.dispose()
    this.renderer.domElement.remove()
    this.renderer.dispose()
  }
}
