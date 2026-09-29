/**
 * S6 PROMPT DECK — Prmpt Art, "from prompt to art" (SPEC §3.10): a fanned
 * deck of prompt cards, a terminal caret on the front card, and an art
 * stroke sweeping over the deck. Project emblem, aspect-fit into the card
 * box (layout.ts: desktop card box right of centre, mobile project slot) at
 * 90% (CARD.emblemFill).
 *
 * Deck units, y up, the front card centred on the origin; the composition's
 * bounding box is re-centred on the anchor (DECK_SHIFT) and one unit is `s`
 * su (fitScale), so every length below scales with the box.
 *
 * | Component    | Share | Role  | Recipe                                                                      |
 * |--------------|-------|-------|-----------------------------------------------------------------------------|
 * | Back cards   | 4 × 4%| edge  | .62 × .86, r .05, fanned about (0, −1.25); only the visible perimeter        |
 * | Front card   |  8%   | edge  | the same outline, unrotated, z 0                                             |
 * | "›_"         | 24%   | edge / fill / blink | chevron (two .045 strokes) + underscore rect, upper left; 40% edges |
 * | Text lines   | 10%   | fill  | three dotted lines, widths .72 / .50 / .62 of the card, set as words         |
 * | Art stroke   | 36%   | flow  | the cubic Bézier, Gaussian cross-section σ .035, tapered; param = arc u      |
 * | Halo         |  6%   | halo  | dim Gaussian about the deck                                                  |
 * | Sparks       |  S    | spark | 70% the stroke's ember head (g0), 30% the underscore (g1, the blink)         |
 *
 * Fan (§3.10: −16 / −8 / 0 / 8 / 16° in screen terms): card k = 0…4 runs
 * left → right, z = −.07·|k − 2| units. Outlines are OCCLUDED by the cards in
 * front of them (deeper |k − 2|; ties: the right card is in front), so the
 * deck reads as solid cards rather than a tangle of crossing outlines; each
 * back card's 4% is spent on its visible perimeter only.
 *
 * The art stroke: u = arc-length fraction from P0 (−.85, .72) — the ember
 * HEAD, where the sparks fly — to P3 (.9, .95), the bone tail (§3.10 "ember
 * to signal along u"). Width σ(u) = .035·deckTaper(u): a blunt head that
 * swells over the first 8%, full through .4, thinning to a dry-brush tail.
 * Particles are stratified along u with a Gaussian normal offset.
 *
 * Shader contracts (shaders/live/s06.glsl mirrors the constants below):
 * - Stroke particles (role flow) and head sparks (spark g0) sit at z =
 *   −DECK.zk·s su EXACTLY, so live() recovers the unit length s = −z / zk
 *   (the S4 trick): the flow evaluates the Bézier in units without a
 *   per-state uniform.
 * - meta.b = u (8-bit) on stroke particles. live() decomposes a particle
 *   against the curve's frame at the quantised u — along-tangent residual j
 *   and normalised normal offset g = n / σ(u) — and rebuilds it at
 *   u' = fract(u + .05t) with σ(u'): the stroke streams from the head to
 *   the tail while its silhouette stays put (the u density is uniform, so a
 *   rigid shift in u is stationary). meta.g = α·deckCore(u) and meta.r =
 *   deckRamp(u) are rewritten for u' in the shader (never divided by ~0:
 *   deckCore ≥ .3). 40% of the grains draw as wide soft sprites (live).
 * - Arc length → Bézier t: a 16-interval piecewise-linear table (DECK_T),
 *   identical in both places.
 * - Underscore particles (role blink) and underscore sparks (spark g1)
 *   blink on a 1.06 s square wave with 80 ms edges, α 1 ↔ .12, ON while
 *   |fract(t / 1.06 + .5) − .5| < .25: t = 0 is the middle of an ON phase.
 *
 * Sort (§3.3): seeded shuffle. Stagger key (§3.9): card k .18k + .1·rand
 * (the deck deals left to right; the front card's glyph and lines ride
 * with it), stroke .8 + .2u (the head lands first, the tail streams in).
 *
 * Reduced-motion poster (§3.10 "caret on"): uTime frozen at DECK_POSTER_T
 * = 0 — the middle of the caret's ON phase, the stroke at its generated
 * pose (POSTER_TIME[DECK] is already 0).
 */
