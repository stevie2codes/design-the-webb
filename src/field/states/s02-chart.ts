/**
 * S2 CHART — the honest career chart (SPEC §3.10 S2, §5 C1, §10 the Pour).
 *
 * Anchor: the S2 box of layout.ts, which IS the chart frame: x 54 → 92vw
 * (Wf = 38vw), bottom edge = the baseline (80svh), height = the 7-year scale
 * (H = 52svh); mobile: the slot box, gutter to gutter, H = 30svh. The DOM
 * plot in chapters/CareerChart.tsx is positioned from the same variables, so
 * local su = frame units: x = (f − .5)·Wf, y = (years / 7 − .5)·H. The DOM
 * axis ticks at 0 / 2 / 4 / 6 years and the particle bar tops share one line.
 *
 * Encoding (a YEARS axis, heights to scale, the quarter-year the only unit):
 * - g0 Developer (x .16, 2 yrs): 8 quarter slabs, p-steel.
 * - g1 Product design (x .40, 4+): 16 slabs, p-signal.
 * - g2 + g3 In tech (x .64, 6+): stacked, 8 steel slabs (g2, the developer
 *   years) under 16 signal slabs (g3, the design years): 2 + 4+ = 6+.
 * - g4 AI reporting platform (x .90, at .80H): sparks only, past the divider
 *   (a count, not years).
 *
 * Shares of M: bars 76% (by area 2:4:6 → equal particles per slab; each slab
 * H/28 tall with a 0.2svh gap that stays empty; 35% of a slab on its left,
 * right and top edges at α .9, 65% stratified jittered fill at α .55; the
 * top slab of each bar at α 1.0; tuned, CONTRACTS.md: the steel slabs are
 * cooler and quieter — ramp .22, fill α .38, edges α .75 — and the 6+ bar's
 * 2-year line is a bright signal SEAM, α 1, so the stack visibly splits into
 * developer years under design years; at .55 / .9 additive steel and signal
 * came out as nearly the same grey), "+" fizz 5% (2.5% over 4.0–4.5 yrs above
 * g1, 2.5% over 6.0–6.5 yrs above g3; p-signal α .5, faded by live()),
 * baseline 4% (x 0 → .78, steel α .3), gridlines 4% (2 / 4 / 6 yrs, x 0 →
 * .78, dotted: fract(u·60) < .45; steel α .14; not drawn behind the bars),
 * divider 2% (x .80, 0 → 7 yrs, dashed: fract(v·30) < .5; steel α .2), halo
 * 9% (Gaussian σ (.22Wf, .15H) about the bars' centre of mass, truncated at
 * 2.5σ; steel α .06).
 * Sparks (g4): 60% a core disc (σ .010 su), 40% a reticle ring (r .028 su)
 * drawn as AI_SPARKS.dots (16) dots that live() spins at .3 rad/s. Their α
 * is a fixed total spread over the tier's spark count (CORE / DOT_ALPHA_SUM,
 * tuned: §3.10 gives none), so the point glows the same on every tier.
 *
 * Groups (uGroupW focus, §3.10): g0–g4 as above; the fizz belongs to the
 * design years (g1 over 4+, g3 over 6+). Structure (baseline, gridlines,
 * divider, halo) uses G_STRUCT = 7, which no stat lights: the focus writer
 * must leave uGroupW[5–7] at 1 so the axis never dims.
 *
 * Entering keys (the Pour, S .60, T .02, path POUR):
 * - Bars: the §3.9 formula `.8·hFrac + .2·bar/2` is replaced by the exact
 *   inverse of the §5 C1 numeral curve, so the numerals and the grains land
 *   in lockstep by construction: bar k's numeral shows value ×
 *   smoothstep(.55 + .1k, .95 + .05k, m), and the grain at height fraction h
 *   of bar k lands (tl = 1) at m = smoothstep⁻¹(h) mapped into that window,
 *   i.e. key = (m − (1 − S)) / S. Both keys fill bottom-first and bar by bar
 *   (left → right); this one makes "the numbers match the grains actually
 *   landing" exact. The 6+ bar's window ends at 1.05 > 1: its top ≈ 5%
 *   trickles in over the last OVERFLOW of the keys (m ≈ .97 → 1), and the
 *   numeral snaps to 6+ at m ≥ .995.
 * - Axis / gridlines / divider `.05 + .1·rand`; fizz `.85 + .15·rand`;
 *   halo `.5·rand`; sparks 1.0 (the AI point arrives last).
 *
 * Sort: 64 column bins, then y ascending (shared with S0 / S1: the Pour is
 * column-coherent). extras.uBarPivot: each bar's bottom-right corner in
 * local su (TOPPLE, §3.6).
 */
