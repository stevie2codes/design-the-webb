/**
 * The Canvas2D fallback (SPEC §8.4, §3.2 fallback triggers, §9.12 "No WebGL").
 *
 * NEVER imports `three` (directly or through textures.ts / material.ts /
 * engine.ts): it is the renderer for browsers without WebGL2, software GL,
 * feeble devices and a second context loss. It runs the SAME generators
 * (the worker, or main-thread idle chunks without Worker support) and the
 * same S1 DOM sampler, and draws a uniform subsample of every state (§3.3:
 * any index prefix is one) as 1.5px dots in the particle ramp colours:
 * the first FALLBACK.shapes shape ordinals, the first FALLBACK.sparks spark
 * indices and the dust that falls inside that prefix.
 *
 * It reads the director's frame exactly as the engine does: the pair (a, b),
 * the mix, the entering stagger / turbulence / path, the anchor transforms
 * (offA / offB), the text-safe rects, the damped fx. So every state sits at
 * its analytic anchor, registered to its DOM chapter, and follows the scroll:
 * - full motion: the film morphs, as a sparse constellation (DEFAULT, POUR,
 *   TOPPLE, DIGITIZE, DEAL and SPIRAL paths on the CPU; no live loops, no
 *   idle drift, no pointer);
 * - reduced motion: the director's still posters, with its 400 ms crossfade
 *   when the active chapter changes (A at α·(1 − mix), then B at α·mix).
 * Each state's live() is frozen at its reduced-motion poster frame (§3.10)
 * and baked into the subsample once (ghost trails, fizz, rings, the
 * flatline's scan head…).
 *
 * Cost: one paint = clear + ≈ 1,800 points of arithmetic + one fillRect per
 * dot, batched per colour / alpha bucket (≈ .3 ms). A paint happens only
 * when something visible changed (a frame signature: pair, mix, anchors,
 * safe rects, fx, scroll, canvas size) — i.e. on scroll frames, while the
 * damped film settles and during crossfades. Nothing animates at rest.
 *
 * Text-safe rects are honoured as in the shader (§2.3): α ×.22 inside a
 * [data-safe] block (24px smootherstep feather), capped at .06, no ember.
 *
 * Two drivers:
 * - `createFallback` (field/index.ts: no WebGL2, feeble device, engine
 *   failure): owns the loop (gsap ticker; on demand under reduced motion),
 *   the generation (Low tier dims — the subsample does not depend on the
 *   tier), S1 sampling, §9.7 regeneration and html[data-field="fallback"].
 * - `LossFallback` (engine.ts, `webglcontextlost`): a passive overlay canvas
 *   painted by the engine's loop from the engine's own cached arrays; shown
 *   on a loss, crossfaded away on a restore, kept after a second loss.
 *
 * SSR-safe: nothing runs at import.
 */
import { gsap } from '../motion/gsap.ts';
import { getDebugParams } from '../debugParams.ts';
import { FILM_MAX, filmOverride, setFilmCeiling, tick } from '../scroll/director.ts';
import { store, type FieldFrame, type Vec4 } from '../scroll/store.ts';
import { MQ, resolveAnchor } from './layout.ts';
import { HOME_STATES, STATE_COUNT, StateId } from './states/ids.ts';
import {
  createIndexLayout,
  makeDust,
  mulberry32,
  type AnchorSize,
  type DustData,
  type GenViewport,
  type IndexLayout,
  type TierDims,
} from './states/common.ts';
import {
  findNameElements,
  isNameFontReady,
  sampleName,
  waitForNameFont,
  type NameElements,
  type NameSample,
} from './states/name-sampler.ts';
import { TIERS } from './tiers.ts';
import { CAMERA_Z, PALETTE, PathId, Role, SKETCH_PALETTE } from './uniforms.ts';
import { getTheme, onThemeChange } from '../theme.ts';
import { GeneratorClient, type GenJob } from './generation.ts';
import { clearIntroPending } from './index.ts';
import type { CreateField, FieldBootOptions, FieldHandle, FieldMode, FieldStats, PauseReason } from './index.ts';

/** §8.4 constants (and the fallback's own calibration). */
export const FALLBACK = {
  /** Shape ordinals drawn (a uniform subsample, §3.3). */
  shapes: 1500,
  /** Spark indices drawn. */
  sparks: 45,
  /** Dot size in CSS px (§8.4). */
  dot: 1.5,
  /** Crossfades: loss → fallback, restore → WebGL (§8.4), ready fade-in. */
  fade: 0.4,
  /** Backing-store DPR cap (1.5px dots stay crisp at 2×; beyond that it only costs fill). */
  dprMax: 2,
  /**
   * Backing-store pixel budget. Without WebGL the browser usually rasterises
   * and composites the canvas in software: a full-viewport 2× backing store
   * (≈ 5 Mpx on a laptop) costs 50–120 ms long tasks per scroll frame there,
   * whatever the dot count. The DPR drops until W·H·dpr² fits (never below 1).
   */
  maxPixels: 2_100_000,
  /**
   * Exposure: every state's subsample is normalised so the median α of its
   * structure dots (fill, edge, flow, ring, packet, blink) is this; the rest
   * keep their ratio to it (halo, ghosts, sparks). The WebGL field sums tens
   * of thousands of overlapping grains weighted by per-state density
   * (FIELD_GAIN 3, §3.9); a sparse constellation needs every dot to read on
   * its own, at one exposure across states.
   */
  target: 0.9,
  /** Normalisation limits (a state of only faint dots stays faint). */
  normMin: 0.5,
  normMax: 5,
  /** Group focus floor: α × mix(this, 1, w) (the shader's .35 all but erases a sparse plate). */
  focusFloor: 0.75,
  /** Dust: base α × this (depth motes, well under the shapes). */
  dustGain: 0.7,
  /** Skip dots dimmer than this. */
  minAlpha: 0.018,
  /**
   * Text-safe cap inside a [data-safe] rect (the shader's SAFE_ALPHA_MAX is
   * .06). Additive 1.5px dots overlap and the α buckets round, so the
   * fallback caps a little lower to hold the §2.3 pre-scrim budget (#262A34).
   */
  safeMax: 0.045,
} as const;

/**
 * Per-state ramp lift. S0's grains are the darkest ramp stop, drawn in WebGL
 * as wide bokeh discs; as 1.5px dots they need a hair of steel to read.
 */
const STATE_LIFT: Readonly<Partial<Record<StateId, number>>> = { [StateId.STATIC]: 0.08 };

/** The void (--color-void): the fallback canvas is opaque, like the WebGL one. */
const VOID = '#050507';
/** Sketch theme: paper, pencil palette, normal compositing at this α scale. */
const PAPER = '#f3eee3';
const SKETCH_ALPHA = 0.55;

/** The tier whose dims the standalone fallback generates at (the subsample is tier-independent). */
const GEN_TIER = TIERS.low;
const GEN_DIMS: TierDims = { N: GEN_TIER.N, S: GEN_TIER.sparks, texH: GEN_TIER.texH };

/** The engine's boot order, without importing textures.ts (it imports three). */
const BOOT_ORDER: readonly StateId[] = [
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

/** §9.7 regeneration thresholds (as the engine). */
const RESIZE_DEBOUNCE_MS = 200;
const REGEN_DW = 40;
const REGEN_DH_FINE = 120;
/** §9.8: resample S1 when its anchor box changed by more than this (CSS px). */
const NAME_RESAMPLE_PX = 0.5;
/** Reduced motion: how long an invalidation keeps frames coming (s). */
const DIRTY_S = 0.3;

const html = (): HTMLElement => document.documentElement;

/** The fallback canvas's backing-store DPR for a W × H CSS px canvas (FALLBACK.dprMax, FALLBACK.maxPixels). */
export function fallbackDpr(W: number, H: number): number {
  const cap = Math.sqrt(FALLBACK.maxPixels / Math.max(1, W * H));
  return Math.max(1, Math.min(window.devicePixelRatio || 1, FALLBACK.dprMax, cap));
}

const whenIdle = (cb: () => void): void => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 800 });
  else setTimeout(cb, 16);
};

