import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const VERT = /* glsl */`
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uBeatAge;
varying float vHeight;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

// 2D Simplex noise
vec3 _perm(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  i = mod(i, 289.0);   // prevent float32 overflow in _perm at large uTime
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

// Radial envelope: full intensity at center, calm at edges
float env(vec2 p) {
  float d = length(p);
  return mix(0.25, 1.0, exp(-d * d * 0.0007));
}

// Beat + volume-driven surge spikes
float surge(vec2 xz) {
  // Orbiting spike positions (slow drift)
  vec2 sp1 = vec2(sin(uTime*0.37)*18.0, cos(uTime*0.29)*18.0);
  vec2 sp2 = vec2(cos(uTime*0.53)*12.0, sin(uTime*0.41)*12.0);
  vec2 sp3 = vec2(sin(uTime*0.19)*22.0, cos(uTime*0.23)*15.0);
  vec2 sp4 = vec2(cos(uTime*0.31)*8.0,  sin(uTime*0.27)*20.0);
  vec2 sp5 = vec2(sin(uTime*0.43)*16.0, cos(uTime*0.17)*10.0);

  // Beat: sharp center + 2 orbit spikes
  float s = uBeat * 16.0 * exp(-dot(xz,     xz)     * 0.025)
           + uBeat *  9.0 * exp(-dot(xz-sp1, xz-sp1) * 0.045)
           + uBeat *  6.0 * exp(-dot(xz-sp2, xz-sp2) * 0.055);

  // Bass volume: continuous drifting spikes — always responds to audio
  s += uBass * 9.0 * exp(-dot(xz-sp3, xz-sp3) * 0.030)
     + uBass * 6.5 * exp(-dot(xz-sp4, xz-sp4) * 0.038)
     + uBass * 4.5 * exp(-dot(xz-sp5, xz-sp5) * 0.045);

  // Mid: continuous bumps
  s += uMid * 4.5 * exp(-dot(xz-sp1, xz-sp1) * 0.022)
     + uMid * 3.0 * exp(-dot(xz-sp2, xz-sp2) * 0.028);

  return s;
}

void main() {
  vUv = uv;
  vec2 xz = position.xz;

  // Beat ring: expands outward from center on each beat
  float r    = length(xz);
  float ring = 7.0 * sin(r * 0.6 - uBeatAge * 28.0)
                   * exp(-r * 0.04 - uBeatAge * 2.5)
                   * step(uBeatAge, 1.8);   // fade out after 1.8s

  float e = env(xz);
  float h = (wv(xz, 0.10, 2.2,  0.4 + uBass*5.0)
           + wv(xz, 0.27, 1.5,  0.2 + uMid*3.5)
           + wv(xz, 0.55, 3.2,  0.1 + uTreble*2.0)
           + snoise(xz*0.07 + uTime*0.45) * (0.4 + uBass*4.0)
           + surge(xz)) * e
           + ring;

  vHeight = h;
  vec4 worldPos = modelMatrix * vec4(position.x, h, position.z, 1.0);
  vWorldPos = worldPos.xyz;

  // Approximate normal from wave gradient
  float eps = 0.8;
  vec2 pL = xz-vec2(eps,0.0); vec2 pR = xz+vec2(eps,0.0);
  vec2 pD = xz-vec2(0.0,eps); vec2 pU = xz+vec2(0.0,eps);
  float hL = (wv(pL,0.10,2.2,0.4+uBass*5.0)+wv(pL,0.27,1.5,0.2+uMid*3.5)+wv(pL,0.55,3.2,0.1+uTreble*2.0)+snoise(pL*0.07+uTime*0.45)*(0.4+uBass*4.0)+surge(pL))*env(pL);
  float hR = (wv(pR,0.10,2.2,0.4+uBass*5.0)+wv(pR,0.27,1.5,0.2+uMid*3.5)+wv(pR,0.55,3.2,0.1+uTreble*2.0)+snoise(pR*0.07+uTime*0.45)*(0.4+uBass*4.0)+surge(pR))*env(pR);
  float hD = (wv(pD,0.10,2.2,0.4+uBass*5.0)+wv(pD,0.27,1.5,0.2+uMid*3.5)+wv(pD,0.55,3.2,0.1+uTreble*2.0)+snoise(pD*0.07+uTime*0.45)*(0.4+uBass*4.0)+surge(pD))*env(pD);
  float hU = (wv(pU,0.10,2.2,0.4+uBass*5.0)+wv(pU,0.27,1.5,0.2+uMid*3.5)+wv(pU,0.55,3.2,0.1+uTreble*2.0)+snoise(pU*0.07+uTime*0.45)*(0.4+uBass*4.0)+surge(pU))*env(pU);
  float rL = length(xz - vec2(eps, 0.0));
  float rR = length(xz + vec2(eps, 0.0));
  float rD = length(xz - vec2(0.0, eps));
  float rU = length(xz + vec2(0.0, eps));
  float ringFn = 7.0 * exp(-uBeatAge * 2.5) * step(uBeatAge, 1.8);
  hL += ringFn * sin(rL*0.6 - uBeatAge*28.0) * exp(-rL*0.04);
  hR += ringFn * sin(rR*0.6 - uBeatAge*28.0) * exp(-rR*0.04);
  hD += ringFn * sin(rD*0.6 - uBeatAge*28.0) * exp(-rD*0.04);
  hU += ringFn * sin(rU*0.6 - uBeatAge*28.0) * exp(-rU*0.04);
  vNormal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, h, position.z, 1.0);
}
`