import { StateId } from './ids.ts';
import { COLUMNS_64, RAMP, clamp01, gauss, type Rand, type StateGenerator, type TargetList } from './common.ts';
import { CHART } from '../layout.ts';
import { Role, STATE_PARAMS } from '../uniforms.ts';

/** Shares of M (§3.10); the halo takes the remainder (.09). */
const SHARE = { bars: 0.76, fizz: 0.05, baseline: 0.04, grid: 0.04, divider: 0.02 } as const;
/** Share of each slab on its edges (left, right, top line). */
const EDGE_SHARE = 0.35;
const ALPHA = {
  fill: 0.55,
  edge: 0.9,
  top: 1,
  fizz: 0.5,
  baseline: 0.3,
  grid: 0.14,
  divider: 0.2,
  halo: 0.06,
} as const;
/** Slab gap: 0.2svh (§3.10). */
const GAP_SVH = 0.2;
/** Gridline dots: keep fract(u·60) < .45; divider dashes: keep fract(v·30) < .5. */
const GRID_DOTS = { n: 60, duty: 0.45 } as const;
const DIVIDER_DASHES = { n: 30, duty: 0.5 } as const;
/** Line thickness (CSS px) of the edge, axis and grid particles: ± half of it. */
const LINE_PX = 1;
/** Halo: σ in frame units (§3.10), truncated at LIM σ. */
const HALO = { sx: 0.22, sy: 0.15, lim: 2.5, sz: 0.05 } as const;

/** The AI point (sparks): core σ, reticle radius (su, §3.10); the reticle is drawn as dots. */
export const AI_SPARKS = { coreShare: 0.6, coreSigma: 0.01, ringR: 0.028, dots: 16, dotSigma: 0.0012 } as const;
/**
 * Summed α of the whole core and of one reticle dot, split over however many
 * sparks the tier has (tier-independent brightness). Tuned on screenshots.
 */
const CORE_ALPHA_SUM = 70;
const DOT_ALPHA_SUM = 3;

/** Structure group: never lit by a stat, so the axis never dims (see header). */
export const G_STRUCT = 7;

/**
 * Steel slabs (developer years, g0 / g2): cooler and darker than p-steel
 * (ramp .22: toward p-noise) and quieter (tuning, see the header).
 */
const STEEL_SLAB = { ramp: 0.22, fill: 0.38, edge: 0.75 } as const;
/** The seam: the top line of the stacked bar's steel part (the 2-year line), in signal at α 1. */
const SEAM = { ramp: RAMP.signal, alpha: 1 } as const;

/** Group colours: developer years steel, design years signal (§3.10). */
const GROUP_RAMP: Readonly<Record<number, number>> = {
  0: STEEL_SLAB.ramp,
  1: RAMP.signal,
  2: STEEL_SLAB.ramp,
  3: RAMP.signal,
};
const isSteel = (group: number): boolean => group === 0 || group === 2;

/** Stagger S of the Pour (§3.9): a grain with key κ lands (tl = 1) at m = κ·S + 1 − S. */
const POUR_S = STATE_PARAMS[StateId.CHART].enter.stagger;

/** smoothstep⁻¹ on [0, 1]: the t with 3t² − 2t³ = h. */
const smoothstepInv = (h: number): number => 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(h)) / 3);

/**
 * §5 C1 numeral window of bar k: value × smoothstep(a, b, m). Exported so
 * the count-up (CareerChart / About) and the field can never disagree.
 */
export function numeralWindow(k: number): readonly [number, number] {
  return [0.55 + 0.1 * k, 0.95 + 0.05 * k];
}

/** Displayed uMix at which the grain at height fraction h of bar k lands. */
export function landingMix(k: number, h: number): number {
  const [a, b] = numeralWindow(k);
  return a + (b - a) * smoothstepInv(h);
}

/**
 * Grains whose lockstep landing falls past m = 1 (the top ≈ 5% of the 6+
 * bar, whose numeral window ends at 1.05) land over the last OVERFLOW of the
 * key range instead: all at key 1 they would hang above the bar as one block
 * while the damped uMix closes in on 1.
 */
const OVERFLOW = 0.05;

