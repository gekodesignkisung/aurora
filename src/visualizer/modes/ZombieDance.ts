import * as THREE from 'three'
import type { IVisualMode } from '@/types/visual'
import type { AudioData } from '@/types/audio'

const MIN_DANCERS = 4
const MAX_DANCERS = 16

const L = {
  neck:     0.6,
  spine:    2.8,
  hip:      1.4,
  shoulder: 3.2,
  upperArm: 4.2,
  foreArm:  3.8,
  upperLeg: 4.5,
  lowerLeg: 4.0,
  head:     1.2,
}

// ─── Rig ────────────────────────────────────────────────────────────────────
interface DancerRig {
  root: THREE.Group
  hips: THREE.Group; spine: THREE.Group; chest: THREE.Group; neck: THREE.Group
  lShoulder: THREE.Group; rShoulder: THREE.Group
  lElbow: THREE.Group;    rElbow: THREE.Group
  lHip: THREE.Group;      rHip: THREE.Group
  lKnee: THREE.Group;     rKnee: THREE.Group
  drawables: (THREE.Line | THREE.Mesh)[]
}

function buildRig(color: THREE.Color): DancerRig {
  const drawables: (THREE.Line | THREE.Mesh)[] = []

  function seg(parent: THREE.Group, a: THREE.Vector3, b: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b])
    const mat = new THREE.LineBasicMaterial({ color })
    const l = new THREE.Line(geo, mat)
    parent.add(l); drawables.push(l)
  }
  function dot(parent: THREE.Group, pos: THREE.Vector3, r = 0.2) {
    const geo = new THREE.SphereGeometry(r, 8, 6)
    const mat = new THREE.MeshBasicMaterial({ color })
    const m = new THREE.Mesh(geo, mat)
    m.position.copy(pos); parent.add(m); drawables.push(m)
  }

  const mk = () => new THREE.Group()
  const root = mk(), hips = mk(), spine = mk(), chest = mk(), neck = mk()
  const lShoulder = mk(), rShoulder = mk(), lElbow = mk(), rElbow = mk()
  const lHip = mk(), rHip = mk(), lKnee = mk(), rKnee = mk()

  // hierarchy
  root.add(hips)
  hips.add(spine); hips.add(lHip); hips.add(rHip)
  spine.add(chest)
  chest.add(neck); chest.add(lShoulder); chest.add(rShoulder)
  lShoulder.add(lElbow); rShoulder.add(rElbow)
  lHip.add(lKnee); rHip.add(rKnee)

  // pivot positions
  lHip.position.set(-L.hip * .5, 0, 0)
  rHip.position.set( L.hip * .5, 0, 0)
  lKnee.position.set(0, -L.upperLeg, 0)
  rKnee.position.set(0, -L.upperLeg, 0)
  chest.position.set(0, L.spine, 0)
  lShoulder.position.set(-L.shoulder * .5, 0, 0)
  rShoulder.position.set( L.shoulder * .5, 0, 0)
  lElbow.position.set(0, -L.upperArm, 0)
  rElbow.position.set(0, -L.upperArm, 0)

  const O = new THREE.Vector3

  // body segments
  seg(hips,  new THREE.Vector3(-L.hip*.5,0,0),  new THREE.Vector3(L.hip*.5,0,0))
  seg(spine, O.clone(),                          new THREE.Vector3(0,L.spine,0))
  seg(chest, new THREE.Vector3(-L.shoulder*.5,0,0), new THREE.Vector3(L.shoulder*.5,0,0))

  // legs (straight — no foot bend)
  seg(lHip,  O.clone(), new THREE.Vector3(0,-L.upperLeg,0))
  seg(rHip,  O.clone(), new THREE.Vector3(0,-L.upperLeg,0))
  seg(lKnee, O.clone(), new THREE.Vector3(0,-L.lowerLeg,0))
  seg(rKnee, O.clone(), new THREE.Vector3(0,-L.lowerLeg,0))

  // arms
  seg(lShoulder, O.clone(), new THREE.Vector3(0,-L.upperArm,0))
  seg(rShoulder, O.clone(), new THREE.Vector3(0,-L.upperArm,0))
  seg(lElbow,    O.clone(), new THREE.Vector3(0,-L.foreArm,0))
  seg(rElbow,    O.clone(), new THREE.Vector3(0,-L.foreArm,0))

  // neck
  seg(neck, O.clone(), new THREE.Vector3(0,L.neck,0))

  // head — circle centered just above neck tip
  const headCy = L.neck + L.head
  const headR  = L.head
  const headPts: THREE.Vector3[] = []
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2
    headPts.push(new THREE.Vector3(Math.cos(a) * headR, headCy + Math.sin(a) * headR, 0))
  }
  const headLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(headPts),
    new THREE.LineBasicMaterial({ color }))
  neck.add(headLine); drawables.push(headLine)


  return { root, hips, spine, chest, neck, lShoulder, rShoulder,
           lElbow, rElbow, lHip, rHip, lKnee, rKnee, drawables }
}