const FRAG = /* glsl */`
varying float vHeight;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeatAge;
uniform vec3  uCamPos;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0);
  return l + s*(rgb-0.5)*(1.0-abs(2.0*l-1.0));
}

void main() {
  vec3 n       = normalize(vNormal);
  vec3 viewDir = normalize(uCamPos - vWorldPos);
  float NdotV  = max(dot(n, viewDir), 0.0);

  // ── Fresnel (Schlick) ──────────────────────────────────────────────
  float F0      = 0.06;                          // mercury-like base reflectance
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 4.0);

  // ── Base color ────────────────────────────────────────────────────
  float hue = mod(
    vUv.x*0.5 + vUv.y*0.3 + vHeight*0.025 + uTime*0.05 + uBass*0.3,
    1.0
  );
  float sat = 0.7 + uMid*0.2;
  float lit = 0.34 + uTreble*0.12;
  vec3 baseCol = hsl2rgb(hue, sat, lit);

  // ── Iridescence (thin-film) ────────────────────────────────────────
  float iriShift = (1.0 - NdotV) * 0.65 + uTreble * 0.15;
  float iriHue   = mod(hue + iriShift, 1.0);
  vec3  iriCol   = hsl2rgb(iriHue, 1.0, 0.38 + uMid * 0.1);

  vec3 col = mix(baseCol, iriCol, fresnel * 0.85);

  // ── Multi-light (bass / mid / treble) ─────────────────────────────
  vec3 l1dir  = normalize(vec3(sin(uTime*0.31)*3.0, 4.0, cos(uTime*0.31)*3.0));
  vec3 l1col  = vec3(1.0, 0.55, 0.1) * (0.45 + uBass * 1.1);

  vec3 l2dir  = normalize(vec3(cos(uTime*0.47)*2.5, 2.0, sin(uTime*0.47)*2.5));
  vec3 l2col  = vec3(0.1, 0.8, 0.9) * (0.28 + uMid * 0.85);

  vec3 l3dir  = normalize(vec3(sin(uTime*0.73)*1.5, 5.0, cos(uTime*0.73)*1.5));
  vec3 l3col  = vec3(0.7, 0.2, 1.0) * (0.18 + uTreble * 1.3);

  float diff1 = max(dot(n, l1dir), 0.0);
  float diff2 = max(dot(n, l2dir), 0.0);
  float diff3 = max(dot(n, l3dir), 0.0);
  float ambient = 0.10;

  vec3 lighting = vec3(ambient) + l1col*diff1 + l2col*diff2 + l3col*diff3;

  // ── Specular — fresnel-boosted, per dominant light ─────────────────
  vec3 h1   = normalize(l1dir + viewDir);
  vec3 h3   = normalize(l3dir + viewDir);
  float sp1 = pow(max(dot(n, h1), 0.0), 64.0);
  float sp3 = pow(max(dot(n, h3), 0.0), 96.0);
  // Fresnel amplifies specular at grazing angles
  vec3 spec = (l1col * sp1 + l3col * sp3) * (0.6 + fresnel * 1.2) * (0.5 + uTreble * 0.8);

  // Beat flash: brief white-hot burst that fades quickly
  float flash = exp(-uBeatAge * 6.0) * step(uBeatAge, 1.0);
  vec3 flashCol = mix(vec3(1.0, 0.85, 0.5), vec3(0.6, 0.8, 1.0), fresnel); // warm→cool
  vec3 finalCol = col * lighting + spec + flashCol * flash * 0.7;

  gl_FragColor = vec4(finalCol, 1.0);
}
`

