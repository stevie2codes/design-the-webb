/**
 * S4 PULSE — "your city's open data, one question away" (SPEC §3.10): a
 * speech bubble with a heartbeat. Project emblem, aspect-fit into the card
 * box (layout.ts: desktop card box right of centre, mobile project slot) at
 * 90% (CARD.emblemFill).
 *
 * Local box W × .64W with W = 1 unit, centred on the anchor, y up. One unit
 * is `s` su (fitScale), so the whole emblem scales with its box.
 *
 * | Component    | Share | Role  | Recipe                                                                 |
 * |--------------|-------|-------|------------------------------------------------------------------------|
 * | Outline      | 30%   | edge  | rounded rect W × .78H, r .16W, plus the tail; stratified arc length, ±.003 jitter |
 * | Fill         |  8%   | fill  | bubble interior, α .10                                                  |
 * | ECG          | 26%   | flow  | the §3.10 polyline through the bubble centre; param = arc length u     |
 * | Ghosts       | 12%   | ghost | three ECG copies (group k = 1..3) at u-offsets −.02k, α .5 / .25 / .12  |
 * | Rings        | 18%   | ring  | r .12W / .24W / .36W on the spike apex, z −.04W, p-steel α .45 (tuned)  |
 * | Halo         |  6%   | halo  | dim Gaussian about the bubble                                          |
 * | Sparks       |  S    | spark | the spike segment (ember); param = ECG u                               |
 *
 * Live (shaders/live/s04.glsl): a Gaussian highlight travels along the ECG's
 * u every PULSE.period s (signal → ember); the ghosts light a lagging
 * persistence trail behind it; the rings expand +.12W·φ and fade, where φ
 * wraps to 0 exactly when the highlight crosses the apex (the ping).
 *
 * Shader contracts (keep s04.glsl in sync with the constants below):
 * - meta.b = arc-length u ∈ [0, 1] along the ECG for flow, ghost and spark
 *   particles (8-bit, ≈ 3 px steps on a desktop card).
 * - Ghost group k ∈ {1, 2, 3} = u-offset −.02k.
 * - Ring particles sit at z = −PULSE.ringZ · s exactly (no z jitter), so
 *   live() recovers the unit length s = −z / PULSE.ringZ and, from it, the
 *   apex and the bubble — the rings expand and are clipped to the bubble
 *   interior without a per-state uniform. They are generated already
 *   clipped at their base radius (a ray from the apex leaves the convex
 *   bubble once, so a particle hidden at radius r stays hidden beyond it);
 *   every ring gets the same particle density per unit angle, so when φ
 *   wraps and each ring takes the next one's radius the hand-off is seamless.
 *
 * Sort (§3.3): component, then arc length u. Stagger key: arc length ("draws
 * like a pen", §3.9): the outline from the tail tip clockwise, the ECG left
 * to right, the rings ping out after the spike is drawn.
 *
 * Reduced-motion poster (§3.10 "highlight centred on the spike"): uTime
 * frozen at PULSE_POSTER_T — the highlight sits on the apex and the newest
 * ring has just pinged.
 */
import { StateId } from './ids.ts';
import { Polyline, RAMP, fitScale, gauss, type StateGenerator } from './common.ts';
import { Role } from '../uniforms.ts';

// ---------------------------------------------------------------------------
// Geometry (local units, W = 1, centred, y up).

/** Local box and live timing. Mirrors shaders/live/s04.glsl. */
export const PULSE = {
  /** Local box: W × .64W. */
  w: 1,
  h: 0.64,
  /** Bubble height as a share of the box height. */
  bubbleH: 0.78,
  /** Corner radius (units of W). */
  radius: 0.16,
  /** Highlight period (s). */
  period: 2.4,
  /** Highlight σ in u. */
  sigma: 0.03,
  /** The head runs from −margin to 1 + margin so it enters and leaves cleanly. */
  margin: 0.1,
  /** Ring base radii (units of W) and the per-period expansion. */
  rings: [0.12, 0.24, 0.36],
  ringGrow: 0.12,
  /** Ring depth factor: z = −ringZ · s su (≈ −.05 su on a 1440 × 900 card, §3.10). */
  ringZ: 0.04,
  /** Ghost u-offsets and α multipliers (k = 1..3). */
  ghostOffset: 0.02,
  ghostAlpha: [0.5, 0.25, 0.12],
} as const;