function setRigColor(rig: DancerRig, col: THREE.Color) {
  for (const d of rig.drawables) {
    ;(d.material as THREE.LineBasicMaterial | THREE.MeshBasicMaterial).color.copy(col)
  }
}

// ─── Dance Moves (stateless) ─────────────────────────────────────────────────
interface JointState {
  hipsY: number; hipsZ: number
  spineX: number; spineZ: number
  chestY: number
  neckX: number; neckZ: number
  lShX: number; lShZ: number; rShX: number; rShZ: number
  lElX: number; rElX: number
  lHiX: number; lHiZ: number; rHiX: number; rHiZ: number
  lKnX: number; rKnX: number
  rootBounce: number
}

type MoveFn = (t: number, e: number, b: number, m: number, ph: number) => JointState

const MOVES: MoveFn[] = [

  // 0. BOUNCE
  (t, e, b, m, ph) => {
    const cy  = Math.sin(t * 4 + ph)
    const arm = Math.sin(t * 2 + ph)
    return {
      hipsY: Math.sin(t * 1.2 + ph) * .2, hipsZ: cy * .1 * e,
      spineX: 0, spineZ: cy * .07,
      chestY: 0, neckX: cy * .15, neckZ: 0,
      lShX:  arm * .5,  lShZ:  .15, rShX: -arm * .5, rShZ: -.15,
      lElX: -.5, rElX: -.5,
      lHiX:  cy * .2, lHiZ:  .05, rHiX: -cy * .2, rHiZ: -.05,
      lKnX: Math.max(0, -cy) * .5, rKnX: Math.max(0, cy) * .5,
      rootBounce: Math.abs(cy) * .4 * e,
    }
  },

  // 1. RUNNING MAN
  (t, e, b, m, ph) => {
    const cy  = Math.sin(t * 5 + ph)
    return {
      hipsY: 0, hipsZ: cy * .08,
      spineX: cy * .08, spineZ: 0,
      chestY: -cy * .15, neckX: 0, neckZ: 0,
      lShX:  cy * .9,  lShZ:  .1, rShX: -cy * .9, rShZ: -.1,
      lElX: -.7 * e, rElX: -.7 * e,
      lHiX:  cy * .8 * e, lHiZ: 0, rHiX: -cy * .8 * e, rHiZ: 0,
      lKnX: -Math.max(0, -Math.sin(t*5+ph+.3)) * 1.2,
      rKnX: -Math.max(0,  Math.sin(t*5+ph+.3)) * 1.2,
      rootBounce: Math.abs(cy) * .3 * e,
    }
  },

  // 2. RAISE THE ROOF
  (t, e, b, m, ph) => {
    const pump  = Math.sin(t * 4 + ph) * e
    const kneel = .4 + b * .3
    return {
      hipsY: Math.sin(t*2+ph) * .15, hipsZ: pump * .1,
      spineX: -.1, spineZ: pump * .08,
      chestY: Math.sin(t*1.5+ph) * .2,
      neckX: -.1, neckZ: Math.sin(t*4+ph) * .12,
      lShX: -Math.PI * .55 + pump * .2, lShZ:  .2,
      rShX: -Math.PI * .55 - pump * .2, rShZ: -.2,
      lElX:  .9 + pump * .3, rElX:  .9 - pump * .3,
      lHiX:  .1, lHiZ:  .05, rHiX: -.1, rHiZ: -.05,
      lKnX: -kneel, rKnX: -kneel,
      rootBounce: pump * .35,
    }
  },

  // 3. WAVE ARMS
  (t, e, b, m, ph) => {
    const lSh  = Math.sin(t*2.5+ph) * 1.4 * e
    const rSh  = Math.sin(t*2.5+ph+1.4) * 1.4 * e
    const sway = Math.sin(t*1.5+ph) * .25
    return {
      hipsY: sway*.5, hipsZ: sway*.4,
      spineX: Math.sin(t*1.5+ph)*.1, spineZ: sway*.25,
      chestY: Math.sin(t*1.2+ph)*.3,
      neckX: Math.sin(t*2.5+ph)*.3, neckZ: sway*.4,
      lShX: lSh, lShZ:  .2 + Math.sin(t*2+ph)*.5,
      rShX: rSh, rShZ: -.2 - Math.sin(t*2+ph)*.5,
      lElX: lSh > 0 ? -1.1 : -.2, rElX: rSh > 0 ? -1.1 : -.2,
      lHiX:  Math.sin(t*2.5+ph)*.2, lHiZ:  .08,
      rHiX: -Math.sin(t*2.5+ph)*.2, rHiZ: -.08,
      lKnX: .15, rKnX: .15,
      rootBounce: Math.abs(sway) * .4,
    }
  },

  // 4. HEADBANG
  (t, e, b, m, ph) => {
    const bang  = Math.sin(t*5+ph)
    const stomp = Math.abs(bang) * e
    return {
      hipsY: bang*.15, hipsZ: 0,
      spineX: bang*.35*e, spineZ: 0,
      chestY: 0, neckX: bang*.8*e, neckZ: bang*.15,
      lShX: -bang*.6*e, lShZ:  .4,
      rShX: -bang*.6*e, rShZ: -.4,
      lElX: -1.4*e, rElX: -1.4*e,
      lHiX:  stomp*.6, lHiZ:  .05, rHiX: -stomp*.6, rHiZ: -.05,
      lKnX: Math.max(0,-bang)*1.0, rKnX: Math.max(0,bang)*1.0,
      rootBounce: stomp * .5,
    }
  },

  // 5. LEAN GROOVE
  (t, e, b, m, ph) => {
    const lean = Math.sin(t*2+ph) * .4 * e
    const alt  = Math.sin(t*2+ph)
    return {
      hipsY: 0, hipsZ: lean*.5,
      spineX: 0, spineZ: lean,
      chestY: Math.sin(t*1.5+ph)*.2,
      neckX: 0, neckZ: -lean*.4,
      lShX: alt > 0 ? -Math.PI*.5 : .3, lShZ:  .1,
      rShX: alt < 0 ? -Math.PI*.5 : .3, rShZ: -.1,
      lElX: alt > 0 ? 1.0 : -.4, rElX: alt < 0 ? 1.0 : -.4,
      lHiX:  Math.sin(t*2+ph)*.2, lHiZ: lean*.1,
      rHiX: -Math.sin(t*2+ph)*.2, rHiZ: lean*.1,
      lKnX: .15, rKnX: .15,
      rootBounce: Math.abs(lean)*.25,
    }
  },

  // 6. BODY ROLL
  (t, e, b, m, ph) => {
    const roll  = Math.sin(t*3+ph)
    const cycle = Math.sin(t*1.5+ph)
    return {
      hipsY: cycle*.2, hipsZ: Math.sin(t*3+ph+.3)*.15*e,
      spineX: roll*.25*e, spineZ: 0,
      chestY: 0, neckX: -roll*.2*e, neckZ: 0,
      lShX: .3, lShZ:  .2+cycle*.2,
      rShX: .3, rShZ: -.2-cycle*.2,
      lElX: -.6, rElX: -.6,
      lHiX:  roll*.3*e, lHiZ: 0, rHiX: -roll*.3*e, rHiZ: 0,
      lKnX: Math.max(0,-roll)*.7, rKnX: Math.max(0,roll)*.7,
      rootBounce: Math.abs(roll)*.2,
    }
  },

  // 7. ROBOT
  (t, e, b, m, ph) => {
    const ts  = Math.round((t*2+ph) / (Math.PI*.5)) * (Math.PI*.5)
    const arm = Math.sign(Math.sin(ts))
    const leg = Math.sign(Math.cos(ts))
    return {
      hipsY: 0, hipsZ: arm*.1,
      spineX: 0, spineZ: 0,
      chestY: arm*.2, neckX: 0, neckZ: arm*.1,
      lShX: arm > 0 ? -Math.PI*.4 : .4, lShZ:  .15,
      rShX: arm < 0 ? -Math.PI*.4 : .4, rShZ: -.15,
      lElX: arm > 0 ? 1.1 : 0, rElX: arm < 0 ? 1.1 : 0,
      lHiX:  leg*.4*e, lHiZ:  .05, rHiX: -leg*.4*e, rHiZ: -.05,
      lKnX: leg > 0 ? .6 : 0, rKnX: leg < 0 ? .6 : 0,
      rootBounce: .1,
    }
  },

  // 8. CROUCH PUMP
  (t, e, b, m, ph) => {
    const pump = Math.sin(t*4+ph)
    const low  = .6 + b*.2
    return {
      hipsY: Math.sin(t*2+ph)*.2, hipsZ: pump*.1,
      spineX: pump*.15*e, spineZ: Math.sin(t*2+ph)*.1,
      chestY: Math.sin(t*1.5+ph)*.25,
      neckX: pump*.1, neckZ: Math.sin(t*2+ph)*.1,
      lShX:  pump*.5, lShZ:  .25, rShX: -pump*.5, rShZ: -.25,
      lElX: -1.0, rElX: -1.0,
      lHiX:  .3, lHiZ:  .1, rHiX: -.3, rHiZ: -.1,
      lKnX: -low, rKnX: -low,
      rootBounce: -low*1.2 + Math.abs(pump)*.3*e,
    }
  },

  // 9. SPIN STEP
  (t, e, b, m, ph) => {
    const step = Math.sin(t*4+ph)
    return {
      hipsY: t*.5+ph, hipsZ: step*.1,
      spineX: 0, spineZ: 0,
      chestY: t*.3+ph,
      neckX: Math.sin(t*2+ph)*.25, neckZ: Math.cos(t*1.5+ph)*.2,
      lShX:  .1, lShZ:  Math.PI*.4,
      rShX:  .1, rShZ: -Math.PI*.4,
      lElX: -.4, rElX: -.4,
      lHiX:  step*.5*e, lHiZ:  .05, rHiX: -step*.5*e, rHiZ: -.05,
      lKnX: Math.max(0,-step)*.5, rKnX: Math.max(0,step)*.5,
      rootBounce: Math.abs(step)*.25,
    }
  },

  // 10. DISCO – alternating one arm high one arm low, head shakes
  (t, e, b, m, ph) => {
    const beat4 = Math.sin(t*4+ph)
    const alt   = Math.sign(beat4)
    return {
      hipsY: Math.sin(t*2+ph)*.3, hipsZ: beat4*.15,
      spineX: beat4*.1, spineZ: beat4*.1,
      chestY: Math.sin(t*3+ph)*.3,
      neckX: Math.sin(t*4+ph)*.35, neckZ: Math.sin(t*3+ph+.5)*.25,
      lShX: alt > 0 ? -Math.PI*.65 : .5,  lShZ:  .2,
      rShX: alt < 0 ? -Math.PI*.65 : .5,  rShZ: -.2,
      lElX: alt > 0 ?  1.2 : -.5, rElX: alt < 0 ?  1.2 : -.5,
      lHiX:  beat4*.4*e, lHiZ: .05, rHiX: -beat4*.4*e, rHiZ: -.05,
      lKnX: Math.max(0,-beat4)*.5, rKnX: Math.max(0,beat4)*.5,
      rootBounce: Math.abs(beat4)*.5*e,
    }
  },

  // 11. FREESTYLE – big arm sweeps, full-body expression
  (t, e, b, m, ph) => {
    const sweep = Math.sin(t*1.8+ph)
    const fast  = Math.sin(t*5+ph)
    const slow  = Math.sin(t*.9+ph)
    return {
      hipsY: slow*.3, hipsZ: fast*.1,
      spineX: sweep*.2*e, spineZ: slow*.15,
      chestY: Math.sin(t*1.3+ph)*.4,
      neckX: Math.sin(t*3+ph)*.4, neckZ: Math.sin(t*2+ph)*.3,
      lShX: Math.sin(t*1.5+ph)*1.2*e,  lShZ:  .3+sweep*.4,
      rShX: Math.sin(t*1.5+ph+1.0)*1.2*e, rShZ: -.3-sweep*.4,
      lElX: Math.sin(t*2+ph)*-.9,  rElX: Math.sin(t*2+ph+.8)*-.9,
      lHiX:  fast*.5*e, lHiZ: slow*.1,
      rHiX: -fast*.5*e, rHiZ: slow*.1,
      lKnX: Math.max(0,-fast)*.8, rKnX: Math.max(0,fast)*.8,
      rootBounce: (Math.abs(sweep)+Math.abs(fast)*.3)*e*.4,
    }
  },

  // 12. SQUAT — 앉았다 일어났다
  (t, e, b, m, ph) => {
    const squat = Math.sin(t * 1.2 + ph) * .5 + .5   // 0~1
    const depth = squat * 3.5 * e
    return {
      hipsY: 0, hipsZ: Math.sin(t*2+ph)*.12,
      spineX: squat*.25, spineZ: 0,
      chestY: Math.sin(t*1.2+ph)*.15,
      neckX: squat*.1, neckZ: 0,
      lShX: .3,  lShZ:  .5 + squat*.3,
      rShX: .3,  rShZ: -.5 - squat*.3,
      lElX: -.6, rElX: -.6,
      lHiX:  .4 + squat*.4, lHiZ:  .1,
      rHiX:  .4 + squat*.4, rHiZ: -.1,
      lKnX: -(squat * 1.8 + .1), rKnX: -(squat * 1.8 + .1),
      rootBounce: -depth,
    }
  },

  // 13. ARM RAISE — 두 팔 천천히 치켜올렸다 내렸다
  (t, e, b, m, ph) => {
    const raise = Math.sin(t * 0.9 + ph)             // -1 ~ 1
    const body  = Math.sin(t * 0.6 + ph) * .15
    return {
      hipsY: body*.5, hipsZ: body*.3,
      spineX: raise*.08, spineZ: body,
      chestY: Math.sin(t*0.7+ph)*.2,
      neckX: -raise*.15, neckZ: body*.5,
      lShX: -Math.PI * (.3 + (raise*.5+.5)*.6), lShZ:  .1,
      rShX: -Math.PI * (.3 + (raise*.5+.5)*.6), rShZ: -.1,
      lElX:  .4 + raise*.3, rElX:  .4 + raise*.3,
      lHiX:  Math.sin(t*1.8+ph)*.15, lHiZ:  .05,
      rHiX: -Math.sin(t*1.8+ph)*.15, rHiZ: -.05,
      lKnX: .1, rKnX: .1,
      rootBounce: Math.abs(body) * .3,
    }
  },

  // 14. BODY TWIST — 좌우 몸통 크게 회전
  (t, e, b, m, ph) => {
    const twist = Math.sin(t * 1.5 + ph)
    const step  = Math.sin(t * 3 + ph)
    return {
      hipsY: twist * .5,  hipsZ: twist * .15,
      spineX: 0,          spineZ: twist * .2,
      chestY: twist * .7,
      neckX: step * .15, neckZ: -twist * .25,
      lShX:  step * .6 * e,   lShZ:  .15 + twist * .3,
      rShX: -step * .6 * e,   rShZ: -.15 + twist * .3,
      lElX: step > 0 ? -1.0 : -.3,  rElX: step < 0 ? -1.0 : -.3,
      lHiX:  step * .4 * e, lHiZ:  twist * .1,
      rHiX: -step * .4 * e, rHiZ:  twist * .1,
      lKnX: Math.max(0,-step) * .5, rKnX: Math.max(0,step) * .5,
      rootBounce: Math.abs(step) * .2 * e,
    }
  },
]