import { StateId } from './ids.ts';
import {
  Polyline,
  RAMP,
  clamp01,
  fitScale,
  gauss,
  lerp,
  mulberry32,
  stateSeed,
  type StateGenerator,
  type TargetList,
} from './common.ts';
import { Role } from '../uniforms.ts';

type Pt = [number, number];
type RPt = readonly [number, number];

// ---------------------------------------------------------------------------
// Geometry (deck units, y up). Mirrors shaders/live/s06.glsl.

export const DECK = {
  card: { w: 0.62, h: 0.86, r: 0.05 },
  /** Fan angle per card k = 0…4, left to right (deg, CCW with y up; §3.10's −16…16 read in screen terms). */
  fan: [16, 8, 0, -8, -16],
  pivot: [0, -1.25] as RPt,
  /** z = −zStep·|k − 2| units. */
  zStep: 0.07,
  front: 2,
  /** Art stroke control points, Gaussian σ at full width. */
  art: [
    [-0.85, 0.72],
    [-0.3, 1.25],
    [0.35, 0.3],
    [0.9, 0.95],
  ] as readonly RPt[],
  sigma: 0.035,
  /** Stroke flow along u (1/s). */
  flow: 0.05,
  /** Caret blink: period, edge width (s), low α. */
  blink: { period: 1.06, edge: 0.08, low: 0.12 },
  /** Stroke / head-spark depth factor: z = −zk·s su (the unit-length carrier). */
  zk: 0.02,
  /** Where the head sparks gather (u). */
  headU: 0.04,
} as const;

/** Reduced-motion poster: the middle of the caret's ON phase; the stroke at rest. */
export const DECK_POSTER_T = 0;

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Stroke width profile (× σ): blunt head, full through .4, dry-brush tail. Floor .15 (never 0: live() divides by it). */
export const deckTaper = (u: number): number => 0.15 + 0.85 * smooth(0, 0.08, u) * (1 - smooth(0.4, 1, u));
/** α along the stroke: the head is brightest; the thin tail dims with its width (≥ .3: live() divides by it). */
export const deckCore = (u: number): number => (1 - 0.45 * u) * (0.55 + 0.45 * deckTaper(u));
/** Colour along the stroke: ember at the head → signal by the tail (§3.10). */
export const deckRamp = (u: number): number => RAMP.signal + (RAMP.ember - RAMP.signal) * (1 - smooth(0, 0.85, u));

// Bézier and its arc-length table.
const [P0, P1, P2, P3] = DECK.art;
function bez(t: number, out: Pt): Pt {
  const a = 1 - t;
  const b0 = a * a * a;
  const b1 = 3 * a * a * t;
  const b2 = 3 * a * t * t;
  const b3 = t * t * t;
  out[0] = b0 * P0[0] + b1 * P1[0] + b2 * P2[0] + b3 * P3[0];
  out[1] = b0 * P0[1] + b1 * P1[1] + b2 * P2[1] + b3 * P3[1];
  return out;
}
/** Unit tangent at t. */
function bezTan(t: number, out: Pt): Pt {
  const a = 1 - t;
  const c0 = 3 * a * a;
  const c1 = 6 * a * t;
  const c2 = 3 * t * t;
  const x = c0 * (P1[0] - P0[0]) + c1 * (P2[0] - P1[0]) + c2 * (P3[0] - P2[0]);
  const y = c0 * (P1[1] - P0[1]) + c1 * (P2[1] - P1[1]) + c2 * (P3[1] - P2[1]);
  const l = Math.hypot(x, y) || 1;
  out[0] = x / l;
  out[1] = y / l;
  return out;
}

/** DECK_T[i] = Bézier t at arc-length fraction i / 16 (the shader holds the same table). */
export const DECK_T_STEPS = 16;
export const DECK_T: readonly number[] = (() => {
  const n = 4096;
  const cum = new Float64Array(n + 1);
  const a: Pt = [0, 0];
  const b: Pt = [0, 0];
  bez(0, a);
  for (let i = 1; i <= n; i++) {
    bez(i / n, b);
    cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    a[0] = b[0];
    a[1] = b[1];
  }
  const out: number[] = [0];
  let j = 0;
  for (let k = 1; k < DECK_T_STEPS; k++) {
    const s = (k / DECK_T_STEPS) * cum[n];
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j]);
    out.push(+((j + f) / n).toFixed(6));
  }
  out.push(1);
  return out;
})();

