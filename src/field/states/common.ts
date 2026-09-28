/**
 * Shared generator core (SPEC §3.3, §3.4, §9.9): the index layout (sparks,
 * then golden-ratio dust / shape interleave), the rank permutations, the
 * sort keys, dust, meta packing, and the small samplers every generator uses.
 *
 * Pure TS, no DOM, no three: the generator worker, the main-thread S1 name
 * sampler and (later) the Canvas2D fallback all import it. Everything is
 * deterministic (mulberry32 seeded with 0x5EB ^ stateId, §3.3), so the main
 * thread and the worker build identical layouts and dust independently.
 *
 * Adding a state: write `states/sNN-name.ts` exporting
 * `export const generator: StateGenerator = { id, sort, generate(ctx, out) }`.
 * The worker registry picks it up by filename (states/registry.ts).
 */
import type { LayoutMode } from '../layout.ts';
import type { StateId } from './ids.ts';
import { LIMITS, Role } from '../uniforms.ts';

// ---------------------------------------------------------------------------
// Determinism.

/** mulberry32 PRNG: a function returning floats in [0, 1). */
export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** §3.3: every state's generator is seeded with 0x5EB ^ stateId. */
export const stateSeed = (id: StateId): number => 0x5eb ^ id;
/** Seeds outside the state range (dust, per-particle aSeed). */
export const DUST_SEED = 0x5eb ^ 0xd057;
export const PARTICLE_SEED = 0x5eb ^ 0x5eed;

/** Standard normal (Box–Muller). */
export function gauss(rand: Rand): number {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Index layout (§3.3).

/** φ − 1: shape ordinal j has v_j = fract(j·φ). */
export const PHI = 0.6180339887498949;
/** Share of the non-spark range that is dust: 15 / 97 (15% of N out of the 97% non-spark). */
export const DUST_SPLIT = 15 / 97;

/** Tier dimensions a layout is built for. */
export interface TierDims {
  /** Particle count, 256 × texH. */
  readonly N: number;
  /** Sparks, index range [0, S). */
  readonly S: number;
  /** Texture height (width is always 256). */
  readonly texH: number;
}

export interface IndexLayout extends TierDims {
  readonly texW: number;
  /** Shape count (82%). */
  readonly M: number;
  /** Dust count (15%). */
  readonly D: number;
  /** Particle index of shape ordinal j (ascending). */
  readonly shapeIndex: Uint32Array;
  /** Particle index of dust ordinal d (ascending). */
  readonly dustIndex: Uint32Array;
  /** perm[j] = rank of fract(j·φ) among the M shape values: shape ordinal j takes sorted target perm[j]. */
  readonly perm: Uint32Array;
  /** The same scheme over the S sparks. */
  readonly sparkPerm: Uint32Array;
}

const fract = (x: number): number => x - Math.floor(x);

/**
 * Stable argsort of `key[0..n)` without a comparator: each key is quantised
 * to 32 bits over its range and packed with its index into one float64
 * (exact below 2^53), so the native numeric TypedArray sort does the work
 * (≈ 10× faster than a comparator sort; §9.9 budgets the layout at ≤ 5 ms).
 */
export function argsort(key: Float64Array, n: number): Uint32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const k = key[i];
    if (k < lo) lo = k;
    if (k > hi) hi = k;
  }
  const scale = hi > lo ? 4294967295 / (hi - lo) : 0;
  const IDX = 131072; // 2^17 > any N (49,152)
  const packed = new Float64Array(n);
  for (let i = 0; i < n; i++) packed[i] = Math.floor((key[i] - lo) * scale) * IDX + i;
  packed.sort();
  const order = new Uint32Array(n);
  for (let r = 0; r < n; r++) order[r] = packed[r] % IDX;
  return order;
}

/** Ranks of fract(j·φ) for j ∈ [0, n). */
function goldenRanks(n: number): Uint32Array {
  const v = new Float64Array(n);
  for (let j = 0; j < n; j++) v[j] = fract(j * PHI);
  const order = argsort(v, n);
  const rank = new Uint32Array(n);
  for (let r = 0; r < n; r++) rank[order[r]] = r;
  return rank;
}