/** Entering key of the grain at height fraction h of bar k (lands in lockstep with the numeral). */
function barKey(k: number, h: number, rand: Rand): number {
  const key = (landingMix(k, h) - (1 - POUR_S)) / POUR_S;
  return key > 1 ? 1 - OVERFLOW * rand() : clamp01(key);
}

/** Standard normal truncated at ±lim. */
export function gaussT(rand: Rand, lim: number): number {
  for (let i = 0; i < 16; i++) {
    const g = gauss(rand);
    if (g >= -lim && g <= lim) return g;
  }
  return 0;
}

const fract = (x: number): number => x - Math.floor(x);

/**
 * Stratified fill: n points (u, v) ∈ [0, 1)² from a jittered grid of about
 * n cells shaped to the region's aspect (w / h), one point anywhere in each
 * cell, in shuffled order (so any prefix is still uniform). No lattice
 * streaks, no clumps.
 */
export function jitteredGrid(n: number, aspect: number, rand: Rand): Float64Array {
  const out = new Float64Array(Math.max(0, n) * 2);
  if (n <= 0) return out;
  const nx = Math.max(1, Math.round(Math.sqrt(n * Math.max(1e-6, aspect))));
  const ny = Math.max(1, Math.ceil(n / nx));
  const total = nx * ny;
  const cells = new Uint32Array(total);
  for (let i = 0; i < total; i++) cells[i] = i;
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = cells[i];
    cells[i] = cells[j];
    cells[j] = t;
  }
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    out[2 * i] = ((c % nx) + rand()) / nx;
    out[2 * i + 1] = (Math.floor(c / nx) + rand()) / ny;
  }
  return out;
}

/** Split n into integer parts proportional to weights (largest remainder). */
export function split(n: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (sum > 0 ? (n * w) / sum : 0));
  const out = raw.map(Math.floor);
  let left = n - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let i = 0; left > 0 && i < order.length; i++, left--) out[order[i][1]]++;
  return out;
}

/** One byte of meta precision: params the shader reads back exactly. */
const q8 = (x: number): number => Math.round(clamp01(x) * 255) / 255;

interface Segment {
  readonly from: number;
  readonly to: number;
  readonly group: number;
}

interface Bar {
  readonly k: number;
  readonly x0: number;
  readonly x1: number;
  readonly years: number;
  readonly segments: readonly Segment[];
}

const BARS: readonly Bar[] = CHART.bars.map((b, k): Bar => {
  const x0 = b.xc - b.w / 2;
  const x1 = b.xc + b.w / 2;
  if ('stack' in b) {
    const [lower, upper] = b.stack;
    return {
      k,
      x0,
      x1,
      years: b.years,
      segments: [
        { from: 0, to: lower, group: b.groups[0] },
        { from: lower, to: lower + upper, group: b.groups[1] },
      ],
    };
  }
  return { k, x0, x1, years: b.years, segments: [{ from: 0, to: b.years, group: b.groups[0] }] };
});

const SLABS_TOTAL = BARS.reduce((n, b) => n + b.years * CHART.slabsPerYear, 0);

/** The halo's centre: the bars' centre of mass (frame x, years). */
const HALO_CENTRE = (() => {
  let x = 0;
  let y = 0;
  let w = 0;
  for (const b of BARS) {
    x += b.years * ((b.x0 + b.x1) / 2);
    y += b.years * (b.years / 2);
    w += b.years;
  }
  return { x: x / w, years: y / w };
})();

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf, |error| < 1.5e-7). */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/**
 * S2's column order (§3.3: 64 x bins over the targets' x extent, then y) in
 * rank-fraction space: `barAtRank(q)` is the bar (0, 1, 2) whose column the
 * target of S2 rank fraction q sits in, or −1 between / beside the bars.
 * Analytic — the x mass of every S2 part (shares × frame layout) binned like
 * the sort — so it is the same for every tier and viewport, and costs
 * nothing. S3 uses it to key its TOPPLE per source bar: rank r of S2 flows
 * into rank r of S3, and each bar can then tip over as one body.
 */