const TOP = PULSE.h / 2;
const BH = PULSE.bubbleH * PULSE.h;
const YB = TOP - BH;
/** Bubble centre and half-size (units of W). */
export const PULSE_BUBBLE = { cx: 0, cy: TOP - BH / 2, hx: PULSE.w / 2, hy: BH / 2, r: PULSE.radius } as const;

/** Signed distance to the bubble's rounded rect (units of W; < 0 inside). */
function bubbleSd(x: number, y: number): number {
  const b = PULSE_BUBBLE;
  const qx = Math.abs(x - b.cx) - (b.hx - b.r);
  const qy = Math.abs(y - b.cy) - (b.hy - b.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r;
}

type Pt = readonly [number, number];

function arc(out: Pt[], cx: number, cy: number, r: number, a0: number, a1: number, n = 18): void {
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

/**
 * The bubble outline with its tail as one closed path, starting at the tail
 * tip and running clockwise on screen: tail inner edge → bottom-left corner
 * → left side → top → right side → bottom → the tail's outer edge. The tail
 * runs (.18W, bottom) → (.08W, bottom − .2H) → (.34W, bottom) (§3.10).
 */
function outlinePath(): Pt[] {
  const L = -PULSE.w / 2;
  const R = PULSE.w / 2;
  const r = PULSE.radius;
  const tip: Pt = [L + 0.08, YB - 0.2 * PULSE.h];
  const p: Pt[] = [tip, [L + 0.18, YB], [L + r, YB]];
  arc(p, L + r, YB + r, r, -Math.PI / 2, -Math.PI);
  p.push([L, TOP - r]);
  arc(p, L + r, TOP - r, r, Math.PI, Math.PI / 2);
  p.push([R - r, TOP]);
  arc(p, R - r, TOP - r, r, Math.PI / 2, 0);
  p.push([R, YB + r]);
  arc(p, R - r, YB + r, r, 0, -Math.PI / 2);
  p.push([L + 0.34, YB]);
  return p;
}

/** §3.10 ECG: x in widths from the left edge, y in bubble heights about the bubble centre. */
const ECG_PTS: readonly Pt[] = [
  [0.08, 0],
  [0.34, 0],
  [0.38, 0.05],
  [0.42, -0.04],
  [0.46, 0.36],
  [0.5, -0.3],
  [0.54, 0.04],
  [0.6, 0],
  [0.92, 0],
];
const toLocal = ([x, y]: Pt): Pt => [-PULSE.w / 2 + x, PULSE_BUBBLE.cy + y * BH];
const ECG_LOCAL = ECG_PTS.map(toLocal);
/** The spike: (.42, −.04) → (.46, .36) → (.50, −.30) → (.54, .04). */
const SPIKE_FROM = 3;
const SPIKE_TO = 6;
const APEX_INDEX = 4;

const OUTLINE = new Polyline(outlinePath(), true);
const ECG = new Polyline(ECG_LOCAL);

/** Arc-length fraction of the ECG vertex i. */
const ecgU = (i: number): number => ECG.cum[i] / ECG.length;

/** The R-wave apex (units of W) and its arc-length u: where the rings are centred and ping. */
export const PULSE_APEX: Pt = ECG_LOCAL[APEX_INDEX];
export const PULSE_U_APEX = ecgU(APEX_INDEX);
/** fract(t / period) at which the highlight crosses the apex (the ring phase origin). */
export const PULSE_PHASE = (PULSE_U_APEX + PULSE.margin) / (1 + 2 * PULSE.margin);
/**
 * Reduced-motion poster (§3.10): uTime frozen with the highlight centred on
 * the spike apex (the newest ring has just pinged). ≈ 0.9819 s.
 */
export const PULSE_POSTER_T = PULSE.period * PULSE_PHASE;

// ---------------------------------------------------------------------------
// Tuning (α before density .55 × FIELD_GAIN 3; judged on 1440 × 900 High /
// Mid and 390 × 844 Low). §3.10 gives only the fill (.10) and ring (.35)
// alphas; the rings run at .45 because live() fades each one as it expands
// (×1 at birth → 0 at .48W), which left the outer two invisible at .35.

const SHARE = { outline: 0.3, fill: 0.08, ecg: 0.26, ghosts: 0.12, rings: 0.18 } as const; // halo: the rest (6%)
const ALPHA = { outline: 0.5, fill: 0.1, ecg: 0.62, ring: 0.45, halo: 0.06, spark: 0.6 } as const;
/** Jitter (units of W): outline ±.003 (§3.10); the ECG a touch finer so the trace reads crisp. */
const JIT = { outline: 0.003, ecg: 0.0022, ghost: 0.0035, ring: 0.0025, spark: 0.004 } as const;
/** Sort components (§3.3: component, then u). */
const COMP = { outline: 0, fill: 1, ecg: 2, ghost: 3, ring: 4, halo: 5 } as const;

const sortKey = (comp: number, u: number): number => comp + Math.min(Math.max(u, 0), 1) * 0.999;
const ecgKey = (u: number): number => 0.12 + 0.8 * u;

/** Normal of the ECG at arc fraction u (for perpendicular jitter). */
function ecgNormal(u: number, out: [number, number]): [number, number] {
  const a: [number, number] = [0, 0];
  const b: [number, number] = [0, 0];
  ECG.at(Math.max(0, u - 0.002), a);
  ECG.at(Math.min(1, u + 0.002), b);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  out[0] = -dy / l;
  out[1] = dx / l;
  return out;
}

export const generator: StateGenerator = {
  id: StateId.PULSE,
  sort: { kind: 'custom' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const s = fitScale(ctx, PULSE.w, PULSE.h, 0.9);
    const p: [number, number] = [0, 0];
    const nrm: [number, number] = [0, 0];

    // Outline 30%: stratified arc length from the tail tip, ±.003 jitter.
    const nOut = Math.round(M * SHARE.outline);
    for (let i = 0; i < nOut; i++) {
      const u = (i + rand()) / nOut;
      OUTLINE.at(u, p);
      const x = (p[0] + (rand() * 2 - 1) * JIT.outline) * s;
      const y = (p[1] + (rand() * 2 - 1) * JIT.outline) * s;
      shape.push(x, y, (rand() * 2 - 1) * 0.004, 0.7 * u, RAMP.signal, ALPHA.outline, u, Role.EDGE, 0, sortKey(COMP.outline, u));
    }

    // Interior fill 8%: uniform inside the bubble (inset), α .10.
    const nFill = Math.round(M * SHARE.fill);
    const b = PULSE_BUBBLE;
    for (let i = 0; i < nFill; ) {
      const x = b.cx + (rand() * 2 - 1) * b.hx;
      const y = b.cy + (rand() * 2 - 1) * b.hy;
      if (bubbleSd(x, y) > -0.012) continue;
      const u = (x + b.hx) / (2 * b.hx);
      shape.push(x * s, y * s, (rand() * 2 - 1) * 0.01, 0.2 + 0.5 * rand(), RAMP.signal, ALPHA.fill, 0, Role.FILL, 0, sortKey(COMP.fill, u));
      i++;
    }

    // ECG 26%: stratified along u with a Gaussian perpendicular cross-section.
    const nEcg = Math.round(M * SHARE.ecg);
    for (let i = 0; i < nEcg; i++) {
      const u = (i + rand()) / nEcg;
      ECG.at(u, p);
      ecgNormal(u, nrm);
      const j = gauss(rand) * JIT.ecg;
      const x = (p[0] + nrm[0] * j) * s;
      const y = (p[1] + nrm[1] * j) * s;
      shape.push(x, y, (rand() * 2 - 1) * 0.003, ecgKey(u), RAMP.signal, ALPHA.ecg, u, Role.FLOW, 0, sortKey(COMP.ecg, u));
    }

    // Persistence ghosts 12%: three copies, each a little wider (the trail
    // diffuses as it ages). Coincident with the trace; live() lights them
    // only in the highlight's wake.
    const nGhost = Math.round((M * SHARE.ghosts) / 3);
    for (let k = 1; k <= 3; k++) {
      const a = ALPHA.ecg * PULSE.ghostAlpha[k - 1];
      for (let i = 0; i < nGhost; i++) {
        const u = (i + rand()) / nGhost;
        ECG.at(u, p);
        ecgNormal(u, nrm);
        const j = gauss(rand) * JIT.ghost * (0.6 + 0.6 * k);
        const x = (p[0] + nrm[0] * j) * s;
        const y = (p[1] + nrm[1] * j) * s;
        const key = Math.min(1, ecgKey(u) + PULSE.ghostOffset * k);
        shape.push(x, y, -0.004 * k, key, RAMP.signal, a, u, Role.GHOST, k, sortKey(COMP.ghost, u));
      }
    }

    // Rings 18%: equal density per unit angle on every ring (the φ wrap
    // hands each ring's radius to the next), rejected outside the bubble at
    // the base radius. z carries the unit length (see the header).
    const nRing = Math.round(M * SHARE.rings);
    const [ax, ay] = PULSE_APEX;
    const zRing = -PULSE.ringZ * s;
    for (let i = 0; i < nRing; ) {
      const k = Math.floor(rand() * 3);
      const th = rand() * Math.PI * 2;
      const r = PULSE.rings[k] + gauss(rand) * JIT.ring;
      const x = ax + r * Math.cos(th);
      const y = ay + r * Math.sin(th);
      if (bubbleSd(x, y) > -0.01) continue;
      const u = th / (Math.PI * 2);
      const key = 0.5 + 0.14 * k + 0.08 * rand();
      shape.push(x * s, y * s, zRing, key, RAMP.steel, ALPHA.ring, u, Role.RING, k, sortKey(COMP.ring, (k + u) / 3));
      i++;
    }

    // Halo (the rest, ≈ 6%): a dim Gaussian about the bubble, kept low so it
    // stays inside the card box and off the text column.
    while (!shape.full) {
      const x = b.cx + gauss(rand) * 0.3;
      const y = b.cy - 0.03 + gauss(rand) * 0.17;
      const u = Math.atan2(y - b.cy, x - b.cx) / (Math.PI * 2) + 0.5;
      shape.push(x * s, y * s, gauss(rand) * 0.12, 0.5 * rand(), RAMP.steel, ALPHA.halo, 0, Role.HALO, 0, sortKey(COMP.halo, u));
    }

    // Sparks: the spike segment, stratified along u, ember.
    const u0 = ecgU(SPIKE_FROM);
    const u1 = ecgU(SPIKE_TO);
    const nSpark = spark.capacity;
    for (let i = 0; i < nSpark; i++) {
      const u = u0 + ((i + rand()) / nSpark) * (u1 - u0);
      ECG.at(u, p);
      ecgNormal(u, nrm);
      const j = gauss(rand) * JIT.spark;
      const a = ALPHA.spark * (0.55 + 0.45 * rand());
      spark.push((p[0] + nrm[0] * j) * s, (p[1] + nrm[1] * j) * s, 0.006, ecgKey(u), RAMP.ember, a, u, Role.SPARK, 0, u);
    }
  },
};