const MOVE_JUMP = MOVES.length       // 10
const MOVE_FLIP = MOVES.length + 1  // 11
const TOTAL_MOVES = MOVES.length + 2

// ─── Dancer state ─────────────────────────────────────────────────────────────
interface Dancer {
  rig:       DancerRig
  baseX:     number
  baseY:     number
  phase:     number
  speedMul:  number
  flash:     number
  hueOff:    number
  t:         number
  moveIdx:   number
  moveTimer: number
  moveDur:   number
  beatCount: number
  // Jump / flip state
  jumpVel:   number
  jumpY:     number
  spinAngle: number
  armT:      number   // arm-only fast clock
  kickSide:  number   // 0=left 1=right, alternates on beat
  kickPow:   number   // 0~1 decays after beat
}

function lerpRot(g: THREE.Group, x: number, y: number, z: number, a: number) {
  g.rotation.x += (x - g.rotation.x) * a
  g.rotation.y += (y - g.rotation.y) * a
  g.rotation.z += (z - g.rotation.z) * a
}

function nextMove(d: Dancer) {
  // avoid picking same move or another jump/flip immediately
  let next = (d.moveIdx + 1 + Math.floor(Math.random() * 4)) % TOTAL_MOVES
  // Limit jump/flip frequency — only allow every ~3 moves
  if ((next === MOVE_JUMP || next === MOVE_FLIP) && Math.random() > 0.3) {
    next = Math.floor(Math.random() * MOVES.length)
  }
  d.moveIdx   = next
  d.moveTimer = 0
  d.beatCount = 0
  d.moveDur   = 3 + Math.random() * 4
}