export const barAtRank: (q: number) => number = (() => {
  const BINS = COLUMNS_64.kind === 'columns' ? COLUMNS_64.bins : 64;
  const lo = HALO_CENTRE.x - HALO.lim * HALO.sx;
  const hi = HALO_CENTRE.x + HALO.lim * HALO.sx;
  const bw = (hi - lo) / BINS;
  const uniform = (a: number, b: number, u0: number, u1: number): number =>
    b > a ? Math.max(0, Math.min(b, u1) - Math.max(a, u0)) / (b - a) : 0;
  const zn = phi(HALO.lim) - phi(-HALO.lim);
  const halo = (u0: number, u1: number): number =>
    (phi(Math.max(-HALO.lim, Math.min(HALO.lim, (u1 - HALO_CENTRE.x) / HALO.sx))) -
      phi(Math.max(-HALO.lim, Math.min(HALO.lim, (u0 - HALO_CENTRE.x) / HALO.sx)))) /
    zn;
  const barShare = (b: Bar): number => (SHARE.bars * b.years) / BARS.reduce((n, c) => n + c.years, 0);
  const gridSpan = CHART.gridEnd - BARS.reduce((n, b) => n + (b.x1 - b.x0), 0);
  const haloShare = 1 - (SHARE.bars + SHARE.fizz + SHARE.baseline + SHARE.grid + SHARE.divider);
  const cdf = new Float64Array(BINS + 1);
  const bar = new Int8Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const u0 = lo + i * bw;
    const u1 = u0 + bw;
    let m = haloShare * halo(u0, u1);
    m += SHARE.baseline * uniform(0, CHART.gridEnd, u0, u1);
    let inBars = 0;
    for (const b of BARS) {
      m += barShare(b) * uniform(b.x0, b.x1, u0, u1);
      inBars += Math.max(0, Math.min(b.x1, u1) - Math.max(b.x0, u0));
    }
    for (const f of CHART.fizz) m += (SHARE.fizz / CHART.fizz.length) * uniform(BARS[f.bar].x0, BARS[f.bar].x1, u0, u1);
    const gridHere = Math.max(0, Math.min(CHART.gridEnd, u1) - Math.max(0, u0)) - inBars;
    m += gridSpan > 0 ? (SHARE.grid * Math.max(0, gridHere)) / gridSpan : 0;
    if (CHART.divider >= u0 && CHART.divider < u1) m += SHARE.divider;
    cdf[i + 1] = cdf[i] + m;
    const c = (u0 + u1) / 2;
    bar[i] = BARS.findIndex((b) => c >= b.x0 && c < b.x1);
  }
  return (q: number): number => {
    const t = clamp01(q) * cdf[BINS];
    let a = 0;
    let b = BINS - 1;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (cdf[mid + 1] <= t) a = mid + 1;
      else b = mid;
    }
    return bar[a];
  };
})();