// Default camera state before liquid-mercury takes over
const CAM_DEFAULT_POS = new THREE.Vector3(0, 0, 30)
const CAM_DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)

export class LiquidMercury implements IVisualMode {
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private uniforms: Record<string, THREE.IUniform>
  private camera: THREE.PerspectiveCamera | null = null

  // Spring-based beat: overshoot then settle
  private beatPos = 0
  private beatVel = 0
  private beatAge = 999   // seconds since last beat (start large = no ring)
  private localTime = 0   // wrapping time to prevent float32 precision loss

  // Smoothed audio: fast attack, slow decay
  private bassS   = 0
  private midS    = 0
  private trebleS = 0

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
      uCamPos:   { value: new THREE.Vector3(0, 30, 36) },
      uBeatAge:  { value: 999 },
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      wireframe: false,
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
    const dt = Math.min(delta, 0.05)  // cap for stability

    // ── Smooth audio: very fast attack, moderate decay ──────────────
    const attack = 1 - Math.exp(-dt * 35)   // ~30ms rise — near-instant
    const decay  = 1 - Math.exp(-dt * 8)    // ~125ms fall — clear contrast
    this.bassS   += (bass   > this.bassS   ? attack : decay) * (bass   - this.bassS)
    this.midS    += (mid    > this.midS    ? attack : decay) * (mid    - this.midS)
    this.trebleS += (treble > this.trebleS ? attack : decay) * (treble - this.trebleS)

    // ── Spring beat: impulse → overshoot → settle ───────────────────
    if (beat) { this.beatVel += 2.8; this.beatAge = 0 }  // velocity impulse + ring reset
    this.beatAge += dt
    const springK  = 22.0
    const damping  = 2.8                   // underdamped = more bounce/overshoot
    this.beatVel  += (-springK * this.beatPos - damping * this.beatVel) * dt
    this.beatPos  += this.beatVel * dt
    this.beatPos   = Math.max(0, this.beatPos)  // clamp negative

    // Wrap local time to prevent float32 precision issues in shader (snoise, sin)
    this.localTime = (this.localTime + dt) % 628.318  // 200π — large enough to be infrequent

    const u = this.uniforms
    u.uTime.value   = this.localTime
    u.uBass.value   = this.bassS
    u.uMid.value    = this.midS
    u.uTreble.value = this.trebleS
    u.uBeat.value    = this.beatPos
    u.uBeatAge.value = this.beatAge

    // 45° bird's eye: equal vertical and horizontal distance to target
    if (this.camera) {
      const height = 42 - this.beatPos * 5
      const cx = Math.sin(elapsed * 0.18) * 8
      const cy = height
      const cz = Math.cos(elapsed * 0.13) * 4 + 50
      this.camera.position.set(cx, cy, cz)
      this.camera.lookAt(
        Math.sin(elapsed * 0.27) * 12,
        22 + Math.sin(elapsed * 0.22) * 3,
        Math.cos(elapsed * 0.31) * 10,
      )
      u.uCamPos.value.set(cx, cy, cz)
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.scene.remove(this.mesh)
  }
}