/**
 * The index layout of a tier (§3.3): `[0, S)` sparks; `[S, N)` dust where
 * fract((i − S)·φ) < 15/97, shape otherwise. Any index prefix is a uniform
 * subsample of every state (three-distance theorem), which is what lets a
 * drawRange cut or the Canvas2D 1,500-point subsample work unchanged.
 */
export function createIndexLayout(t: TierDims): IndexLayout {
  const { N, S } = t;
  let D = 0;
  for (let i = S; i < N; i++) if (fract((i - S) * PHI) < DUST_SPLIT) D++;
  const M = N - S - D;
  const shapeIndex = new Uint32Array(M);
  const dustIndex = new Uint32Array(D);
  let js = 0;
  let jd = 0;
  for (let i = S; i < N; i++) {
    if (fract((i - S) * PHI) < DUST_SPLIT) dustIndex[jd++] = i;
    else shapeIndex[js++] = i;
  }
  return {
    N,
    S,
    texH: t.texH,
    texW: LIMITS.texW,
    M,
    D,
    shapeIndex,
    dustIndex,
    perm: goldenRanks(M),
    sparkPerm: goldenRanks(S),
  };
}

// ---------------------------------------------------------------------------
// Meta packing (§3.4): r ramp, g alpha, b param, a role << 4 | group.

const byte = (x: number): number => Math.round(clamp01(x) * 255);

export function writeMeta(
  out: Uint8Array,
  o: number,
  ramp: number,
  alpha: number,
  param: number,
  role: Role,
  group = 0,
): void {
  out[o] = byte(ramp);
  out[o + 1] = byte(alpha);
  out[o + 2] = byte(param);
  out[o + 3] = ((role & 15) << 4) | (group & 15);
}

/** Palette ramp positions (§2.1). */
export const RAMP = { noise: 0, steel: 0.25, signal: 0.5, ember: 0.75, core: 1 } as const;

// ---------------------------------------------------------------------------
// Target lists: what a generator produces.

/**
 * A fixed-capacity list of targets. `pos` holds (x, y, z, key) in local su
 * (relative to the state's anchor centre; key = the stagger key used when
 * ENTERING this state), `meta` the packed bytes, `sort` an optional custom
 * sort key (SortSpec 'custom').
 */
export class TargetList {
  readonly capacity: number;
  pos: Float32Array;
  meta: Uint8Array;
  sort: Float64Array;
  count = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 4);
    this.meta = new Uint8Array(capacity * 4);
    this.sort = new Float64Array(capacity);
  }

  get full(): boolean {
    return this.count >= this.capacity;
  }

  get remaining(): number {
    return this.capacity - this.count;
  }

  /** Append one target; ignored when full. Returns false when full. */
  push(
    x: number,
    y: number,
    z: number,
    key: number,
    ramp: number,
    alpha: number,
    param: number,
    role: Role,
    group = 0,
    sortKey = 0,
  ): boolean {
    if (this.count >= this.capacity) return false;
    const n = this.count++;
    const o = n * 4;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.pos[o + 3] = clamp01(key);
    writeMeta(this.meta, o, ramp, alpha, param, role, group);
    this.sort[n] = sortKey;
    return true;
  }
}

/** How a state orders its targets (§3.3 table). */
export type SortSpec =
  /** x-major in `bins` column bins over the state's own x extent, then y ascending (S0, S1, S2). */
  | { readonly kind: 'columns'; readonly bins: number }
  /** Ascending x (S10). */
  | { readonly kind: 'x' }
  /** Seeded shuffle (S6, S7). */
  | { readonly kind: 'shuffle' }
  /** Polar angle about (cx, cy) in local su (S8, S9). */
  | { readonly kind: 'polar'; readonly cx: number; readonly cy: number }
  /** The generator wrote `sort` itself (rows for S3/S5, component + arc length for S4). */
  | { readonly kind: 'custom' };

/** §3.3: S0, S1, S2 share the column order, which makes the rack focus and the Pour column-coherent. */
export const COLUMNS_64: SortSpec = { kind: 'columns', bins: 64 };