export class ZombieDance implements IVisualMode {
  private scene:    THREE.Scene
  private dancers:  Dancer[] = []
  private hue       = 0
  private beatBoost = 0
  private camera:      THREE.PerspectiveCamera | null = null
  private _camJumpVel  = 0
  private _camJumpY    = 0
  private grid:        THREE.GridHelper | null = null
  private _onTrackChange = () => this._reinitDancers()

  private _spawnDancers() {
    const count = MIN_DANCERS + Math.floor(Math.random() * (MAX_DANCERS - MIN_DANCERS + 1))
    const feetY = -(L.upperLeg + L.lowerLeg)
    const baseY = -feetY - 8

    for (let i = 0; i < count; i++) {
      const hueOff   = i / count
      const color    = new THREE.Color().setHSL(hueOff, 0.9, 0.65)
      const rig      = buildRig(color)
      const baseZ    = -30 + Math.random() * 55
      const xSpread  = 20 + (baseZ + 30) * 1.2
      const baseX    = (Math.random() - 0.5) * xSpread
      const phase    = Math.random() * Math.PI * 2
      const speedMul = 0.85 + Math.random() * 0.35

      rig.root.position.set(baseX, baseY, baseZ)
      this.scene.add(rig.root)

      this.dancers.push({
        rig, baseX, baseY,
        phase, speedMul,
        flash: 0, hueOff, t: Math.random() * 10,
        moveIdx:   Math.floor(Math.random() * MOVES.length),
        moveTimer: Math.random() * 3,
        moveDur:   3 + Math.random() * 4,
        beatCount: 0,
        jumpVel: 0, jumpY: 0, spinAngle: 0, armT: Math.random() * 10,
        kickSide: i % 2, kickPow: 0,
      })
    }
  }

