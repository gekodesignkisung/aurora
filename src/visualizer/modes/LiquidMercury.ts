import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const VERT = /* glsl */`
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
varying float vHeight;
varying vec2 vUv;

// 2D Simplex noise
vec3 _perm(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod(i, 289.0);
  vec3 p = _perm(_perm(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0*fract(p*C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x *x0.x  + h.x *x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m, g);
}

float wv(vec2 p, float freq, float spd, float amp) {
  return sin(p.x*freq + uTime*spd) * cos(p.y*freq*0.7 + uTime*spd*0.8) * amp;
}

void main() {
  vUv = uv;
  vec2 xz = position.xz;

  float h = wv(xz, 0.22, 1.1,  2.0 + uBass*5.0)
          + wv(xz, 0.58, 0.75, 1.0 + uMid*2.5)
          + wv(xz, 1.35, 2.0,  0.4 + uTreble*1.2)
          + snoise(xz*0.12 + uTime*0.22) * (1.5 + uBass*3.0)
          + uBeat*6.0*exp(-dot(xz,xz)*0.005);

  vHeight = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, h, position.z, 1.0);
}
`

const FRAG = /* glsl */`
varying float vHeight;
varying vec2 vUv;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0);
  return l + s*(rgb-0.5)*(1.0-abs(2.0*l-1.0));
}

void main() {
  float hue = mod(
    vUv.x*0.5 + vUv.y*0.3
    + vHeight*0.025
    + uTime*0.05
    + uBass*0.3,
    1.0
  );
  float sat = 0.35 + uMid*0.10;
  float lit = 0.38 + uTreble*0.12;

  vec3 col = hsl2rgb(hue, sat, lit);
  gl_FragColor = vec4(col, 1.0);
}
`

// Default camera state before liquid-mercury takes over
const CAM_DEFAULT_POS = new THREE.Vector3(0, 0, 30)
const CAM_DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)

export class LiquidMercury implements IVisualMode {
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private uniforms: Record<string, THREE.IUniform>
  private beatDecay = 0
  private camera: THREE.PerspectiveCamera | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene

    const res = window.innerWidth < 768 ? 80 : 140
    const geo = new THREE.PlaneGeometry(200, 200, res, res)
    geo.rotateX(-Math.PI / 2)   // fully flat — optimal for top-down view

    this.uniforms = {
      uTime:   { value: 0 },
      uBass:   { value: 0 },
      uMid:    { value: 0 },
      uTreble: { value: 0 },
      uBeat:   { value: 0 },
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      wireframe: true,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.y = -6
    scene.add(this.mesh)
  }

  onModeEnter(camera?: THREE.PerspectiveCamera): void {
    if (!camera) return
    this.camera = camera
  }

  onModeExit(camera?: THREE.PerspectiveCamera): void {
    if (!camera) return
    camera.position.copy(CAM_DEFAULT_POS)
    camera.lookAt(CAM_DEFAULT_TARGET)
    this.camera = null
  }

  update(audio: AudioData, delta: number, elapsed: number): void {
    const { bass, mid, treble, beat } = audio

    // Exponential beat decay
    if (beat) this.beatDecay = 1.0
    this.beatDecay *= Math.exp(-delta * 5.0)

    const u = this.uniforms
    u.uTime.value   = elapsed
    u.uBass.value   = bass
    u.uMid.value    = mid
    u.uTreble.value = treble
    u.uBeat.value   = this.beatDecay

    // 45° bird's eye: equal vertical and horizontal distance to target
    if (this.camera) {
      const height = 30 - this.beatDecay * 5
      this.camera.position.set(
        Math.sin(elapsed * 0.07) * 8,
        height,
        Math.cos(elapsed * 0.05) * 4 + 36,
      )
      this.camera.lookAt(
        Math.sin(elapsed * 0.11) * 12,
        -6 + Math.sin(elapsed * 0.09) * 3,
        Math.cos(elapsed * 0.13) * 10,
      )
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.scene.remove(this.mesh)
  }
}