// ---------------------------------------------------------------------------
// Where the painter reads states from.

/** A state's cached arrays (N × 4 each), in the §3.4 texture layout. */
export interface StateArrays {
  readonly pos: Float32Array;
  readonly meta: Uint8Array;
}

/** What the painter needs from its owner (the standalone driver, or the engine during a loss). */
export interface PaintSource {
  /** The index layout the arrays follow (null until known). */
  layout(): IndexLayout | null;
  /**
   * A resident state's arrays, or null. A new `pos` array means new content.
   * The returned object may be reused by the next call.
   */
  arrays(id: StateId): StateArrays | null;
  /**
   * Uniform scale of a state's local su on a canvas of CSS height H (the
   * engine's stateScale: px-registered states keep their px size until a
   * regeneration catches up; S1 also follows the DOM name, §9.8).
   */
  scale(id: StateId, H: number): number;
  /** S2's bar pivots (local su, 3 × xy) for the TOPPLE, or null. */
  pivots(): readonly number[] | null;
}

export interface PaintStats {
  /** Points in the subsample (per state). */
  readonly points: number;
  /** Dots in the last paint. */
  readonly dots: number;
  /** Paints so far (a paint only happens when the picture changed). */
  readonly paints: number;
  /** Duration of the last paint and a smoothed mean (ms). */
  readonly ms: number;
  readonly meanMs: number;
}

// ---------------------------------------------------------------------------
// Colour and alpha buckets (fillStyle changes are the expensive part).

const RAMP_LEVELS = 17; // ramp i / 16: every palette stop is exact
const ALPHA_LEVELS = 12; // .025 · 1.4^i, i = 0…11 (the last one is 1)
const ALPHA_BASE = 0.025;
const ALPHA_STEP = Math.log(1.4);
const BUCKETS = RAMP_LEVELS * ALPHA_LEVELS;

