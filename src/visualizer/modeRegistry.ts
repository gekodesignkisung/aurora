import * as THREE from 'three'
import type { VisualMode, IVisualMode } from '@/types/visual'
import { NebulaCloud }    from './modes/NebulaCloud'
import { StarField }     from './modes/StarField'
import { CrystalLattice } from './modes/CrystalLattice'
import { FreqTerrain }   from './modes/FreqTerrain'
import { MorphBlob }     from './modes/MorphBlob'
import { TunnelWarp }    from './modes/TunnelWarp'
export function createMode(mode: VisualMode, scene: THREE.Scene): IVisualMode {
  switch (mode) {
    case 'nebula-cloud':    return new NebulaCloud(scene)
    case 'star-field':      return new StarField(scene)
    case 'crystal-lattice': return new CrystalLattice(scene)
    case 'freq-terrain':    return new FreqTerrain(scene)
    case 'morph-blob':      return new MorphBlob(scene)
    case 'tunnel-warp':     return new TunnelWarp(scene)
  }
}