function computeSortKeys(list: TargetList, spec: SortSpec, rand: Rand): void {
  const n = list.count;
  const p = list.pos;
  const k = list.sort;
  switch (spec.kind) {
    case 'custom':
      return;
    case 'x':
      for (let i = 0; i < n; i++) k[i] = p[i * 4];
      return;
    case 'shuffle':
      for (let i = 0; i < n; i++) k[i] = rand();
      return;
    case 'polar':
      for (let i = 0; i < n; i++) k[i] = Math.atan2(p[i * 4 + 1] - spec.cy, p[i * 4] - spec.cx);
      return;
    case 'columns': {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = p[i * 4];
        const y = p[i * 4 + 1];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const sx = x1 > x0 ? spec.bins / (x1 - x0) : 0;
      const sy = y1 > y0 ? 0.999 / (y1 - y0) : 0;
      for (let i = 0; i < n; i++) {
        const bin = Math.min(spec.bins - 1, Math.floor((p[i * 4] - x0) * sx));
        k[i] = bin + (p[i * 4 + 1] - y0) * sy;
      }
      return;
    }
  }
}

/** Sort a list in place by its spec (stable for equal keys). */
export function sortTargets(list: TargetList, spec: SortSpec, rand: Rand): void {
  const n = list.count;
  computeSortKeys(list, spec, rand);
  const key = list.sort;
  const order = argsort(key, n);
  const pos = new Float32Array(list.capacity * 4);
  const meta = new Uint8Array(list.capacity * 4);
  const sort = new Float64Array(list.capacity);
  for (let r = 0; r < n; r++) {
    const s = order[r] * 4;
    const d = r * 4;
    pos[d] = list.pos[s];
    pos[d + 1] = list.pos[s + 1];
    pos[d + 2] = list.pos[s + 2];
    pos[d + 3] = list.pos[s + 3];
    meta[d] = list.meta[s];
    meta[d + 1] = list.meta[s + 1];
    meta[d + 2] = list.meta[s + 2];
    meta[d + 3] = list.meta[s + 3];
    sort[r] = key[order[r]];
  }
  list.pos = pos;
  list.meta = meta;
  list.sort = sort;
}

// ---------------------------------------------------------------------------
// Dust (§3.3): one fixed world-space position shared by every state.

export interface DustData {
  /** D × (x, y, z, 0) in world su. */
  readonly pos: Float32Array;
  readonly meta: Uint8Array;
  /** Aspect it was generated for. */
  readonly A: number;
}

/** x ∈ [−1.4A, 1.4A], y ∈ [−1.4, 1.4], z ∈ [−4, −1.2]; p-noise / p-steel at α .18–.30. */
export function makeDust(layout: IndexLayout, A: number): DustData {
  const rand = mulberry32(DUST_SEED);
  const n = layout.D;
  const pos = new Float32Array(n * 4);
  const meta = new Uint8Array(n * 4);
  for (let d = 0; d < n; d++) {
    const o = d * 4;
    pos[o] = (rand() * 2 - 1) * 1.4 * A;
    pos[o + 1] = (rand() * 2 - 1) * 1.4;
    pos[o + 2] = -4 + rand() * 2.8;
    pos[o + 3] = 0;
    const steel = rand() < 0.3;
    writeMeta(meta, o, steel ? RAMP.steel : RAMP.noise, 0.18 + rand() * 0.12, 0, Role.DUST);
  }
  return { pos, meta, A };
}

// ---------------------------------------------------------------------------
// Per-particle attributes (§3.4 geometry).

/**
 * aSeed (vec4 per particle): x size, y twinkle rate, z scroll inertia,
 * w bokeh eligibility (< .35). Deterministic per tier size.
 */
export function makeParticleSeeds(N: number): Float32Array {
  const rand = mulberry32(PARTICLE_SEED);
  const out = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) out[i] = rand();
  return out;
}

/** position (vec3) packs (index, 0, 0). */
export function makeIndexPositions(N: number): Float32Array {
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) out[i * 3] = i;
  return out;
}

// ---------------------------------------------------------------------------
// Packing a state (§3.3 mapping, §3.4 layout).