function buildStyles(sketch = false): string[] {
  const rgb = (sketch ? SKETCH_PALETTE : PALETTE).map((p) => [(p.hex >> 16) & 255, (p.hex >> 8) & 255, p.hex & 255]);
  const out: string[] = [];
  for (let r = 0; r < RAMP_LEVELS; r++) {
    const s = (r / (RAMP_LEVELS - 1)) * 4;
    const i = Math.min(3, Math.floor(s));
    const t = s - i;
    const c = [0, 1, 2].map((k) => Math.round(rgb[i][k] + (rgb[i + 1][k] - rgb[i][k]) * t));
    for (let a = 0; a < ALPHA_LEVELS; a++) {
      const al = Math.min(1, ALPHA_BASE * Math.pow(1.4, a)) * (sketch ? SKETCH_ALPHA : 1);
      out.push(`rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The subsample of one state, with its poster-frame live() baked in.

class Compact {
  src: Float32Array | null = null;
  /** x, y, z, key (local su; dust: world su). */
  readonly pos: Float32Array;
  readonly ramp: Float32Array;
  readonly alpha: Float32Array;
  /** meta.b (param) 0–1. */
  readonly param: Float32Array;
  readonly role: Uint8Array;
  readonly group: Uint8Array;

  constructor(k: number) {
    this.pos = new Float32Array(k * 4);
    this.ramp = new Float32Array(k);
    this.alpha = new Float32Array(k);
    this.param = new Float32Array(k);
    this.role = new Uint8Array(k);
    this.group = new Uint8Array(k);
  }
}

/** The drawn indices of a layout: sparks, then the shape prefix, then the dust inside it. */
function drawIndices(layout: IndexLayout): Uint32Array {
  const nS = Math.min(FALLBACK.sparks, layout.S);
  const nM = Math.min(FALLBACK.shapes, layout.M);
  const last = nM > 0 ? layout.shapeIndex[nM - 1] : layout.S;
  let nD = 0;
  while (nD < layout.D && layout.dustIndex[nD] < last) nD++;
  const out = new Uint32Array(nS + nM + nD);
  let o = 0;
  for (let i = 0; i < nS; i++) out[o++] = i;
  for (let j = 0; j < nM; j++) out[o++] = layout.shapeIndex[j];
  for (let d = 0; d < nD; d++) out[o++] = layout.dustIndex[d];
  return out;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, m: number, s: number): number => {
  const d = (x - m) / s;
  return Math.exp(-0.5 * d * d);
};

// Poster-frame constants mirrored from the live shaders (shaders/live/sNN.glsl).
const PULSE = { head: -0.1 + 1.2 * 0.4091166, sigma: 0.03, ghostDu: 0.02, zk: 0.04, r0: 0.12, span: 0.36 } as const;
const FLAT = { head: -0.06 + 1.12 * ((2.2285714 / 3.2) % 1), lMin: 0.25, lLog: 3.4657359, tail: 0.06 } as const;

/**
 * Copy a state's subsample out of its arrays and bake the §3.10 poster
 * frame of its live() (the reduced-motion freeze frame; the fallback has no
 * live loops). z is zeroed for the states whose live() registers depth away
 * (S4, S5, S6, S10: their z is a unit length or a blur depth, not a place).
 */
function extract(kind: StateId, a: StateArrays, idx: Uint32Array, out: Compact): void {
  const { pos, meta } = a;
  const flat = kind === StateId.PULSE || kind === StateId.LATTICE || kind === StateId.DECK || kind === StateId.FLATLINE;
  for (let k = 0; k < idx.length; k++) {
    const i4 = idx[k] * 4;
    const k4 = k * 4;
    let x = pos[i4];
    const y = pos[i4 + 1];
    let z = pos[i4 + 2];
    const key = pos[i4 + 3];
    let ramp = meta[i4] / 255;
    let alpha = meta[i4 + 1] / 255;
    const param = meta[i4 + 2] / 255;
    const role = meta[i4 + 3] >> 4;
    const group = meta[i4 + 3] & 15;

    if (role !== Role.DUST) {
      switch (kind) {
        case StateId.CHART:
          // Fizz at its generated height, faded (t = 0); the AI core at .9.
          if (role === Role.FLOW) alpha *= (1 - param) * (1 - param) * smoothstep(0, 0.08, param);
          else if (role === Role.SPARK) alpha *= 0.9;
          break;
        case StateId.PULSE: {
          // The highlight on the spike apex, its ghost trail, the newest ring just pinged.
          const h = gauss(param, PULSE.head, PULSE.sigma);
          if (role === Role.FLOW) {
            alpha *= 1 + 1.6 * h;
            ramp += 0.25 * h;
          } else if (role === Role.GHOST) {
            const gh = gauss(param + PULSE.ghostDu * group, PULSE.head, PULSE.sigma);
            alpha *= 1.8 * gh;
            ramp += 0.25 * gh * (1 - 0.3 * group);
          } else if (role === Role.SPARK) {
            alpha *= 0.45 * 0.75 + 1.2 * h;
          } else if (role === Role.RING) {
            const W = -z / PULSE.zk;
            if (W > 1e-4) {
              const dx = x / W + 0.04;
              const dy = y / W - 0.250112;
              const r = Math.hypot(dx, dy);
              const env = Math.min(1, Math.max(0, 1 - (r - PULSE.r0) / PULSE.span));
              const qx = Math.abs(x / W) - (0.5 - 0.16);
              const qy = Math.abs(y / W - 0.0704) - (0.2496 - 0.16);
              const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.16;
              const inside = 1 - smoothstep(-0.03, -0.008, sd);
              const ping = 1 - smoothstep(PULSE.r0, PULSE.r0 + 0.07, r);
              alpha *= env * Math.sqrt(env) * inside * (1 + 0.8 * ping);
              ramp += 0.3 * ping;
            }
          }
          break;
        }
        case StateId.LATTICE:
          // Mid-hold: fully printed; the head's sparks sit past the top row (row 51 at .3).
          if (role === Role.SPARK) alpha *= Math.round(param * 51) === 51 ? 0.3 : 0;
          break;
        case StateId.CONSTELLATION:
          if (role === Role.PACKET) {
            const v = (((param - 0.1490196) / (0.9254902 - 0.1490196)) % 1 + 1) % 1;
            alpha *= smoothstep(0, 0.08, v) * (1 - smoothstep(0.9, 1, v));
          }
          break;
        case StateId.BEACON:
          if (role === Role.FLOW) alpha *= smoothstep(0, 0.1, param) * (1 - smoothstep(0.78, 1, param));
          break;
        case StateId.FLATLINE: {
          // The scan head at .72 of the line, its phosphor trail behind it.
          const len = FLAT.lMin * Math.exp(param * FLAT.lLog);
          if (role === Role.SPARK) {
            const xs = FLAT.head + x / len;
            x += (FLAT.head - 0.5) * len;
            alpha *= smoothstep(-0.02, 0.06, xs) * (1 - smoothstep(0.94, 1.02, xs));
          } else if (role === Role.GHOST) {
            const kk = Math.max(1, group - 4);
            const xf = x / len + 0.5;
            const behind = (((FLAT.head - xf) % 1.12) + 1.12) % 1.12;
            alpha *= Math.exp(-behind / (FLAT.tail * kk));
          } else if (role === Role.FLOW) {
            const hw = gauss(x / len + 0.5, FLAT.head, 0.01);
            alpha *= 1 + 1.6 * hw;
            ramp += 0.15 * hw;
          }
          break;
        }
        default:
          break;
      }
      if (flat) z = 0;
    }
    out.pos[k4] = x;
    out.pos[k4 + 1] = y;
    out.pos[k4 + 2] = z;
    out.pos[k4 + 3] = key;
    const lift = role === Role.DUST ? 0 : (STATE_LIFT[kind] ?? 0);
    out.ramp[k] = Math.min(1, Math.max(0, ramp + lift));
    out.alpha[k] = alpha;
    out.param[k] = param;
    out.role[k] = role;
    out.group[k] = group;
  }
  normalise(out, idx.length);
}

/** Structure roles: what a state's exposure is measured on. */
const STRUCTURE = new Set<number>([Role.FILL, Role.EDGE, Role.FLOW, Role.RING, Role.PACKET, Role.BLINK]);
let sortBuf = new Float32Array(0);

/** Scale a subsample so the median α of its structure dots is FALLBACK.target (dust untouched). */
function normalise(c: Compact, k: number): void {
  if (sortBuf.length < k) sortBuf = new Float32Array(k);
  let n = 0;
  for (let i = 0; i < k; i++) if (STRUCTURE.has(c.role[i]) && c.alpha[i] > 0.01) sortBuf[n++] = c.alpha[i];
  if (n === 0) return;
  const v = sortBuf.subarray(0, n).sort();
  const median = v[n >> 1];
  const norm = Math.min(FALLBACK.normMax, Math.max(FALLBACK.normMin, FALLBACK.target / Math.max(median, 1e-3)));
  for (let i = 0; i < k; i++) if (c.role[i] !== Role.DUST) c.alpha[i] *= norm;
}

// ---------------------------------------------------------------------------
// The painter.

const cubicInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
/** S8 drawer (shaders/live/s08.glsl): the plate's local x and y after the iso rotation, depth ×.3. */
const STACK_EX = [0.7071068 * 0.08, 0.4082483 * 0.08, -0.5773503 * 0.3 * 0.08];
const STACK_EY = [0, 0.8164966 * 0.06, 0.5773503 * 0.3 * 0.06];
/** Signature length (see sign()). */
const SIG_N = 80;

/**
 * Draws a director frame onto a Canvas2D context. Allocation-free per paint.
 * The owner drives it: `paint()` once per tick; it draws only on change.
 */
export class FallbackPainter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private sketch = getTheme() === 'sketch';
  private styles = buildStyles(this.sketch);
  private idxLayout: IndexLayout | null = null;
  private idx: Uint32Array = new Uint32Array(0);
  private readonly cache: (Compact | null)[] = new Array<Compact | null>(STATE_COUNT).fill(null);
  /** Per point: a fixed random direction (the CPU stand-in for curl turbulence). */
  private jit = new Float32Array(0);
  // Dots of one paint (two passes during a crossfade).
  private xs = new Float32Array(0);
  private ys = new Float32Array(0);
  private ss = new Float32Array(0);
  private bk = new Uint16Array(0);
  private order = new Uint32Array(0);
  private readonly counts = new Uint32Array(BUCKETS + 1);
  private n = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private readonly sig = new Float64Array(SIG_N);
  private readonly sigNext = new Float64Array(SIG_N);
  private sigValid = false;
  private stats = { dots: 0, paints: 0, ms: 0, meanMs: 0 };

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
    // Opaque void (paper in the sketch theme), like the WebGL canvas (its
    // fade-in opacity still applies).
    canvas.style.backgroundColor = this.sketch ? PAPER : VOID;
    onThemeChange(() => this.invalidate());
  }

  /** Forget the picture: the next paint() draws. */
  invalidate(): void {
    this.sigValid = false;
  }

  /** Clear the canvas to transparent (a hidden overlay). */
  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.sigValid = false;
  }

  paintStats(): PaintStats {
    return { points: this.idx.length, ...this.stats };
  }

  /**
   * Paint frame `f` on a canvas of CSS size W × H if anything visible
   * changed (or `force`). `reduced`: posters crossfade instead of morphing.
   * Returns true when it drew.
   */
  paint(f: Readonly<FieldFrame>, src: PaintSource, W: number, H: number, reduced: boolean, force = false): boolean {
    if (W <= 0 || H <= 0) return false;
    const layout = src.layout();
    if (!layout) return false;
    if (layout !== this.idxLayout) this.setLayout(layout);
    const dpr = fallbackDpr(W, H);
    if (W !== this.W || H !== this.H || dpr !== this.dpr) this.resize(W, H, dpr);

    const crossfade = reduced && f.seg < 0 && f.a !== f.b && store.film.override === null;
    this.fresh = false;
    const ca = this.compact(f.a, src);
    const cb = this.compact(f.b, src);
    this.sign(f, crossfade);
    if (!force && !this.fresh && this.sigValid && this.same()) return false;
    this.sig.set(this.sigNext);
    this.sigValid = true;

    const t0 = performance.now();
    this.n = 0;
    if (crossfade) {
      // Reduced motion (§8.2): a crossfade, each poster alone at its own anchor.
      if (ca) this.accumulate(ca, ca, f.a, f.a, f.offA, f.offA, src, H, f, 0, 0, 0, PathId.DEFAULT, 1 - f.mix);
      if (cb) this.accumulate(cb, cb, f.b, f.b, f.offB, f.offB, src, H, f, 0, 0, 0, PathId.DEFAULT, f.mix);
    } else if (ca || cb) {
      // A missing endpoint borrows the other one (the director never enters a
      // home pair whose B is missing; route pairs can arrive before their state).
      const a = ca ?? cb!;
      const b = cb ?? ca!;
      const ka = ca ? f.a : f.b;
      const kb = cb ? f.b : f.a;
      this.accumulate(a, b, ka, kb, ca ? f.offA : f.offB, cb ? f.offB : f.offA, src, H, f, f.mix, f.stagger, f.turb, f.path, 1);
    }
    this.flush();
    const ms = performance.now() - t0;
    this.stats.dots = this.n;
    this.stats.paints++;
    this.stats.ms = ms;
    this.stats.meanMs = this.stats.paints === 1 ? ms : this.stats.meanMs + (ms - this.stats.meanMs) * 0.1;
    return true;
  }

  private setLayout(layout: IndexLayout): void {
    this.idxLayout = layout;
    this.idx = drawIndices(layout);
    const k = this.idx.length;
    this.cache.fill(null);
    const rand = mulberry32(0x5eb ^ 0xfa11);
    this.jit = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) {
      // A random unit vector (the curl field's magnitude is ≈ 1).
      const u = rand() * 2 - 1;
      const th = rand() * TAU;
      const r = Math.sqrt(1 - u * u);
      this.jit[i * 3] = r * Math.cos(th);
      this.jit[i * 3 + 1] = r * Math.sin(th);
      this.jit[i * 3 + 2] = u;
    }
    this.xs = new Float32Array(k * 2);
    this.ys = new Float32Array(k * 2);
    this.ss = new Float32Array(k * 2);
    this.bk = new Uint16Array(k * 2);
    this.order = new Uint32Array(k * 2);
    this.sigValid = false;
  }

  private resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    const bw = Math.max(1, Math.round(W * dpr));
    const bh = Math.max(1, Math.round(H * dpr));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.sigValid = false;
  }

  /** A subsample was (re-)extracted during this paint: the picture changed. */
  private fresh = false;

  /** The subsample of state `id`, re-extracted when its arrays changed; null when not resident. */
  private compact(id: StateId, src: PaintSource): Compact | null {
    const a = src.arrays(id);
    const N = this.idxLayout ? this.idxLayout.N : 0;
    if (!a || a.pos.length < N * 4 || a.meta.length < N * 4) return null;
    let c = this.cache[id];
    if (!c || c.src !== a.pos) {
      c = c ?? new Compact(this.idx.length);
      extract(id, a, this.idx, c);
      c.src = a.pos;
      this.cache[id] = c;
      this.fresh = true;
    }
    return c;
  }

  /** Everything a paint depends on, into sigNext. */
  private sign(f: Readonly<FieldFrame>, crossfade: boolean): void {
    const s = this.sigNext;
    let o = 0;
    s[o++] = f.a;
    s[o++] = f.b;
    s[o++] = f.mix;
    s[o++] = crossfade ? 1 : 0;
    s[o++] = f.stagger;
    s[o++] = f.turb;
    s[o++] = f.path;
    s[o++] = f.opacity;
    s[o++] = f.exposure;
    for (let i = 0; i < 4; i++) s[o++] = f.offA[i];
    for (let i = 0; i < 4; i++) s[o++] = f.offB[i];
    for (let i = 0; i < 8; i++) s[o++] = f.groupW[i];
    s[o++] = f.focusOn;
    s[o++] = f.charge;
    s[o++] = f.sink;
    s[o++] = f.scrollPx;
    s[o++] = this.W;
    s[o++] = this.H;
    s[o++] = this.dpr;
    const sf = f.safe;
    s[o++] = sf.count;
    for (let i = 0; i < 24; i++) s[o++] = i < sf.count * 4 ? sf.rects[i] : 0;
    for (let i = 0; i < 6; i++) s[o++] = i < sf.count ? sf.weights[i] : 0;
    for (let i = 0; i < 6; i++) if (o < SIG_N) s[o++] = i < sf.count ? sf.feathers[i] : 0;
    while (o < SIG_N) s[o++] = 0;
  }

  private same(): boolean {
    const a = this.sig;
    const b = this.sigNext;
    for (let i = 0; i < SIG_N; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return false;
    return true;
  }

  /**
   * Add one pair's dots (§3.6 on the CPU, without live loops, drift or
   * pointer): per-particle progress from the ENTERING key, the path, the
   * anchor transforms, perspective, α, the ramp, group focus and the
   * text-safe mask. `alphaMul` scales the whole pass (crossfades).
   */
  private accumulate(
    A: Compact,
    B: Compact,
    kindA: StateId,
    kindB: StateId,
    offA: Readonly<Vec4>,
    offB: Readonly<Vec4>,
    src: PaintSource,
    H: number,
    f: Readonly<FieldFrame>,
    mix: number,
    stagger: number,
    turb: number,
    path: number,
    alphaMul: number,
  ): void {
    if (alphaMul <= 0.002) return;
    const W = this.W;
    const A_ = W / H;
    const pxPerSu = H / 2;
    // Anchor centres px → su (§3.1), and each state's local scale.
    const oAx = ((2 * offA[0]) / W - 1) * A_;
    const oAy = 1 - (2 * offA[1]) / H;
    const oBx = ((2 * offB[0]) / W - 1) * A_;
    const oBy = 1 - (2 * offB[1]) / H;
    const kA = offA[2] * src.scale(kindA, H);
    const kB = offB[2] * src.scale(kindB, H);
    const chargeA = kindA >= StateId.REDACTED ? 1 + 0.35 * f.charge : 1;
    const chargeB = kindB >= StateId.REDACTED ? 1 + 0.35 * f.charge : 1;
    const wA = offA[3] * chargeA;
    const wB = offB[3] * chargeB;
    const gain = f.opacity * f.exposure * alphaMul;
    const floor = FALLBACK.focusFloor;
    const dustGain = FALLBACK.dustGain * f.opacity * alphaMul;
    const invS = 1 / Math.max(1 - stagger, 1e-4);
    const scrollSu = f.scrollPx * (2 / H) * 0.15;
    const piv = path === PathId.TOPPLE ? src.pivots() : null;
    const stackA = kindA === StateId.STACK && f.focusOn > 0;
    const stackB = kindB === StateId.STACK && f.focusOn > 0;
    const sinkA = kindA === StateId.BEACON ? 1 - 0.8 * smoothstep(0, 0.25, f.sink) : 1;
    const sinkB = kindB === StateId.BEACON ? 1 - 0.8 * smoothstep(0, 0.25, f.sink) : 1;
    const gw = f.groupW;
    const safe = f.safe;
    const nSafe = safe.count;
    const rects = safe.rects;
    const sw = safe.weights;
    const sfe = safe.feathers;
    const PA = A.pos;
    const PB = B.pos;
    const jit = this.jit;
    const minA = FALLBACK.minAlpha;
    const K = this.idx.length;
    const xs = this.xs;
    const ys = this.ys;
    const ss = this.ss;
    const bk = this.bk;
    let n = this.n;

    for (let k = 0; k < K; k++) {
      const k4 = k * 4;
      const roleB = B.role[k];
      let x: number;
      let y: number;
      let z: number;
      let alpha: number;
      let ramp: number;
      let w = 1;
      if (roleB === Role.DUST) {
        // World-space, never morphs; drifts at 15% of content speed, wrapped (§3.3).
        x = PB[k4];
        const yy = PB[k4 + 1] + scrollSu + 1.4;
        y = yy - 2.8 * Math.floor(yy / 2.8) - 1.4;
        z = PB[k4 + 2];
        alpha = B.alpha[k] * dustGain;
        ramp = B.ramp[k];
      } else {
        const tl = Math.min(1, Math.max(0, (mix - PB[k4 + 3] * stagger) * invS));
        const e = cubicInOut(tl);
        let ax = PA[k4] * kA;
        let ay = PA[k4 + 1] * kA;
        let az = PA[k4 + 2] * kA;
        let bx = PB[k4] * kB;
        let by = PB[k4 + 1] * kB;
        let bz = PB[k4 + 2] * kB;
        let rA = A.ramp[k];
        let rB = B.ramp[k];
        const gA = gw[Math.min(7, A.group[k])];
        const gB = gw[Math.min(7, B.group[k])];
        // S8's pulled drawer and its resting plates (shaders/live/s08.glsl).
        if (stackA) {
          const act = gA * f.focusOn;
          const pull = act * act * (3 - 2 * act) * A.param[k] * 1.25 * kA;
          ax += (STACK_EX[0] + STACK_EY[0]) * pull;
          ay += (STACK_EX[1] + STACK_EY[1]) * pull;
          az += (STACK_EX[2] + STACK_EY[2]) * pull;
          rA += (0.25 - rA) * (1 - gA) * f.focusOn;
          rA += (0.75 - rA) * 0.7 * smoothstep(0.7, 1, gA) * f.focusOn;
        }
        if (stackB) {
          const act = gB * f.focusOn;
          const pull = act * act * (3 - 2 * act) * B.param[k] * 1.25 * kB;
          bx += (STACK_EX[0] + STACK_EY[0]) * pull;
          by += (STACK_EX[1] + STACK_EY[1]) * pull;
          bz += (STACK_EX[2] + STACK_EY[2]) * pull;
          rB += (0.25 - rB) * (1 - gB) * f.focusOn;
          rB += (0.75 - rB) * 0.7 * smoothstep(0.7, 1, gB) * f.focusOn;
        }
        ax += oAx;
        ay += oAy;
        bx += oBx;
        by += oBy;

        // §3.6 paths.
        if (path === PathId.POUR) {
          const sx = 0.5 - 0.5 * Math.cos(Math.PI * tl);
          x = ax + (bx - ax) * sx;
          y = ay + (by - ay) * tl * tl;
          z = az + (bz - az) * e;
          if (tl > 0.88) {
            const s = (tl - 0.88) / 0.12;
            y += 0.013 * Math.sin(TAU * s) * (1 - s);
          }
        } else if (piv && A.group[k] <= 3 && piv.length >= 6) {
          // TOPPLE: the bars tip rigidly about their bottom-right pivot, then glide.
          const g = A.group[k] <= 1 ? A.group[k] : 2;
          const pvx = piv[g * 2] * kA + oAx;
          const pvy = piv[g * 2 + 1] * kA + oAy;
          const r = Math.min(1, tl / 0.5);
          const th = -1.4 * r * r;
          const c = Math.cos(th);
          const s = Math.sin(th);
          const dx = ax - pvx;
          const dy = ay - pvy;
          const fx = pvx + c * dx - s * dy;
          const fy = pvy + s * dx + c * dy;
          const gl = cubicInOut(Math.min(1, Math.max(0, (tl - 0.4) / 0.6)));
          x = fx + (bx - fx) * gl;
          y = fy + (by - fy) * gl;
          z = az + (bz - az) * gl;
        } else {
          x = ax + (bx - ax) * e;
          y = ay + (by - ay) * e;
          z = az + (bz - az) * e;
          if (path === PathId.DIGITIZE) {
            const q = 0.6 * smoothstep(0.3, 0.36, e) * (1 - smoothstep(0.64, 0.7, e));
            if (q > 0) {
              x += (Math.round(x / 0.05) * 0.05 - x) * q;
              y += (Math.round(y / 0.05) * 0.05 - y) * q;
              z += (Math.round(z / 0.05) * 0.05 - z) * q;
            }
          } else if (path === PathId.DEAL) {
            z += 0.7 * Math.sin(Math.PI * e);
          } else if (path === PathId.SPIRAL && tl > 0 && tl < 1) {
            const dax = ax - oBx;
            const day = ay - oBy;
            const dbx = bx - oBx;
            const dby = by - oBy;
            const aa = Math.atan2(day, dax);
            let dth = Math.atan2(dby, dbx) - aa;
            dth -= TAU * Math.floor((dth + Math.PI) / TAU);
            const th = aa + (dth + TAU) * e;
            const rr = Math.hypot(dax, day) + (Math.hypot(dbx, dby) - Math.hypot(dax, day)) * e;
            x = oBx + rr * Math.cos(th);
            y = oBy + rr * Math.sin(th);
          }
        }
        if (turb > 0) {
          const tw = turb * Math.sin(Math.PI * tl);
          if (tw > 1e-4) {
            x += jit[k * 3] * tw;
            y += jit[k * 3 + 1] * tw;
            z += jit[k * 3 + 2] * tw;
          }
        }
        let aA = A.alpha[k] * wA;
        let aB = B.alpha[k] * wB;
        if (sinkA !== 1 && (A.role[k] === Role.FILL || A.role[k] === Role.SPARK)) aA *= sinkA;
        if (sinkB !== 1 && (B.role[k] === Role.FILL || B.role[k] === Role.SPARK)) aB *= sinkB;
        alpha = (aA + (aB - aA) * e) * gain;
        ramp = rA + (rB - rA) * e;
        w = gA + (gB - gA) * e;
      }

      // Project (§3.1: camera at z = 3.732, fov 30°).
      const persp = CAMERA_Z / (CAMERA_Z - z);
      if (!(persp > 0) || persp > 8) continue;
      const px = x * persp * pxPerSu + W / 2;
      const py = (1 - y * persp) * pxPerSu;
      if (px < -2 || px > W + 2 || py < -2 || py > H + 2) continue;
      alpha *= (floor + (1 - floor) * w) * Math.min(1.5, Math.max(0.4, persp));

      // Text-safe mask (§2.3; field.vert.glsl): ×.22 inside, a smootherstep feather outside (per rect), capped (safeMax), no ember.
      if (nSafe > 0 && alpha >= minA) {
        let insideMax = 0;
        for (let r = 0; r < nSafe; r++) {
          const r4 = r * 4;
          const d = Math.max(rects[r4] - px, px - rects[r4 + 2], rects[r4 + 1] - py, py - rects[r4 + 3]);
          const t = 1 - d / sfe[r];
          if (t <= 0) continue;
          const u = t >= 1 ? 1 : t;
          // A revealing C3 block's weight ramps with its text; the sparse dots
          // are fully masked by the time the text is 40% in (×2.5).
          const inside = u * u * u * (u * (u * 6 - 15) + 10) * Math.min(1, sw[r] * 2.5);
          alpha *= 1 + (0.22 - 1) * inside;
          if (ramp > 0.5) ramp += (0.5 - ramp) * inside;
          if (inside > insideMax) insideMax = inside;
        }
        if (insideMax > 0 && alpha > FALLBACK.safeMax) alpha += (FALLBACK.safeMax - alpha) * insideMax;
      }
      if (alpha < minA) continue;

      const ri = Math.round(Math.min(1, Math.max(0, ramp)) * (RAMP_LEVELS - 1));
      let ai = Math.round(Math.log(alpha / ALPHA_BASE) / ALPHA_STEP);
      ai = ai < 0 ? 0 : ai >= ALPHA_LEVELS ? ALPHA_LEVELS - 1 : ai;
      xs[n] = px;
      ys[n] = py;
      ss[n] = FALLBACK.dot * Math.min(1.5, Math.max(0.85, persp));
      bk[n] = ri * ALPHA_LEVELS + ai;
      n++;
    }
    this.n = n;
  }

  /**
   * Clear, then one fillStyle per non-empty bucket and one fillRect per dot.
   * The canvas element carries a void background (see opaque()), so it is
   * opaque like the WebGL one: it covers the CSS glow, and the [data-safe]
   * scrims sit on void and never band against the glow. A clear is cheaper
   * than an opaque full-canvas fill on a software rasteriser.
   */
  private flush(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const n = this.n;
    if (n === 0) return;
    const sketch = getTheme() === 'sketch';
    if (sketch !== this.sketch) {
      this.sketch = sketch;
      this.styles = buildStyles(sketch);
      this.canvas.style.backgroundColor = sketch ? PAPER : VOID;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Additive, like the WebGL field: overlapping dots in dense shapes
    // brighten. Pencil on paper composites normally (dots darken).
    ctx.globalCompositeOperation = sketch ? 'source-over' : 'lighter';
    const counts = this.counts;
    counts.fill(0);
    const bk = this.bk;
    for (let i = 0; i < n; i++) counts[bk[i] + 1]++;
    for (let b = 1; b <= BUCKETS; b++) counts[b] += counts[b - 1];
    const order = this.order;
    for (let i = 0; i < n; i++) order[counts[bk[i]]++] = i;
    // counts[b] is now the end of bucket b.
    const xs = this.xs;
    const ys = this.ys;
    const ss = this.ss;
    let start = 0;
    for (let b = 0; b < BUCKETS; b++) {
      const end = counts[b];
      if (end > start) {
        ctx.fillStyle = this.styles[b];
        for (let j = start; j < end; j++) {
          const i = order[j];
          const s = ss[i];
          ctx.fillRect(xs[i] - s / 2, ys[i] - s / 2, s, s);
        }
      }
      start = end;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * html[data-field-states] while the fallback draws: the resident states, but
 * never S2 — §8.4 keeps the chart's SVG bars in the fallback (the `field-s2:`
 * variant is live-only anyway). The other DOM stand-ins (NDA slabs, emblem
 * outlines, stack plates, beacon shell, the 404 hairline) give way to the
 * constellation wherever index.css's `field-sN:` variants accept
 * html[data-field="fallback"].
 */
export function fallbackStatesAttr(has: (id: StateId) => boolean): string {
  let ids = '';
  for (let id = 0; id < STATE_COUNT; id++) {
    if (id !== StateId.CHART && has(id as StateId)) ids += ids ? ` ${id}` : `${id}`;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Canvas helpers.

/** A 2D context on `canvas`, or null (the canvas already holds a WebGL context, or 2D is unavailable). */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d', { alpha: true });
  } catch {
    return null;
  }
}

/** A transparent overlay canvas next to `host` inside #field-root (same box, painted above it). */
function makeOverlay(host: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.setAttribute('data-field-fallback', '');
  c.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none';
  host.insertAdjacentElement('afterend', c);
  return c;
}

// ---------------------------------------------------------------------------
// Context loss (engine.ts): a passive overlay painted by the engine's loop.

/**
 * The §8.4 context-loss fallback. The engine creates it on the first
 * `webglcontextlost` and paints it from its loop while the context is gone
 * (or for good after a second loss); `hide()` crossfades it away when the
 * context is restored (the WebGL canvas fades in over the same 400 ms).
 */
export class LossFallback {
  private readonly overlay: HTMLCanvasElement;
  private readonly painter: FallbackPainter;
  private readonly src: PaintSource;
  private shown = false;

  constructor(host: HTMLCanvasElement, src: PaintSource) {
    this.overlay = makeOverlay(host);
    const ctx = context2d(this.overlay);
    if (!ctx) {
      this.overlay.remove();
      throw new Error('Canvas2D unavailable');
    }
    this.painter = new FallbackPainter(this.overlay, ctx);
    this.src = src;
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Fade in (the WebGL canvas is already at 0: its drawing buffer is gone). */
  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.painter.invalidate();
    gsap.killTweensOf(this.overlay);
    gsap.to(this.overlay, { opacity: 1, duration: FALLBACK.fade, ease: 'none' });
  }

  /** Crossfade out (context restored), then clear. */
  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    gsap.killTweensOf(this.overlay);
    gsap.to(this.overlay, {
      opacity: 0,
      duration: FALLBACK.fade,
      ease: 'none',
      onComplete: () => {
        if (!this.shown) this.painter.clear();
      },
    });
  }

  /** Paint frame `f` (only when shown and the picture changed). */
  paint(f: Readonly<FieldFrame>, W: number, H: number, reduced: boolean, force = false): boolean {
    return this.shown && this.painter.paint(f, this.src, W, H, reduced, force);
  }

  stats(): PaintStats {
    return this.painter.paintStats();
  }

  dispose(): void {
    this.shown = false;
    gsap.killTweensOf(this.overlay);
    this.overlay.remove();
  }
}

// ---------------------------------------------------------------------------
// The standalone fallback (no WebGL2 at all).

class ArraySet {
  readonly genW: number;
  readonly genH: number;
  readonly pos: (Float32Array | null)[] = new Array<Float32Array | null>(STATE_COUNT).fill(null);
  readonly meta: (Uint8Array | null)[] = new Array<Uint8Array | null>(STATE_COUNT).fill(null);
  readonly extras: (Record<string, number[]> | undefined)[] = new Array<Record<string, number[]> | undefined>(STATE_COUNT).fill(undefined);

  constructor(genW: number, genH: number) {
    this.genW = genW;
    this.genH = genH;
  }

  has(id: StateId): boolean {
    return this.pos[id] !== null && this.meta[id] !== null;
  }

  set(id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>): void {
    this.pos[id] = pos;
    this.meta[id] = meta;
    this.extras[id] = extras;
  }

  /** Highest k with S0…Sk resident (home chain); −1 without S0. */
  ceiling(): number {
    let k = -1;
    for (const id of HOME_STATES) {
      if (!this.has(id)) break;
      k = id;
    }
    return k;
  }
}

class FallbackField implements PaintSource {
  readonly handle: FieldHandle;
  private readonly canvas: HTMLCanvasElement;
  /** The canvas that is not the host (an overlay when the host holds a WebGL context). */
  private readonly own: boolean;
  private readonly painter: FallbackPainter;
  private readonly gen: GeneratorClient;
  private mode: FieldMode;
  private readonly pauses = new Map<PauseReason, number>();
  private ready = false;
  private readonly readyCbs = new Set<() => void>();
  private disposed = false;

  private idxLayout: IndexLayout | null = null;
  private dust: DustData | null = null;
  private set: ArraySet = new ArraySet(0, 0);
  private bootJob = -1;
  private readonly lazyJobs = new Set<number>();
  private readonly requested = new Set<StateId>();
  private deferredHome: StateId[] | null = null;
  private pending: { set: ArraySet; job: number; expect: Set<StateId>; name: NameSample | null } | null = null;
  private genLayoutMode = store.layout;
  private name: NameSample | null = null;
  private nameK = 1;
  private nameResampling = false;
  private nameEls: NameElements = { h1: null, anchor: null };
  private fontUnlisten: (() => void) | null = null;
  private seenVersion = -1;

  private W = 0;
  private H = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private ticking = false;
  private dirtyReq = false;
  private dirtyUntil = 0;
  private shownSettled = false;
  private rendered = 0;
  private fps = 60;
  private readonly cleanups: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, own: boolean, ctx: CanvasRenderingContext2D, opts: FieldBootOptions) {
    this.canvas = canvas;
    this.own = own;
    this.painter = new FallbackPainter(canvas, ctx);
    this.mode = opts.mode;
    this.gen = new GeneratorClient({
      onState: (job, id, pos, meta, extras) => this.onState(job, id, pos, meta, extras),
      onMissing: (job, id) => this.onMissing(job, id),
      onError: (job, id, message) => {
        console.error(`[field] generator S${id} failed: ${message}`);
        this.onMissing(job, id);
      },
      onDone: () => {},
    });
    const readyNow = () => this.ready;
    this.handle = {
      kind: 'canvas2d',
      tier: null,
      get ready() {
        return readyNow();
      },
      intro: { run: () => Promise.resolve(), skip() {}, running: false },
      print() {},
      stats: () => this.stats(),
      setMode: (m) => this.setMode(m),
      pause: (r) => {
        this.pauses.set(r, (this.pauses.get(r) ?? 0) + 1);
      },
      resume: (r) => {
        const n = (this.pauses.get(r) ?? 0) - 1;
        if (n > 0) this.pauses.set(r, n);
        else this.pauses.delete(r);
        this.invalidate();
      },
      invalidate: () => this.invalidate(),
      onReady: (cb) => {
        if (this.ready) {
          cb();
          return () => {};
        }
        this.readyCbs.add(cb);
        return () => {
          this.readyCbs.delete(cb);
        };
      },
      dispose: () => this.dispose(),
    };
  }

  // PaintSource ---------------------------------------------------------------

  layout(): IndexLayout | null {
    return this.idxLayout;
  }

  /** A reused view (the painter reads it before its next call): no per-frame allocation. */
  private readonly view: { pos: Float32Array; meta: Uint8Array } = { pos: new Float32Array(0), meta: new Uint8Array(0) };
  arrays(id: StateId): StateArrays | null {
    const p = this.set.pos[id];
    const m = this.set.meta[id];
    if (!p || !m) return null;
    this.view.pos = p;
    this.view.meta = m;
    return this.view;
  }

  scale(id: StateId, H: number): number {
    const gs = this.set.genH > 0 && H > 0 ? this.set.genH / H : 1;
    return id === StateId.STATIC ? 1 : id === StateId.NAME ? gs * this.nameK : gs;
  }

  pivots(): readonly number[] | null {
    return this.set.extras[StateId.CHART]?.uBarPivot ?? null;
  }

  // Boot ----------------------------------------------------------------------

  start(): void {
    // No intro without the WebGL field (§6): the pre-paint guess goes.
    clearIntroPending();
    this.canvas.style.opacity = '0';
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width || window.innerWidth;
    this.H = r.height || window.innerHeight;
    if (store.scroll.W === 0 || store.scroll.H === 0) {
      store.scroll.W = window.innerWidth;
      store.scroll.H = this.svh();
    }
    const q = getDebugParams();
    if (q.film !== null && store.film.override === null) {
      store.film.override = filmOverride(q.film, true);
      store.flags.intro = false;
    }
    this.applyStoreMode();
    setFilmCeiling(0);
    this.listen();
    void this.bootStates();
  }

  /** store.mode: 'fallback' (full motion) or 'reduced' (the director's posters, §8.2). */
  private applyStoreMode(): void {
    store.mode = this.mode === 'reduced' ? 'reduced' : 'fallback';
  }

  private svh(): number {
    if (store.scroll.H > 0) return store.scroll.H;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h || window.innerHeight;
  }

  private viewport(): GenViewport {
    const W = this.W || window.innerWidth;
    const H = this.H || window.innerHeight;
    return { W, H, A: W / H, svh: this.svh() };
  }

  private async bootStates(): Promise<void> {
    this.idxLayout = createIndexLayout(GEN_DIMS);
    const view = this.viewport();
    this.dust = makeDust(this.idxLayout, view.A);
    this.set = new ArraySet(view.W, view.H);
    this.genLayoutMode = store.layout;
    const on404 = store.route.kind === '404';
    const first: readonly StateId[] = on404 ? [StateId.STATIC, StateId.FLATLINE] : BOOT_ORDER;
    this.bootJob = this.gen.start(this.jobFor(first, view));
    for (const id of first) this.requested.add(id);
    this.requested.add(StateId.NAME);
    this.deferredHome = on404 ? BOOT_ORDER.filter((id) => !first.includes(id)) : null;

    const fontReady = await waitForNameFont();
    if (this.disposed) return;
    await new Promise<void>((r) => whenIdle(r));
    if (this.disposed) return;
    this.setName(this.sampleNameInto(this.set, view));
    if (!fontReady) this.listenForFont();
    this.onSetChanged();
    this.maybeReady();
  }

  private jobFor(ids: readonly StateId[], view: GenViewport): GenJob {
    const short = store.layout === 'mobile' && view.svh < 600;
    const vp = { W: view.W, H: view.svh };
    const anchors: Partial<Record<StateId, AnchorSize>> = {};
    for (const id of ids) {
      const b = resolveAnchor(id, store.layout, vp, short);
      const m = store.anchors.get(id);
      anchors[id] = { w: m?.w ?? b.w, h: m?.h ?? b.h, extra: b.extra };
    }
    return { ids, tier: GEN_DIMS, view, layout: store.layout, short, anchors };
  }

  private sampleNameInto(set: ArraySet, view: GenViewport): NameSample | null {
    const layout = this.idxLayout;
    if (!layout) return null;
    if (!this.dust || this.dust.A !== view.A) this.dust = makeDust(layout, view.A);
    this.nameEls = findNameElements();
    const sample = sampleName({ layout, dust: this.dust, view, mode: store.layout, elements: this.nameEls });
    set.set(StateId.NAME, sample.pos, sample.meta);
    return sample;
  }

  private setName(n: NameSample | null): void {
    this.name = n;
    this.updateNameScale();
  }

  private updateNameScale(): void {
    const n = this.name;
    const rec = store.anchors.get(StateId.NAME);
    this.nameK = n && rec && n.anchorW > 0 && rec.w > 0 ? rec.w / n.anchorW : 1;
  }

  private resampleName(): void {
    if (this.nameResampling) return;
    this.nameResampling = true;
    whenIdle(() => {
      this.nameResampling = false;
      if (this.disposed || !this.idxLayout) return;
      const svh = this.viewport().svh;
      const p = this.pending;
      if (p) {
        const g = p.set;
        if (p.name) p.name = this.sampleNameInto(g, { W: g.genW, H: g.genH, A: g.genW / g.genH, svh });
      } else {
        const g = this.set;
        this.setName(this.sampleNameInto(g, { W: g.genW, H: g.genH, A: g.genW / g.genH, svh }));
      }
      this.invalidate();
    });
  }

  private checkName(): void {
    this.updateNameScale();
    const n = this.name;
    const rec = store.anchors.get(StateId.NAME);
    if (!this.ready || !n || n.source !== 'dom' || !rec || this.pending || this.resizeTimer !== null) return;
    if (Math.abs(rec.w - n.anchorW) > NAME_RESAMPLE_PX || Math.abs(rec.h - n.anchorH) > NAME_RESAMPLE_PX) this.resampleName();
  }

  private listenForFont(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const onDone = () => {
      if (!isNameFontReady()) return;
      this.fontUnlisten?.();
      this.resampleName();
    };
    fonts.addEventListener('loadingdone', onDone);
    this.fontUnlisten = () => {
      fonts.removeEventListener('loadingdone', onDone);
      this.fontUnlisten = null;
    };
  }

  private onState(job: number, id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>): void {
    if (this.disposed) return;
    if (job === this.bootJob || this.lazyJobs.has(job)) {
      this.set.set(id, pos, meta, extras);
      this.onSetChanged();
      this.maybeReady();
    } else if (this.pending && job === this.pending.job) {
      this.pending.set.set(id, pos, meta, extras);
      this.maybeSwap();
    }
  }

  private onMissing(job: number, id: StateId): void {
    if (this.pending && job === this.pending.job) {
      this.pending.expect.delete(id);
      this.maybeSwap();
    }
  }

  private onSetChanged(): void {
    setFilmCeiling(Math.max(0, this.set.ceiling()));
    this.publishStates();
    this.invalidate();
  }

  private statesAttr = '';
  private publishStates(): void {
    if (!this.ready || this.disposed) return;
    const ids = fallbackStatesAttr((id) => this.set.has(id));
    if (ids === this.statesAttr) return;
    this.statesAttr = ids;
    html().setAttribute('data-field-states', ids);
  }

  private requestLazy(id: StateId): void {
    if (this.requested.has(id) || !this.idxLayout) return;
    this.requested.add(id);
    const g = this.set;
    const view = { W: g.genW, H: g.genH, A: g.genW / g.genH, svh: this.viewport().svh };
    this.lazyJobs.add(this.gen.start(this.jobFor([id], view), false));
  }

  private buildDeferredHome(): void {
    const ids = this.deferredHome;
    this.deferredHome = null;
    if (!ids) return;
    const todo = ids.filter((id) => !this.requested.has(id));
    if (!todo.length) return;
    for (const id of todo) this.requested.add(id);
    const g = this.set;
    const view = { W: g.genW, H: g.genH, A: g.genW / g.genH, svh: this.viewport().svh };
    this.lazyJobs.add(this.gen.start(this.jobFor(todo, view), false));
  }

  private maybeReady(): void {
    if (this.ready || this.disposed || !this.set.has(StateId.STATIC) || !this.set.has(StateId.NAME)) return;
    this.ready = true;
    html().setAttribute('data-field', 'fallback');
    this.publishStates();
    this.startTicking();
    this.frameAt(gsap.ticker.time, 0, true);
    gsap.to(this.canvas, { opacity: 1, duration: this.mode === 'full' ? FALLBACK.fade : 0.2, ease: 'none' });
    const cbs = [...this.readyCbs];
    this.readyCbs.clear();
    for (const cb of cbs) cb();
  }

  // Regeneration (§9.7) -------------------------------------------------------

  private finePointer(): boolean {
    try {
      return window.matchMedia(MQ.finePointer).matches;
    } catch {
      return false;
    }
  }

  private maybeRegenerate(): void {
    if (!this.ready || this.disposed) return;
    const g = this.pending ? this.pending.set : this.set;
    const dW = Math.abs(this.W - g.genW);
    const dH = Math.abs(this.H - g.genH);
    const turned = this.W > this.H !== g.genW > g.genH;
    if (dW > REGEN_DW || turned || (this.finePointer() && dH > REGEN_DH_FINE) || store.layout !== this.genLayoutMode) {
      this.regenerate();
    }
  }

  private regenerate(): void {
    if (!this.idxLayout) return;
    const view = this.viewport();
    const expect = new Set<StateId>();
    for (let id = 0; id < STATE_COUNT; id++) if (id !== StateId.NAME && this.set.has(id as StateId)) expect.add(id as StateId);
    const ids: StateId[] = BOOT_ORDER.filter((id) => !this.deferredHome?.includes(id));
    for (const id of this.requested) {
      if (id === StateId.NAME || ids.includes(id)) continue;
      ids.push(id);
      expect.add(id);
    }
    const next = new ArraySet(view.W, view.H);
    this.pending = { set: next, job: -1, expect, name: null };
    this.genLayoutMode = store.layout;
    this.pending.job = this.gen.start(this.jobFor(ids, view));
    whenIdle(() => {
      if (this.disposed || this.pending?.set !== next) return;
      this.pending.name = this.sampleNameInto(next, view);
      this.maybeSwap();
    });
  }

  /** All buffers back: swap atomically (a 2D repaint needs no opacity dip). */
  private maybeSwap(): void {
    const p = this.pending;
    if (!p || !p.name) return;
    for (const id of p.expect) if (!p.set.has(id)) return;
    this.set = p.set;
    this.setName(p.name);
    this.bootJob = p.job;
    this.lazyJobs.clear();
    this.pending = null;
    this.onSetChanged();
    this.checkName();
  }

  private onStoreVersion(): void {
    this.seenVersion = store.version;
    const els = findNameElements();
    if (els.h1 !== this.nameEls.h1 || els.anchor !== this.nameEls.anchor) {
      this.nameEls = els;
      if (this.ready && els.h1 && this.name?.source === 'layout') this.resampleName();
    }
    this.maybeRegenerate();
    this.checkName();
  }

  // Loop ------------------------------------------------------------------------

  private readonly renderFrame = (time: number, deltaMs: number): void => {
    if (this.disposed || !this.ready) return;
    this.frameAt(time, deltaMs, false);
  };

  private frameAt(time: number, deltaMs: number, force: boolean): void {
    const s = store;
    if (s.version !== this.seenVersion) this.onStoreVersion();
    if (s.layout !== this.genLayoutMode) this.regenerate();
    if (this.deferredHome && s.route.kind !== '404') this.buildDeferredHome();
    const f = tick(s, deltaMs / 1000, time);
    if (!this.set.has(f.a)) this.requestLazy(f.a);
    if (!this.set.has(f.b)) this.requestLazy(f.b);
    if (this.dirtyReq) {
      this.dirtyReq = false;
      this.dirtyUntil = Math.max(this.dirtyUntil, time + DIRTY_S);
    }
    if (!force && this.pauses.size > 0) return;
    const reduced = this.mode === 'reduced';
    const drew = this.painter.paint(f, this, this.W, this.H, reduced, force);
    if (drew) {
      this.rendered++;
      if (deltaMs > 0 && deltaMs < 250) this.fps += (1000 / deltaMs - this.fps) * 0.05;
    }
    // Reduced motion is on demand (§8.2): leave the ticker once a settled
    // frame is on screen and no invalidation window is open. Full motion
    // stays on the ticker (the director follows every fx tween, e.g. the
    // menu's opacity) but only paints when the picture changed.
    if (reduced && !force && time > this.dirtyUntil && f.settled && this.shownSettled && !this.converging(f)) {
      this.stopTicking();
    }
    this.shownSettled = f.settled;
  }

  /** Damped fx still moving toward their targets (a paint is still coming). */
  private converging(f: Readonly<FieldFrame>): boolean {
    const fx = store.fx;
    if (Math.abs(f.charge - fx.charge) > 1e-3 || Math.abs(f.disperse - fx.disperse) > 1e-3 || Math.abs(f.focusOn - fx.focusOn) > 1e-3) {
      return true;
    }
    for (let i = 0; i < 8; i++) if (Math.abs(f.groupW[i] - fx.groupW[i]) > 1e-3) return true;
    return false;
  }

  private invalidate(): void {
    if (this.disposed) return;
    this.dirtyReq = true;
    this.painter.invalidate();
    this.startTicking();
  }

  private startTicking(): void {
    if (this.ticking || this.disposed || !this.ready) return;
    this.ticking = true;
    gsap.ticker.add(this.renderFrame);
  }

  private stopTicking(): void {
    if (!this.ticking) return;
    this.ticking = false;
    gsap.ticker.remove(this.renderFrame);
  }

  private listen(): void {
    const onSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0 || (w === this.W && h === this.H)) return;
      this.W = w;
      this.H = h;
      this.invalidate();
      if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null;
        this.maybeRegenerate();
        this.checkName();
      }, RESIZE_DEBOUNCE_MS);
    };
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const r = entries[entries.length - 1]?.contentRect;
        if (r) onSize(r.width, r.height);
      });
      ro.observe(this.canvas);
      this.cleanups.push(() => ro.disconnect());
    } else {
      const onResize = () => onSize(window.innerWidth, window.innerHeight);
      window.addEventListener('resize', onResize);
      this.cleanups.push(() => window.removeEventListener('resize', onResize));
    }
    // DPR changes (another screen, zoom): repaint at the new backing size.
    const onDpr = () => this.invalidate();
    window.addEventListener('resize', onDpr);
    this.cleanups.push(() => window.removeEventListener('resize', onDpr));
  }

  private setMode(mode: FieldMode): void {
    if (this.disposed) return;
    this.mode = mode;
    this.applyStoreMode();
    this.invalidate();
  }

  private stats(): FieldStats {
    const p = this.painter.paintStats();
    return {
      ready: this.ready,
      mode: this.mode,
      tier: 'low',
      textureTier: 'low',
      forced: false,
      N: GEN_DIMS.N,
      drawRange: p.points,
      dpr: fallbackDpr(this.W, this.H),
      glow: false,
      bokehCap: 0,
      fps: this.fps,
      rendered: this.rendered,
      canvas: [this.W, this.H],
      generatedFor: [this.set.genW, this.set.genH],
      ceiling: this.set.ceiling(),
      resident: Array.from({ length: STATE_COUNT }, (_, i) => i).filter((i) => this.set.has(i as StateId)),
      adaptive: [],
      lost: false,
      intro: false,
      name: this.name
        ? {
            source: this.name.source,
            fontReady: this.name.fontReady,
            ms: Math.round(this.name.ms * 10) / 10,
            scale: Math.round(this.nameK * 1e4) / 1e4,
          }
        : null,
      cores: navigator.hardwareConcurrency || 0,
      renderer: 'canvas2d',
      paint: p,
    };
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTicking();
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    for (const fn of this.cleanups.splice(0)) fn();
    this.fontUnlisten?.();
    this.gen.dispose();
    gsap.killTweensOf(this.canvas);
    this.painter.clear();
    if (this.own) this.canvas.remove();
    else {
      this.canvas.style.opacity = '0';
      this.canvas.style.backgroundColor = '';
    }
    if (html().getAttribute('data-field') === 'fallback') {
      html().removeAttribute('data-field');
      html().removeAttribute('data-field-states');
    }
    if (store.mode === 'fallback') store.mode = 'full';
    clearIntroPending();
    setFilmCeiling(FILM_MAX);
    this.readyCbs.clear();
  }
}

/**
 * The standalone Canvas2D field (field/index.ts, §8.4). `ctx` is a 2D
 * context on the host canvas, or null when the host cannot give one (it
 * holds a WebGL context from a failed engine start): then the fallback
 * draws on an overlay canvas of its own. Throws when Canvas2D is
 * unavailable altogether (index.ts falls back to the CSS glow).
 */
export const createFallback: CreateField<CanvasRenderingContext2D | null> = async (canvas, ctx, opts) => {
  let target = canvas;
  let c2 = ctx;
  let own = false;
  if (!c2) {
    target = makeOverlay(canvas);
    own = true;
    c2 = context2d(target);
    if (!c2) {
      target.remove();
      throw new Error('Canvas2D unavailable');
    }
  }
  const field = new FallbackField(target, own, c2, opts);
  field.start();
  return field.handle;
};