export const generator: StateGenerator = {
  id: StateId.CHART,
  sort: COLUMNS_64,
  generate(ctx, out) {
    const { shape, spark } = out;
    const { rand } = ctx;
    const M = shape.capacity;
    const Wf = ctx.su(ctx.anchor.w);
    const H = ctx.su(ctx.anchor.h);
    const X = (f: number): number => (f - 0.5) * Wf;
    const Y = (years: number): number => (years / CHART.years - 0.5) * H;
    const gap = ctx.su((GAP_SVH / 100) * ctx.view.svh);
    const line = ctx.su(LINE_PX);
    const jit = (): number => (rand() - 0.5) * line;
    const base = Y(0);

    // --- Bars: equal particles per quarter slab (area 2:4:6). -------------
    const perSlab = split(Math.round(M * SHARE.bars), new Array<number>(SLABS_TOTAL).fill(1));
    let si = 0;
    for (const bar of BARS) {
      const barTop = Y(bar.years);
      const barH = barTop - base;
      const hOf = (y: number): number => (barH > 0 ? (y - base) / barH : 0);
      const xa = X(bar.x0);
      const xb = X(bar.x1);
      for (const seg of bar.segments) {
        const ramp = GROUP_RAMP[seg.group] ?? RAMP.signal;
        const n = Math.round((seg.to - seg.from) * CHART.slabsPerYear);
        for (let j = 0; j < n; j++) {
          const yrs0 = seg.from + j / CHART.slabsPerYear;
          const yrs1 = yrs0 + 1 / CHART.slabsPerYear;
          // The gap straddles each quarter line; the bar's base and top stay exact.
          const y0 = yrs0 <= 0 ? base : Y(yrs0) + gap / 2;
          const y1 = yrs1 >= bar.years ? barTop : Y(yrs1) - gap / 2;
          const top = yrs1 >= bar.years;
          const steel = isSteel(seg.group);
          // The stacked bar's steel part ends under the design years: its last slab's top line is the seam.
          const seam = j === n - 1 && seg.to < bar.years;
          const count = perSlab[si++];
          pushSlab(shape, rand, {
            xa,
            xb,
            y0,
            y1,
            count,
            ramp,
            group: seg.group,
            aFill: top ? ALPHA.top : steel ? STEEL_SLAB.fill : ALPHA.fill,
            aEdge: top ? ALPHA.top : steel ? STEEL_SLAB.edge : ALPHA.edge,
            ...(seam ? { topRamp: SEAM.ramp, aTop: SEAM.alpha } : {}),
            line,
            key: (y) => barKey(bar.k, hOf(y), rand),
          });
        }
      }
    }

    // --- "+" fizz: data still arriving above 4+ and 6+ (live() rises and fades it).
    const fizzN = split(Math.round(M * SHARE.fizz), CHART.fizz.map(() => 1));
    CHART.fizz.forEach((fz, i) => {
      const bar = BARS[fz.bar];
      const group = bar.segments[bar.segments.length - 1].group;
      // y = band·(n + u0) with band = H/14 (half a year) and n = 2·from − 7:
      // live() recovers the band from (y, u0, group) — see live/s02.glsl.
      const band = (H * (fz.to - fz.from)) / CHART.years;
      const nb = 2 * fz.from - CHART.years;
      const xa = X(bar.x0) + line;
      const xb = X(bar.x1) - line;
      // u0 uniform (a stationary stream: live() fades it with (1 − f)²).
      const g = jitteredGrid(fizzN[i], (xb - xa) / band, rand);
      for (let p = 0; p < fizzN[i]; p++) {
        const u0 = q8(g[2 * p + 1]);
        const x = xa + (xb - xa) * g[2 * p];
        const key = 0.85 + 0.15 * rand();
        shape.push(x, band * (nb + u0), 0, key, RAMP.signal, ALPHA.fizz, u0, Role.FLOW, group);
      }
    });

    const structKey = (): number => 0.05 + 0.1 * rand();
    const insideBar = (f: number): boolean => BARS.some((b) => f > b.x0 - 0.004 && f < b.x1 + 0.004);

    // --- Baseline: x 0 → .78.
    const nBase = Math.round(M * SHARE.baseline);
    for (let p = 0; p < nBase; p++) {
      const f = CHART.gridEnd * ((p + rand()) / nBase);
      shape.push(X(f), base + jit(), 0, structKey(), RAMP.steel, ALPHA.baseline, 0, Role.EDGE, G_STRUCT);
    }

    // --- Gridlines at 2 / 4 / 6 yrs, dotted, behind the bars (not drawn inside them).
    const gridYears = CHART.ticks.filter((t) => t > 0);
    const nGrid = Math.round(M * SHARE.grid);
    for (let p = 0, tries = 0; p < nGrid && tries < nGrid * 50; tries++) {
      const u = rand();
      if (fract(u * GRID_DOTS.n) >= GRID_DOTS.duty) continue;
      const f = u * CHART.gridEnd;
      if (insideBar(f)) continue;
      const yrs = gridYears[p % gridYears.length];
      shape.push(X(f), Y(yrs) + jit(), 0, structKey(), RAMP.steel, ALPHA.grid, 0, Role.EDGE, G_STRUCT);
      p++;
    }

    // --- Divider: dashed vertical at x .80, 0 → 7 yrs.
    const nDiv = Math.round(M * SHARE.divider);
    for (let p = 0, tries = 0; p < nDiv && tries < nDiv * 50; tries++) {
      const v = rand();
      if (fract(v * DIVIDER_DASHES.n) >= DIVIDER_DASHES.duty) continue;
      shape.push(X(CHART.divider) + jit(), Y(v * CHART.years), 0, structKey(), RAMP.steel, ALPHA.divider, 0, Role.EDGE, G_STRUCT);
      p++;
    }

    // --- Halo (the rest, ≈ 9%): about the bars' centre of mass.
    const hx = X(HALO_CENTRE.x);
    const hy = Y(HALO_CENTRE.years);
    while (!shape.full) {
      shape.push(
        hx + gaussT(rand, HALO.lim) * HALO.sx * Wf,
        hy + gaussT(rand, HALO.lim) * HALO.sy * H,
        gaussT(rand, HALO.lim) * HALO.sz,
        0.5 * rand(),
        RAMP.steel,
        ALPHA.halo,
        0,
        Role.HALO,
        G_STRUCT,
      );
    }

    // --- Sparks (g4): the AI reporting platform, past the divider.
    const ax = X(CHART.ai.xc);
    const ay = Y(CHART.ai.y * CHART.years);
    const S = spark.capacity;
    const nCore = Math.round(S * AI_SPARKS.coreShare);
    const nRing = S - nCore;
    const aCore = Math.min(1, CORE_ALPHA_SUM / Math.max(1, nCore));
    const aDot = Math.min(1, (DOT_ALPHA_SUM * AI_SPARKS.dots) / Math.max(1, nRing));
    for (let p = 0; p < nCore; p++) {
      const s = AI_SPARKS.coreSigma;
      spark.push(ax + gaussT(rand, 3) * s, ay + gaussT(rand, 3) * s, (rand() - 0.5) * 0.008, 1, RAMP.ember, aCore, 0, Role.SPARK, 4);
    }
    for (let p = 0; p < nRing; p++) {
      // The dot's angle is stored in meta.b; use the byte-exact value so
      // live() recovers the ring centre exactly.
      const th = q8((p % AI_SPARKS.dots) / AI_SPARKS.dots);
      const a = th * 2 * Math.PI;
      const s = AI_SPARKS.dotSigma;
      spark.push(
        ax + AI_SPARKS.ringR * Math.cos(a) + gaussT(rand, 2.5) * s,
        ay + AI_SPARKS.ringR * Math.sin(a) + gaussT(rand, 2.5) * s,
        0,
        1,
        RAMP.ember,
        aDot,
        th,
        Role.RING,
        4,
      );
    }

    // TOPPLE pivots: each bar's bottom-right corner, local su (§3.5 uBarPivot[3]).
    out.extras = { uBarPivot: BARS.flatMap((b) => [X(b.x1), base]) };
  },
};