  private _reinitDancers() {
    // Remove existing dancers
    for (const d of this.dancers) {
      d.rig.root.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else (obj.material as THREE.Material).dispose()
        }
      })
      d.rig.root.removeFromParent()
    }
    this.dancers = []
    this._spawnDancers()
  }

  onModeEnter(camera?: THREE.PerspectiveCamera) {
    if (camera) this.camera = camera
  }

  onModeExit() {
    // reset camera to default
    if (this.camera) {
      this.camera.position.set(0, 0, 30)
      this.camera.lookAt(0, 0, 0)
      this.camera = null
    }
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene

    // Floor grid
    const grid = new THREE.GridHelper(80, 20, 0xffffff, 0xffffff)
    grid.position.y = -8
    ;(grid.material as THREE.LineBasicMaterial).transparent = true
    ;(grid.material as THREE.LineBasicMaterial).opacity = 0.15
    scene.add(grid)
    this.grid = grid

    this._spawnDancers()
    window.addEventListener('aurora:trackChange', this._onTrackChange)
  }

  update(audio: AudioData, delta: number, elapsed: number): void {
    const { bass, mid, treble, beat } = audio
    const dt = Math.min(delta, 0.05)

    // Grid color pulse on beat
    if (this.grid) {
      const mat = this.grid.material as THREE.LineBasicMaterial
      mat.opacity = 0.15 + this.beatBoost * 0.3 + bass * 0.1
    }

    // Camera beat-jump: physics bounce on beat
    if (beat) {
      this._camJumpVel = 4 + audio.volume * 6
    }
    this._camJumpVel -= 28 * dt
    this._camJumpY = Math.max(0, this._camJumpY + this._camJumpVel * dt)

    // Camera sweep — left/right slow, up/down medium + beat jump
    if (this.camera) {
      const cam = this.camera
      const cx = Math.sin(elapsed * 0.18) * 18 + Math.sin(elapsed * 0.07) * 8
      const cy = Math.sin(elapsed * 0.23) * 6 + 2 + bass * 2 + this._camJumpY
      const cz = 28 + Math.sin(elapsed * 0.11) * 6 - this.beatBoost * 2
      cam.position.x += (cx - cam.position.x) * dt * 1.2
      cam.position.y += (cy - cam.position.y) * dt * 3.5
      cam.position.z += (cz - cam.position.z) * dt * 1.2
      cam.lookAt(Math.sin(elapsed * 0.15) * 4, Math.sin(elapsed * 0.19) * 2, 0)
    }

    this.hue = (this.hue + dt * (0.04 + treble * 0.06)) % 1
    if (beat) this.beatBoost = 1.0
    else      this.beatBoost = Math.max(0, this.beatBoost - dt * 5)

    for (const d of this.dancers) {
      if (beat) {
        d.flash    = 1.0
        d.beatCount++
        d.kickPow  = 1.0
        d.kickSide = 1 - d.kickSide   // alternate legs
      }
      d.flash   = Math.max(0, d.flash   - dt * 5)
      d.kickPow = Math.max(0, d.kickPow - dt * 6)

      // Move switching
      d.moveTimer += dt
      if (d.beatCount > 0 && d.beatCount % 8 === 0) nextMove(d)
      else if (d.moveTimer > d.moveDur) nextMove(d)

      const energy = 0.4 + bass * 0.7 + this.beatBoost * 0.5
      d.t    += dt * d.speedMul * (0.8 + bass * 0.5 + this.beatBoost * 0.4)
      d.armT += dt * d.speedMul * (2.5 + bass * 1.5 + this.beatBoost * 1.0)
      const spd = 12 * dt
      const { rig } = d

      // ── SPECIAL: JUMP ──────────────────────────────────────────────────────
      if (d.moveIdx === MOVE_JUMP) {
        // Launch on entry
        if (d.jumpVel === 0 && d.jumpY === 0) d.jumpVel = 9 + energy * 3

        d.jumpVel -= 22 * dt
        d.jumpY    = Math.max(0, d.jumpY + d.jumpVel * dt)

        // Tucked body during jump
        lerpRot(rig.hips,      0, 0, 0, spd)
        lerpRot(rig.spine,     0, 0, 0, spd)
        lerpRot(rig.chest,     0, 0, 0, spd)
        lerpRot(rig.neck,      -.1, 0, 0, spd)
        lerpRot(rig.lShoulder, 0, 0,  .9, spd)
        lerpRot(rig.rShoulder, 0, 0, -.9, spd)
        lerpRot(rig.lElbow,    -.6, 0, 0, spd)
        lerpRot(rig.rElbow,    -.6, 0, 0, spd)
        lerpRot(rig.lHip,      -1.1, 0,  .1, spd)
        lerpRot(rig.rHip,      -1.1, 0, -.1, spd)
        lerpRot(rig.lKnee,      1.7, 0, 0, spd)
        lerpRot(rig.rKnee,      1.7, 0, 0, spd)

        rig.root.position.y  = d.baseY + d.jumpY
        rig.root.position.x  = d.baseX
        rig.root.rotation.x  = 0
        rig.root.rotation.y  = Math.sin(elapsed * .2 + d.phase) * .2

        // Land
        if (d.jumpY <= 0 && d.jumpVel < 0) {
          d.jumpVel = 0; d.jumpY = 0
          nextMove(d)
        }

      // ── SPECIAL: FLIP ──────────────────────────────────────────────────────
      } else if (d.moveIdx === MOVE_FLIP) {
        if (d.spinAngle === 0) d.jumpVel = 7   // initial upward arc

        d.jumpVel  -= 18 * dt
        d.jumpY     = Math.max(0, d.jumpY + d.jumpVel * dt)
        d.spinAngle += dt * Math.PI * 4    // ~2 full rotations per second

        // Straight-body during flip
        lerpRot(rig.hips,      0, 0, 0, spd)
        lerpRot(rig.spine,     0, 0, 0, spd)
        lerpRot(rig.chest,     0, 0, 0, spd)
        lerpRot(rig.neck,      -.15, 0, 0, spd)
        lerpRot(rig.lShoulder, -.4, 0,  .2, spd)
        lerpRot(rig.rShoulder, -.4, 0, -.2, spd)
        lerpRot(rig.lElbow,     .5, 0, 0, spd)
        lerpRot(rig.rElbow,     .5, 0, 0, spd)
        lerpRot(rig.lHip,      -.1, 0,  .05, spd)
        lerpRot(rig.rHip,      -.1, 0, -.05, spd)
        lerpRot(rig.lKnee,      .15, 0, 0, spd)
        lerpRot(rig.rKnee,      .15, 0, 0, spd)

        rig.root.position.y = d.baseY + d.jumpY
        rig.root.position.x = d.baseX
        rig.root.rotation.x = d.spinAngle
        rig.root.rotation.y = 0

        // Done after one full flip
        if (d.spinAngle >= Math.PI * 2) {
          d.spinAngle = 0; d.jumpVel = 0; d.jumpY = 0
          rig.root.rotation.x = 0
          nextMove(d)
        }

      // ── NORMAL MOVES ───────────────────────────────────────────────────────
      } else {
        const s = MOVES[d.moveIdx](d.t, energy, bass, mid, d.phase)

        lerpRot(rig.hips,      0,      s.hipsY,  s.hipsZ,  spd)
        lerpRot(rig.spine,     s.spineX, 0,       s.spineZ, spd)
        lerpRot(rig.chest,     0,      s.chestY,  0,        spd)
        lerpRot(rig.neck,      s.neckX, 0,        s.neckZ,  spd)
        // Arms use fast clock for more frequent movement
        const at      = d.armT
        const aSwing  = Math.sin(at * 2.2) * 0.5 * energy
        const aLift   = Math.sin(at * 1.7 + 1.0) * 0.4 * energy
        const aBend   = Math.abs(Math.sin(at * 2.8)) * 0.7
        const armSpd  = 18 * dt
        lerpRot(rig.lShoulder, s.lShX + aSwing,  0, s.lShZ + aLift,  armSpd)
        lerpRot(rig.rShoulder, s.rShX - aSwing,  0, s.rShZ - aLift,  armSpd)
        lerpRot(rig.lElbow,    s.lElX - aBend,   0, 0,               armSpd)
        lerpRot(rig.rElbow,    s.rElX - aBend,   0, 0,               armSpd)
        // Beat-reactive leg kick — alternates sides, snappy lerp
        const legSpd  = spd + d.kickPow * 20 * dt
        const lKick   = d.kickSide === 0 ? d.kickPow * 1.4 : 0
        const rKick   = d.kickSide === 1 ? d.kickPow * 1.4 : 0
        const lKneeFold = d.kickSide === 0 ? d.kickPow * -1.2 : 0
        const rKneeFold = d.kickSide === 1 ? d.kickPow * -1.2 : 0
        lerpRot(rig.lHip,  s.lHiX - lKick,  0, s.lHiZ, legSpd)
        lerpRot(rig.rHip,  s.rHiX - rKick,  0, s.rHiZ, legSpd)
        lerpRot(rig.lKnee, s.lKnX + lKneeFold, 0, 0,   legSpd)
        lerpRot(rig.rKnee, s.rKnX + rKneeFold, 0, 0,   legSpd)

        // Head side-to-side sway
        lerpRot(rig.neck, s.neckX, 0,
          s.neckZ + Math.sin(d.armT * 1.4) * 0.3, spd)

        rig.root.position.y  = d.baseY + s.rootBounce + this.beatBoost * .4
        rig.root.position.x  = d.baseX + Math.sin(elapsed * .4 + d.phase) * (.2 + mid * .3)
        rig.root.rotation.x  = 0
        rig.root.rotation.y  = Math.sin(elapsed * .2 + d.phase) * .2
      }

      // Color
      const hue   = (this.hue + d.hueOff) % 1
      const light = 0.5 + d.flash * 0.4 + this.beatBoost * 0.1 + treble * 0.1
      setRigColor(rig, new THREE.Color().setHSL(hue, 1.0, Math.min(light, 0.95)))
    }
  }

  dispose(): void {
    window.removeEventListener('aurora:trackChange', this._onTrackChange)
    if (this.grid) {
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
      this.grid.removeFromParent()
      this.grid = null
    }
    for (const d of this.dancers) {
      d.rig.root.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else (obj.material as THREE.Material).dispose()
        }
      })
      d.rig.root.removeFromParent()
    }
    this.dancers = []
  }
}