export interface PackedState {
  /** N × (x, y, z, key): local su (dust: world su). */
  readonly pos: Float32Array;
  /** N × (ramp, alpha, param, role << 4 | group). */
  readonly meta: Uint8Array;
}

/**
 * Write sorted targets into texture order: spark ordinal i takes spark target
 * sparkPerm[i]; shape ordinal j (particle shapeIndex[j]) takes shape target
 * perm[j]; dust indices get the shared dust. Short lists are padded with a
 * halo (callers should fill with `fillHalo` first; this is the last resort).
 */
export function packState(layout: IndexLayout, shape: TargetList, spark: TargetList, dust: DustData): PackedState {
  const { N, S, M, D } = layout;
  const pos = new Float32Array(N * 4);
  const meta = new Uint8Array(N * 4);
  const copy = (src: TargetList, t: number, i: number) => {
    const s = t * 4;
    const d = i * 4;
    pos[d] = src.pos[s];
    pos[d + 1] = src.pos[s + 1];
    pos[d + 2] = src.pos[s + 2];
    pos[d + 3] = src.pos[s + 3];
    meta[d] = src.meta[s];
    meta[d + 1] = src.meta[s + 1];
    meta[d + 2] = src.meta[s + 2];
    meta[d + 3] = src.meta[s + 3];
  };
  const sparkN = Math.max(1, spark.count);
  for (let i = 0; i < S; i++) {
    // perm is over S; a short spark list is sampled proportionally.
    const r = layout.sparkPerm[i];
    copy(spark, spark.count >= S ? r : Math.floor((r * sparkN) / S) % sparkN, i);
  }
  const shapeN = Math.max(1, shape.count);
  for (let j = 0; j < M; j++) {
    const r = layout.perm[j];
    copy(shape, shape.count >= M ? r : Math.floor((r * shapeN) / M) % shapeN, layout.shapeIndex[j]);
  }
  for (let d = 0; d < D; d++) {
    const i = layout.dustIndex[d] * 4;
    const s = d * 4;
    pos[i] = dust.pos[s];
    pos[i + 1] = dust.pos[s + 1];
    pos[i + 2] = dust.pos[s + 2];
    pos[i + 3] = 0;
    meta[i] = dust.meta[s];
    meta[i + 1] = dust.meta[s + 1];
    meta[i + 2] = dust.meta[s + 2];
    meta[i + 3] = dust.meta[s + 3];
  }
  return { pos, meta };
}

// ---------------------------------------------------------------------------
// Generator contract.

/** The canvas (and svh basis) a generation runs for. */
export interface GenViewport {
  /** Canvas CSS width (= viewport width). */
  readonly W: number;
  /** Canvas CSS height (100lvh): px → su is 2 / H (§3.1). */
  readonly H: number;
  /** Aspect W / H. */
  readonly A: number;
  /** 100svh in px: the basis of layout.ts svh lengths. */
  readonly svh: number;
}

/** An anchor box in px (size + named extras from layout.ts); centre-relative generation needs no position. */
export interface AnchorSize {
  readonly w: number;
  readonly h: number;
  readonly extra: Readonly<Record<string, number>>;
}

export interface GenContext {
  readonly id: StateId;
  readonly layout: IndexLayout;
  readonly view: GenViewport;
  readonly mode: LayoutMode;
  /** Mobile with height < 600px (§4.2 short rules). */
  readonly short: boolean;
  /** This state's anchor box in px. */
  readonly anchor: AnchorSize;
  readonly rand: Rand;
  /** px → su on the z = 0 plane. */
  readonly su: (px: number) => number;
}

export interface GenOutput {
  readonly shape: TargetList;
  readonly spark: TargetList;
  /**
   * Per-state data the engine copies into shared uniforms when the state is
   * resident, e.g. `{ uBarPivot: [x0, y0, x1, y1, x2, y2] }` from S2 (local su).
   */
  extras?: Record<string, number[]>;
}