interface SlabSpec {
  readonly xa: number;
  readonly xb: number;
  readonly y0: number;
  readonly y1: number;
  readonly count: number;
  readonly ramp: number;
  readonly group: number;
  readonly aFill: number;
  readonly aEdge: number;
  /** The top line's own colour / α (the stacked bar's seam); defaults to ramp / aEdge. */
  readonly topRamp?: number;
  readonly aTop?: number;
  readonly line: number;
  readonly key: (y: number) => number;
}

/**
 * One quarter-year slab: EDGE_SHARE on the left, right and top edges (by
 * length), the rest an R2-stratified, jittered fill. Every particle stays
 * inside [y0, y1]: the gaps between slabs stay empty.
 */
function pushSlab(list: TargetList, rand: Rand, s: SlabSpec): void {
  const w = s.xb - s.xa;
  const h = s.y1 - s.y0;
  if (w <= 0 || h <= 0 || s.count <= 0) return;
  const half = s.line / 2;
  const nEdge = Math.round(s.count * EDGE_SHARE);
  const nFill = s.count - nEdge;
  const [nTop, nLeft, nRight] = split(nEdge, [w, h, h]);
  const zj = (): number => (rand() - 0.5) * 0.004;
  const clampY = (y: number): number => (y < s.y0 ? s.y0 : y > s.y1 ? s.y1 : y);

  // Top line, just inside the slab so its visual edge is the value line.
  const o1 = rand();
  for (let p = 0; p < nTop; p++) {
    const x = s.xa + w * fract(o1 + (p + rand()) / nTop);
    const y = clampY(s.y1 - half - (rand() - 0.5) * half);
    list.push(x, y, zj(), s.key(y), s.topRamp ?? s.ramp, s.aTop ?? s.aEdge, 0, Role.EDGE, s.group);
  }
  // Left and right edges.
  for (const [n, x0] of [
    [nLeft, s.xa + half],
    [nRight, s.xb - half],
  ] as const) {
    const o = rand();
    for (let p = 0; p < n; p++) {
      const y = s.y0 + h * fract(o + (p + rand()) / n);
      list.push(x0 + (rand() - 0.5) * half * 2, y, zj(), s.key(y), s.ramp, s.aEdge, 0, Role.EDGE, s.group);
    }
  }
  // Fill: a jittered grid (stratified, no lattice streaks).
  const g = jitteredGrid(nFill, (w - 2 * half) / h, rand);
  for (let p = 0; p < nFill; p++) {
    const x = s.xa + half + (w - 2 * half) * g[2 * p];
    const y = s.y0 + h * g[2 * p + 1];
    list.push(x, y, zj(), s.key(y), s.ramp, s.aFill, 0, Role.FILL, s.group);
  }
}