/** Arc-length fraction u → Bézier t (piecewise linear over DECK_T). */
export function deckT(u: number): number {
  const x = clamp01(u) * DECK_T_STEPS;
  const i = Math.min(DECK_T_STEPS - 1, Math.floor(x));
  return lerp(DECK_T[i], DECK_T[i + 1], x - i);
}

// Cards.
const CARD_W = DECK.card.w;
const CARD_H = DECK.card.h;
const CARD_R = DECK.card.r;
const DEG = Math.PI / 180;

/** Signed distance to the unrotated card (units; < 0 inside). */
function cardSd(x: number, y: number): number {
  const qx = Math.abs(x) - (CARD_W / 2 - CARD_R);
  const qy = Math.abs(y) - (CARD_H / 2 - CARD_R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CARD_R;
}

/** cos / sin of each card's fan angle. */
const FAN_C = DECK.fan.map((a) => Math.cos(a * DEG));
const FAN_S = DECK.fan.map((a) => Math.sin(a * DEG));

/** Card k's frame: point in card-local units → deck units (rotation about the pivot). */
function toDeck(k: number, x: number, y: number, out: Pt): Pt {
  const c = FAN_C[k];
  const s = FAN_S[k];
  const [px, py] = DECK.pivot;
  const dx = x - px;
  const dy = y - py;
  out[0] = px + c * dx - s * dy;
  out[1] = py + s * dx + c * dy;
  return out;
}
/** Deck units → card k's local units. */
function toCard(k: number, x: number, y: number, out: Pt): Pt {
  const c = FAN_C[k];
  const s = -FAN_S[k];
  const [px, py] = DECK.pivot;
  const dx = x - px;
  const dy = y - py;
  out[0] = px + c * dx - s * dy;
  out[1] = py + s * dx + c * dy;
  return out;
}

const depth = (k: number): number => Math.abs(k - DECK.front);
/** Card j is in front of card k (shallower; ties: the right card wins). */
const inFront = (j: number, k: number): boolean => depth(j) < depth(k) || (depth(j) === depth(k) && j > k);
/** Back outlines tuck this far under a card in front (units): a clean occlusion gap. */
const OCCLUDE_MARGIN = 0.014;

const tmpC: Pt = [0, 0];
/** Is deck point (x, y) of card k hidden by a card in front of it? */
function occluded(k: number, x: number, y: number): boolean {
  for (let j = 0; j < DECK.fan.length; j++) {
    if (j === k || !inFront(j, k)) continue;
    toCard(j, x, y, tmpC);
    if (cardSd(tmpC[0], tmpC[1]) < OCCLUDE_MARGIN) return true;
  }
  return false;
}

function arc(out: RPt[], cx: number, cy: number, r: number, a0: number, a1: number, n = 10): void {
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}
/** The card outline (unrotated, centred), from the top-left corner's end, clockwise on screen. */
const CARD_OUTLINE = (() => {
  const hx = CARD_W / 2;
  const hy = CARD_H / 2;
  const r = CARD_R;
  const p: RPt[] = [[-hx + r, hy]];
  p.push([hx - r, hy]);
  arc(p, hx - r, hy - r, r, Math.PI / 2, 0);
  p.push([hx, -hy + r]);
  arc(p, hx - r, -hy + r, r, 0, -Math.PI / 2);
  p.push([-hx + r, -hy]);
  arc(p, -hx + r, -hy + r, r, -Math.PI / 2, -Math.PI);
  p.push([-hx, hy - r]);
  arc(p, -hx + r, hy - r, r, Math.PI, Math.PI / 2);
  return new Polyline(p, true);
})();

// Front card content, in front-card units: the "›_" glyph (§3.10), moved to
// the card's upper left, and the three text lines under it.
const GLYPH_W = 0.045;
const CHEVRON: readonly [RPt, RPt][] = [
  [
    [-0.16, 0.18],
    [0, 0],
  ],
  [
    [0, 0],
    [-0.16, -0.18],
  ],
];
const UNDERSCORE = { x0: 0.04, y0: -0.2, x1: 0.2, y1: -0.16 } as const;
/** Inner margin of the front card (units). */
const CARD_PAD = 0.075;
/** Glyph bbox before the shift: x [−.1825, .20], y [−.20, .2025]. */
const GLYPH_BOX = { x0: -0.16 - GLYPH_W / 2, x1: UNDERSCORE.x1, y0: UNDERSCORE.y0, y1: 0.18 + GLYPH_W / 2 } as const;
const GLYPH_SHIFT: RPt = [-CARD_W / 2 + CARD_PAD - GLYPH_BOX.x0, CARD_H / 2 - CARD_PAD - GLYPH_BOX.y1];
/** Text lines: widths as fractions of the card width, baselines (units), dot pitch and duty. */
const LINES = {
  widths: [0.72, 0.5, 0.62],
  y: [-0.16, -0.235, -0.31],
  x0: -CARD_W / 2 + CARD_PAD,
  pitch: 0.021,
  duty: 0.5,
  sigma: 0.0035,
} as const;

/** Distance to segment ab. */
function segDist(x: number, y: number, a: RPt, b: RPt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = clamp01(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
/** Signed distance to the chevron (two round-capped strokes). */
const chevronSd = (x: number, y: number): number =>
  Math.min(segDist(x, y, CHEVRON[0][0], CHEVRON[0][1]), segDist(x, y, CHEVRON[1][0], CHEVRON[1][1])) - GLYPH_W / 2;
/** Signed distance to the underscore rect. */
function underscoreSd(x: number, y: number): number {
  const u = UNDERSCORE;
  const qx = Math.abs(x - (u.x0 + u.x1) / 2) - (u.x1 - u.x0) / 2;
  const qy = Math.abs(y - (u.y0 + u.y1) / 2) - (u.y1 - u.y0) / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

/** Edge band of the glyph strokes (units): particles within it are role edge. */
const GLYPH_EDGE_W = 0.007;

/**
 * Glyph area split, measured once on a grid: the underscore's share of the
 * "›_" (the chevron's two capsules overlap at the apex, counted once).
 */
const GLYPH_AREA = (() => {
  const n = 160;
  let chev = 0;
  let under = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = GLYPH_BOX.x0 + ((i + 0.5) / n) * (GLYPH_BOX.x1 - GLYPH_BOX.x0);
      const y = GLYPH_BOX.y0 + ((j + 0.5) / n) * (GLYPH_BOX.y1 - GLYPH_BOX.y0);
      if (underscoreSd(x, y) <= 0) under++;
      else if (chevronSd(x, y) <= 0) chev++;
    }
  }
  return { under: under / (under + chev) };
})();

/**
 * A point of the chevron (two round-capped strokes; the second stroke skips
 * the apex the first already covers), drawn from a stroke's edge band or its
 * interior — uniform within each. Parametric along a stroke, so almost
 * nothing is rejected. Returns whether the point lies on the union's edge
 * band (the apex's inner corner is interior to the union).
 */
function sampleChevron(rand: () => number, edge: boolean, out: Pt): boolean {
  const r = GLYPH_W / 2;
  for (;;) {
    const k = rand() < 0.5 ? 0 : 1;
    const [a, b] = CHEVRON[k];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const t = -r / len + rand() * (1 + (2 * r) / len);
    const side = rand() < 0.5 ? -1 : 1;
    const off = edge ? side * (r - rand() * GLYPH_EDGE_W) : (rand() * 2 - 1) * (r - GLYPH_EDGE_W);
    const x = a[0] + dx * t - (dy / len) * off;
    const y = a[1] + dy * t + (dx / len) * off;
    const sd = chevronSd(x, y);
    if (sd > 0) continue;
    if (k === 1 && segDist(x, y, CHEVRON[0][0], CHEVRON[0][1]) <= r) continue;
    out[0] = x;
    out[1] = y;
    return sd > -GLYPH_EDGE_W;
  }
}

// ---------------------------------------------------------------------------
// Composition box: the union of the cards, the stroke (± 2σ) and the head
// sparks; re-centred on the anchor.

const HEAD_SIGMA = 0.02;

/** DECK_SHIFT is added to deck units before scaling (local = (unit + shift)·s). */
export const DECK_BOX = (() => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  const p: Pt = [0, 0];
  const q: Pt = [0, 0];
  for (let k = 0; k < DECK.fan.length; k++) {
    for (let i = 0; i <= 400; i++) {
      CARD_OUTLINE.at(i / 400, p);
      toDeck(k, p[0], p[1], q);
      add(q[0], q[1]);
    }
  }
  const n: Pt = [0, 0];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const t = deckT(u);
    bez(t, p);
    bezTan(t, n);
    const w = 2 * DECK.sigma * deckTaper(u);
    add(p[0] - n[1] * w, p[1] + n[0] * w);
    add(p[0] + n[1] * w, p[1] - n[0] * w);
  }
  bez(deckT(DECK.headU), p);
  add(p[0] - 2.5 * HEAD_SIGMA, p[1] - 2.5 * HEAD_SIGMA);
  add(p[0] + 2.5 * HEAD_SIGMA, p[1] + 2.5 * HEAD_SIGMA);
  return { w: x1 - x0, h: y1 - y0, shift: [-(x0 + x1) / 2, -(y0 + y1) / 2] as RPt };
})();
export const DECK_SHIFT = DECK_BOX.shift;

