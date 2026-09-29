/**
 * Resident state textures (SPEC §3.4, §8.4, §9.7, §9.9).
 *
 * For every state k: `pos[k]` RGBA32F (xyz local su, w = entering stagger
 * key) and `meta[k]` RGBA8 (ramp, alpha, param, role << 4 | group), 256
 * wide × N/256 tall, NearestFilter, no mipmaps. Crossing a segment boundary
 * only swaps sampler uniforms.
 *
 * The source Float32Array / Uint8Array stay referenced by each DataTexture
 * (`image.data`): three re-uploads them itself after `webglcontextrestored`
 * (its GPU caches are rebuilt from scratch), and the Canvas2D fallback reads
 * them. A resize regeneration builds a whole new set and swaps atomically.
 */
import type { DataTexture } from 'three';
import { HOME_STATES, STATE_COUNT, StateId } from './states/ids.ts';
import { makeMetaTexture, makePosTexture } from './material.ts';

export class TextureSet {
  readonly texH: number;
  /** Canvas CSS height the local positions were generated for (su ∝ 1 / H). */
  readonly genH: number;
  readonly genW: number;
  readonly pos: (DataTexture | null)[] = new Array(STATE_COUNT).fill(null);
  readonly meta: (DataTexture | null)[] = new Array(STATE_COUNT).fill(null);
  /** Per-state uniform extras from the generators (e.g. S2's uBarPivot). */
  readonly extras: (Record<string, number[]> | undefined)[] = new Array(STATE_COUNT).fill(undefined);
  private disposed = false;

  constructor(texH: number, genW: number, genH: number) {
    this.texH = texH;
    this.genW = genW;
    this.genH = genH;
  }

  has(id: StateId): boolean {
    return this.pos[id] !== null && this.meta[id] !== null;
  }

  /** Create or replace a state's textures (same-size replace re-uploads in place). */
  set(id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>): void {
    if (this.disposed) return;
    const p = this.pos[id];
    const m = this.meta[id];
    if (p && m && p.image.data?.length === pos.length) {
      p.image.data = pos;
      m.image.data = meta;
      p.needsUpdate = true;
      m.needsUpdate = true;
    } else {
      p?.dispose();
      m?.dispose();
      this.pos[id] = makePosTexture(pos, this.texH);
      this.meta[id] = makeMetaTexture(meta, this.texH);
    }
    this.extras[id] = extras;
  }

  /** Highest k such that S0…Sk (home chain) are all resident; −1 if S0 is missing. */
  ceiling(): number {
    let k = -1;
    for (const id of HOME_STATES) {
      if (!this.has(id)) break;
      k = id;
    }
    return k;
  }

  /** The cached arrays of a state (context restore, Canvas2D fallback). */
  arrays(id: StateId): { pos: Float32Array; meta: Uint8Array } | null {
    const p = this.pos[id];
    const m = this.meta[id];
    if (!p || !m) return null;
    return { pos: p.image.data as Float32Array, meta: m.image.data as Uint8Array };
  }

  /** Mark every texture for re-upload (belt and braces after a context restore). */
  touch(): void {
    for (let i = 0; i < STATE_COUNT; i++) {
      if (this.pos[i]) this.pos[i]!.needsUpdate = true;
      if (this.meta[i]) this.meta[i]!.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (let i = 0; i < STATE_COUNT; i++) {
      this.pos[i]?.dispose();
      this.meta[i]?.dispose();
      this.pos[i] = null;
      this.meta[i] = null;
    }
  }
}

/** States generated in the worker, in boot order (§9.9: S0 first, then S2–S9; S10 lazily). */
export const WORKER_BOOT_ORDER: readonly StateId[] = [
  StateId.STATIC,
  StateId.CHART,
  StateId.REDACTED,
  StateId.PULSE,
  StateId.LATTICE,
  StateId.DECK,
  StateId.CONSTELLATION,
  StateId.STACK,
  StateId.BEACON,
];