export interface StateGenerator {
  readonly id: StateId;
  readonly sort: SortSpec;
  /** Sort for the sparks (defaults to `sort`). */
  readonly sparkSort?: SortSpec;
  /** Fill out.shape (exactly M, pad with fillHalo) and out.spark (exactly S). */
  generate(ctx: GenContext, out: GenOutput): void;
}

export interface GeneratedState extends PackedState {
  readonly id: StateId;
  readonly extras?: Record<string, number[]>;
}

/** Run a generator: fill, sort, pack. */
export function runGenerator(gen: StateGenerator, ctx: GenContext, dust: DustData): GeneratedState {
  const out: GenOutput = { shape: new TargetList(ctx.layout.M), spark: new TargetList(ctx.layout.S) };
  gen.generate(ctx, out);
  sortTargets(out.shape, gen.sort, ctx.rand);
  sortTargets(out.spark, gen.sparkSort ?? gen.sort, ctx.rand);
  const packed = packState(ctx.layout, out.shape, out.spark, dust);
  return { id: gen.id, ...packed, extras: out.extras };
}

export function makeContext(
  id: StateId,
  layout: IndexLayout,
  view: GenViewport,
  mode: LayoutMode,
  short: boolean,
  anchor: AnchorSize,
): GenContext {
  const k = view.H > 0 ? 2 / view.H : 0;
  return { id, layout, view, mode, short, anchor, rand: mulberry32(stateSeed(id)), su: (px) => px * k };
}

// ---------------------------------------------------------------------------
// Samplers.

/** Surplus shape particles go to a dim Gaussian halo around the shape (role halo, §3.3). */
export function fillHalo(
  list: TargetList,
  rand: Rand,
  sx: number,
  sy: number,
  sz: number,
  opts: { cx?: number; cy?: number; ramp?: number; alpha?: number; key?: (r: number) => number } = {},
): void {
  const { cx = 0, cy = 0, ramp = RAMP.steel, alpha = 0.06 } = opts;
  while (!list.full) {
    const key = opts.key ? opts.key(rand()) : 0.5 * rand();
    list.push(cx + gauss(rand) * sx, cy + gauss(rand) * sy, gauss(rand) * sz, key, ramp, alpha, 0, Role.HALO);
  }
}

/** Point i of an n-point Fibonacci sphere (unit radius). */
export function fibonacciSphere(i: number, n: number, out: [number, number, number]): [number, number, number] {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * 2.399963229728653; // golden angle
  out[0] = Math.cos(th) * r;
  out[1] = y;
  out[2] = Math.sin(th) * r;
  return out;
}

/** Arc-length parameterisation of a polyline (for outlines, ECG lines, spokes). */
export class Polyline {
  readonly pts: readonly (readonly [number, number])[];
  readonly cum: Float64Array;
  readonly length: number;

  constructor(pts: readonly (readonly [number, number])[], closed = false) {
    const list = closed && pts.length > 0 ? [...pts, pts[0]] : [...pts];
    this.pts = list;
    this.cum = new Float64Array(list.length);
    for (let i = 1; i < list.length; i++) {
      this.cum[i] = this.cum[i - 1] + Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]);
    }
    this.length = this.cum[list.length - 1] ?? 0;
  }

  /** Point at arc-length fraction u ∈ [0, 1]. */
  at(u: number, out: [number, number]): [number, number] {
    const s = clamp01(u) * this.length;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < s) lo = mid;
      else hi = mid;
    }
    const seg = this.cum[hi] - this.cum[lo];
    const t = seg > 0 ? (s - this.cum[lo]) / seg : 0;
    out[0] = lerp(this.pts[lo][0], this.pts[hi][0], t);
    out[1] = lerp(this.pts[lo][1], this.pts[hi][1], t);
    return out;
  }
}

/**
 * Aspect-fit a local w × h unit box into an anchor box (px): the su scale
 * that maps local units to su, filling `fill` of the box (§3.10: emblems 90%).
 */
export function fitScale(ctx: GenContext, localW: number, localH: number, fill = 0.9): number {
  const { w, h } = ctx.anchor;
  if (localW <= 0 || localH <= 0 || w <= 0 || h <= 0) return 0;
  return ctx.su(Math.min(w / localW, h / localH) * fill);
}