// ---------------------------------------------------------------------------
// Tuning (α before density .55 × FIELD_GAIN 3; judged at 1440 × 900 High and
// 390 × 844 Low).

const SHARE = { back: 0.04, front: 0.08, glyph: 0.24, lines: 0.1, stroke: 0.36 } as const; // halo: the rest (6%)
const ALPHA = {
  front: 0.66,
  back: [0.4, 0.52] as const, // depth 2 (outermost), depth 1
  glyphEdge: 0.72,
  glyphFill: 0.6,
  caret: 0.62,
  lines: 0.5,
  stroke: 0.5,
  halo: 0.05,
} as const;
const JIT = { outline: 0.0028, glyph: 0.0015 } as const;
/** Share of the glyph particles on its edges (crisp type), the rest fill the strokes. */
const GLYPH_EDGE = 0.4;
/** Head sparks: share of S; α range. */
const HEAD_SHARE = 0.7;

export const generator: StateGenerator = {
  id: StateId.DECK,
  sort: { kind: 'shuffle' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const s = fitScale(ctx, DECK_BOX.w, DECK_BOX.h, 0.9);
    const [sx, sy] = DECK_SHIFT;
    const push = (
      list: TargetList,
      x: number,
      y: number,
      z: number,
      key: number,
      ramp: number,
      alpha: number,
      param: number,
      role: Role,
      group = 0,
    ) => list.push((x + sx) * s, (y + sy) * s, z, key, ramp, alpha, param, role, group);
    const p: Pt = [0, 0];
    const q: Pt = [0, 0];

    // Cards: back cards spend their share on the visible perimeter only.
    for (let k = 0; k < DECK.fan.length; k++) {
      const d = depth(k);
      const front = k === DECK.front;
      const n = Math.round(M * (front ? SHARE.front : SHARE.back));
      const z = -DECK.zStep * d * s;
      const ramp = front ? RAMP.signal : lerp(RAMP.steel, RAMP.signal, d === 1 ? 0.55 : 0.3);
      const alpha = front ? ALPHA.front : ALPHA.back[d === 1 ? 1 : 0];
      let tries = 0;
      for (let i = 0; i < n && tries < n * 40; tries++) {
        const u = rand();
        CARD_OUTLINE.at(u, p);
        toDeck(k, p[0] + (rand() * 2 - 1) * JIT.outline, p[1] + (rand() * 2 - 1) * JIT.outline, q);
        if (!front && occluded(k, q[0], q[1])) continue;
        push(shape, q[0], q[1], z + (rand() * 2 - 1) * 0.002 * s, 0.18 * k + 0.1 * rand(), ramp, alpha, u, Role.EDGE, k);
        i++;
      }
    }

    // "›_" 24%, area-uniform: the chevron (GLYPH_EDGE of it on its edges,
    // for crisp type) and the underscore — the caret: role blink, ember-warm.
    const nGlyph = Math.round(M * SHARE.glyph);
    const nUnder = Math.round(nGlyph * GLYPH_AREA.under);
    const nChevEdge = Math.round((nGlyph - nUnder) * GLYPH_EDGE);
    const [gx, gy] = GLYPH_SHIFT;
    const glyphKey = () => 0.4 + 0.1 * rand();
    for (let i = 0; i < nGlyph - nUnder; i++) {
      const edge = sampleChevron(rand, i < nChevEdge, p);
      const x = p[0] + gauss(rand) * JIT.glyph + gx;
      const y = p[1] + gauss(rand) * JIT.glyph + gy;
      push(shape, x, y, 0.002 * s, glyphKey(), RAMP.signal, edge ? ALPHA.glyphEdge : ALPHA.glyphFill, 0, edge ? Role.EDGE : Role.FILL, DECK.front);
    }
    const us = UNDERSCORE;
    for (let i = 0; i < nUnder; i++) {
      const x = us.x0 + rand() * (us.x1 - us.x0);
      const y = us.y0 + rand() * (us.y1 - us.y0);
      const edge = underscoreSd(x, y) > -GLYPH_EDGE_W;
      push(shape, x + gauss(rand) * JIT.glyph + gx, y + gauss(rand) * JIT.glyph + gy, 0.002 * s, glyphKey(), 0.68, ALPHA.caret * (edge ? 1 : 0.8), 0, Role.BLINK);
    }

    // Text lines 10%: dotted, set as words (gaps between runs of dots). The
    // word layout has its own seed: the same "text" on every tier.
    const nLines = Math.round(M * SHARE.lines);
    const words: [number, number][] = [];
    const wordRand = mulberry32(stateSeed(StateId.DECK) ^ 0x3057);
    for (let l = 0; l < LINES.widths.length; l++) {
      const x1 = LINES.x0 + LINES.widths[l] * CARD_W;
      let x = LINES.x0;
      while (x < x1 - 0.02) {
        const len = Math.min(x1 - x, 0.05 + 0.1 * wordRand());
        words.push([l, x], [l, x + len]);
        x += len + 0.03;
      }
    }
    let total = 0;
    for (let w = 0; w < words.length; w += 2) total += words[w + 1][1] - words[w][1];
    for (let i = 0; i < nLines; ) {
      // A point on the concatenated words, kept on the dots.
      let a = rand() * total;
      let w = 0;
      while (w < words.length - 2 && a > words[w + 1][1] - words[w][1]) {
        a -= words[w + 1][1] - words[w][1];
        w += 2;
      }
      const x = words[w][1] + a;
      if (((x - LINES.x0) / LINES.pitch) % 1 > LINES.duty) continue;
      const y = LINES.y[words[w][0]] + gauss(rand) * LINES.sigma;
      push(shape, x, y, 0.001 * s, 0.42 + 0.1 * rand(), 0.44, ALPHA.lines, 0, Role.FILL, DECK.front);
      i++;
    }

    // Art stroke 36%: stratified along u, Gaussian normal offset σ(u).
    const nStroke = Math.round(M * SHARE.stroke);
    const zStroke = -DECK.zk * s;
    const tan: Pt = [0, 0];
    for (let i = 0; i < nStroke; i++) {
      const u = (i + rand()) / nStroke;
      const t = deckT(u);
      bez(t, p);
      bezTan(t, tan);
      const g = Math.max(-2.6, Math.min(2.6, gauss(rand)));
      const nOff = g * DECK.sigma * deckTaper(u);
      const x = p[0] - tan[1] * nOff;
      const y = p[1] + tan[0] * nOff;
      shape.push((x + sx) * s, (y + sy) * s, zStroke, 0.8 + 0.2 * u, deckRamp(u), ALPHA.stroke * deckCore(u), u, Role.FLOW);
    }

    // Halo (the rest, ≈ 6%): a dim Gaussian about the composition.
    while (!shape.full) {
      shape.push(gauss(rand) * 0.42 * s, gauss(rand) * 0.33 * s, gauss(rand) * 0.12 * s, 0.5 * rand(), RAMP.steel, ALPHA.halo, 0, Role.HALO);
    }

    // Sparks: 70% the ember head (g0, at z = −zk·s like the stroke), 30% the
    // underscore (g1, blinking with the caret).
    const nHead = Math.round(spark.capacity * HEAD_SHARE);
    bez(deckT(DECK.headU), p);
    const [hx, hy] = p;
    for (let i = 0; i < nHead; i++) {
      const r = Math.abs(gauss(rand));
      const th = rand() * Math.PI * 2;
      const x = hx + Math.cos(th) * r * HEAD_SIGMA;
      const y = hy + Math.sin(th) * r * HEAD_SIGMA;
      const ramp = RAMP.ember + 0.2 * rand() ** 3;
      const a = 0.35 + 0.6 * rand() ** 2;
      spark.push((x + sx) * s, (y + sy) * s, zStroke, 0.8 + 0.05 * rand(), ramp, a, 0, Role.SPARK, 0);
    }
    const u = UNDERSCORE;
    while (!spark.full) {
      const x = u.x0 + rand() * (u.x1 - u.x0) + gx;
      const y = u.y0 + rand() * (u.y1 - u.y0) + gy;
      spark.push((x + sx) * s, (y + sy) * s, 0.003 * s, 0.45 + 0.1 * rand(), RAMP.ember, 0.45 + 0.4 * rand(), 0, Role.SPARK, 1);
    }
  },
};
