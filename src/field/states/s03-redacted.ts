/**
 * S3 REDACTED — NDA (SPEC §3.10 S3, §5 C2): the chart's bars topple into
 * nine redaction bars with a lock cut out of one — an honest picture of work
 * that can't be shown.
 *
 * Anchor: the S3 box of layout.ts (desktop x 54 → 92vw, 42.5svh tall,
 * centred in the NDA section; mobile the slot block, gutter to gutter,
 * heights ×.7). The spec's su measures describe a .85 su block (= 42.5svh on
 * a desktop canvas); they are scaled by k = box height / .85 su, so the
 * slabs register with the DOM stand-in (chapters/Nda.tsx, which draws the
 * same geometry as fractions of the box) on every canvas and on mobile.
 *
 * Recipe (block units, top → bottom):
 * - 9 left-aligned slabs, widths × block [.92, .78, .96, .54, .88, .71, .93,
 *   .40, .66], .05 tall with .045 gaps; slab 2 (index 1, as in the DOM
 *   stand-in) is .09 tall with a lock-shaped negative space centred at 26% of
 *   its width: body a rounded rect .042 × .036 (1.5px corners) whose top is
 *   .035 below the slab top, shackle the upper half-annulus r .010–.016 on the
 *   body's top edge.
 * - Slabs 88%, weighted so an EDGE_PX band along every slab edge and around
 *   the lock is 30% denser; halo 12% (Gaussian about the block, steel α .06).
 * - Colour p-signal α .42 (bone-grey slabs).
 * - Sparks: 60% trace the lock outline (body + both shackle arcs), 40% an
 *   ember keyline .03 left of the block, full block height.
 *
 * meta.b = row fraction (0 top → 1 bottom of the block): the live scan band
 * and the uCharge dim wipe (live/s03.glsl). Roles: slab grains FILL (the
 * denser edge band included), keyline EDGE, lock outline SPARK, halo HALO.
 * Group G_STRUCT (7) throughout: S3 has no focus groups and must not dim
 * with a stale S2 focus. (TOPPLE reads its pivots from S2's groups, the A
 * side.)
 *
 * Entering (TOPPLE, S .45, T .06): per source bar (bar 0, then 1, then 2),
 * else `.85·row/8 + .15·rand` (§3.9 `.7·row/8 + .3·rand`; see KEY).
 * Sort: row top → bottom, then x ascending (custom): the leftmost S2 columns
 * become the top rows, so the bars fall to the right like dominoes.
 */
import { StateId } from './ids.ts';
import { RAMP, argsort, clamp01, type StateGenerator } from './common.ts';
import { Role } from '../uniforms.ts';
import { G_STRUCT, barAtRank, gaussT, jitteredGrid, split } from './s02-chart.ts';

/** Block geometry in spec su (§3.10); scaled by k = box height / BLOCK_H. */
export const REDACT = {
  widths: [0.92, 0.78, 0.96, 0.54, 0.88, 0.71, 0.93, 0.4, 0.66],
  slabH: 0.05,
  lockSlab: 1,
  lockSlabH: 0.09,
  gap: 0.045,
  lock: {
    /** Centre x as a fraction of the lock slab's width. */
    at: 0.26,
    /** Body: width × height, its top this far below the slab top. */
    bodyW: 0.042,
    bodyH: 0.036,
    bodyTop: 0.035,
    /** Corner radius in CSS px. */
    cornerPx: 1.5,
    shackleR: 0.016,
    shackleIn: 0.01,
  },
  /** Keyline: this far left of the block. */
  keyline: 0.03,
} as const;

const ROWS = REDACT.widths.length;
const BLOCK_H = (ROWS - 1) * (REDACT.slabH + REDACT.gap) + REDACT.lockSlabH;

const SLAB_SHARE = 0.88;
/**
 * Entering keys (§3.9: `.7·row/8 + .3·rand`, top row first). Tuned for the
 * TOPPLE: a grain's key is chosen by the S2 bar it comes from (rank r of S2
 * flows into rank r of S3; s02-chart.ts barAtRank maps a rank to its bar
 * column), BAR[k] + BAR_RAND·rand, so each bar leaves as one body and tips
 * over about its pivot — the dominoes fall left → right, and their rows
 * (bar 0 → the top rows, bar 2 → the bottom rows) still print top to bottom.
 * Grains from outside the bars (halo, the axis between them) keep the row
 * formula, with a smaller random share (.15 instead of .3) for the same
 * reason.
 */
// barRand .015 (tuned at integration, was .06): the TOPPLE tips each bar
// rigidly; a wider spread fanned the falling bar into a cloud.
const KEY = { row: 0.85, rand: 0.15, bar: [0, 0.45, 0.9], barRand: 0.015 } as const;
const ALPHA = { slab: 0.42, halo: 0.06 } as const;
/** Edge band width (CSS px) and its density gain (§3.10 "edges get 30% extra density"). */
const EDGE_PX = 1.5;
const EDGE_GAIN = 1.3;
/** Negative-space margin (CSS px): grains keep clear of the lock by this much. */
const LOCK_CLEAR_PX = 0.6;
/** Halo σ as fractions of the block, truncated at 2.5σ. */
const HALO = { sx: 0.28, sy: 0.32, sz: 0.05, lim: 2.5 } as const;
/** Sparks: share on the lock outline; summed α per CSS px of line (tier-independent). */
const SPARK_LOCK_SHARE = 0.6;
const LOCK_ALPHA_PER_PX = 0.9;
const KEYLINE_ALPHA_PER_PX = 0.55;

const fract = (x: number): number => x - Math.floor(x);

interface Slab {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export const generator: StateGenerator = {
  id: StateId.REDACTED,
  sort: { kind: 'custom' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const bw = ctx.su(ctx.anchor.w);
    const bh = ctx.su(ctx.anchor.h);
    const k = bh / BLOCK_H;
    const px = ctx.su(1);
    const left = -bw / 2;
    const top = bh / 2;

    const slabs: Slab[] = REDACT.widths.map((w, i) => {
      const t = i * (REDACT.slabH + REDACT.gap) + (i > REDACT.lockSlab ? REDACT.lockSlabH - REDACT.slabH : 0);
      const h = i === REDACT.lockSlab ? REDACT.lockSlabH : REDACT.slabH;
      return { x0: left, x1: left + w * bw, y1: top - k * t, y0: top - k * (t + h) };
    });

    // Lock (in slab index 1): body centre / half size, shackle centre and radii.
    const L = REDACT.lock;
    const ls = slabs[REDACT.lockSlab];
    const lx = ls.x0 + L.at * (ls.x1 - ls.x0);
    const sy = ls.y1 - k * L.bodyTop; // shackle centre = the body's top edge
    const bhx = (k * L.bodyW) / 2;
    const bhy = (k * L.bodyH) / 2;
    const by = sy - bhy;
    const rr = Math.min(L.cornerPx * px, bhx, bhy);
    const ro = k * L.shackleR;
    const ri = k * L.shackleIn;
    /** Signed distance to the lock's negative space (< 0 inside). */
    const sdLock = (x: number, y: number): number => {
      const qx = Math.abs(x - lx) - (bhx - rr);
      const qy = Math.abs(y - by) - (bhy - rr);
      const body = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
      let shackle: number;
      if (y >= sy) shackle = Math.abs(Math.hypot(x - lx, y - sy) - (ro + ri) / 2) - (ro - ri) / 2;
      else {
        const ax = Math.abs(x - lx);
        const dx = ax < ri ? ri - ax : ax > ro ? ax - ro : 0;
        shackle = Math.hypot(dx, sy - y);
      }
      return Math.min(body, shackle);
    };

    const rowFrac = (y: number): number => clamp01((top - y) / bh);
    const rowOf = (y: number): number => {
      // Nearest slab by vertical distance (for the halo).
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < ROWS; i++) {
        const s = slabs[i];
        const d = y > s.y1 ? y - s.y1 : y < s.y0 ? s.y0 - y : 0;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };
    const sortKey = (row: number, x: number): number => row + 0.999 * clamp01((x - left) / bw);
    const enterKey = (row: number): number => (KEY.row * row) / (ROWS - 1) + KEY.rand * rand();

    // --- Slabs: counts by edge-weighted area.
    const e = EDGE_PX * px;
    const lockArea = 4 * bhx * bhy + (Math.PI * (ro * ro - ri * ri)) / 2;
    const weights = slabs.map((s, i) => {
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      const inner = Math.max(0, w - 2 * e) * Math.max(0, h - 2 * e);
      const area = w * h - (i === REDACT.lockSlab ? lockArea : 0);
      return inner / EDGE_GAIN + (area - inner);
    });
    const counts = split(Math.round(shape.capacity * SLAB_SHARE), weights);
    const clear = LOCK_CLEAR_PX * px;
    slabs.forEach((s, i) => {
      const n = counts[i];
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      const hasLock = i === REDACT.lockSlab;
      // Candidates from a jittered grid (shuffled), thinned by the edge weight
      // and the lock; uniform random candidates top up if it runs short.
      const g = jitteredGrid(Math.ceil(n * EDGE_GAIN * 1.15) + 8, w / h, rand);
      const nc = g.length / 2;
      for (let p = 0, j = 0; p < n && j < nc + n * 40; j++) {
        const x = s.x0 + w * (j < nc ? g[2 * j] : rand());
        const y = s.y0 + h * (j < nc ? g[2 * j + 1] : rand());
        const dl = hasLock ? sdLock(x, y) : Infinity;
        if (dl < clear) continue;
        const nearEdge = x - s.x0 < e || s.x1 - x < e || y - s.y0 < e || s.y1 - y < e || dl < clear + e;
        if (!nearEdge && rand() * EDGE_GAIN > 1) continue;
        shape.push(x, y, (rand() - 0.5) * 0.004, enterKey(i), RAMP.signal, ALPHA.slab, rowFrac(y), Role.FILL, G_STRUCT, sortKey(i, x));
        p++;
      }
    });

    // --- Halo (the rest, ≈ 12%): about the block.
    while (!shape.full) {
      const x = gaussT(rand, HALO.lim) * HALO.sx * bw;
      const y = gaussT(rand, HALO.lim) * HALO.sy * bh;
      const row = rowOf(y);
      shape.push(
        x,
        y,
        gaussT(rand, HALO.lim) * HALO.sz,
        enterKey(row),
        RAMP.steel,
        ALPHA.halo,
        rowFrac(y),
        Role.HALO,
        G_STRUCT,
        sortKey(row, x),
      );
    }

    // --- TOPPLE keys per source bar (see KEY): S3 rank r receives S2 rank r.
    const order = argsort(shape.sort, shape.count);
    for (let r = 0; r < shape.count; r++) {
      const bar = barAtRank((r + 0.5) / shape.count);
      if (bar >= 0) shape.pos[order[r] * 4 + 3] = Math.min(1, KEY.bar[bar] + KEY.barRand * rand());
    }

    // --- Sparks: the lock outline (body + outer and inner shackle arcs) and the keyline.
    const S = spark.capacity;
    const nLock = Math.round(S * SPARK_LOCK_SHARE);
    const nKey = S - nLock;
    const bodyLen = 4 * (bhx - rr) + 4 * (bhy - rr) + 2 * Math.PI * rr;
    const lens = [bodyLen, Math.PI * ro, Math.PI * ri];
    const lockLen = lens[0] + lens[1] + lens[2];
    const aLock = Math.min(1, (LOCK_ALPHA_PER_PX * (lockLen / px)) / Math.max(1, nLock));
    const pt: [number, number] = [0, 0];
    const lj = 0.35 * px;
    for (let p = 0; p < nLock; p++) {
      let s = lockLen * fract((p + rand()) / nLock);
      if (s < lens[0]) roundRectAt(s, lx, by, bhx, bhy, rr, pt);
      else {
        s -= lens[0];
        const outer = s < lens[1];
        const r = outer ? ro : ri;
        const a = Math.PI * (outer ? s / lens[1] : (s - lens[1]) / lens[2]);
        pt[0] = lx + r * Math.cos(a);
        pt[1] = sy + r * Math.sin(a);
      }
      const x = pt[0] + (rand() - 0.5) * lj;
      const y = pt[1] + (rand() - 0.5) * lj;
      spark.push(x, y, 0, enterKey(REDACT.lockSlab), RAMP.ember, aLock, rowFrac(y), Role.SPARK, G_STRUCT, rowFrac(y));
    }
    const kx = left - k * REDACT.keyline;
    const aKey = Math.min(1, (KEYLINE_ALPHA_PER_PX * (bh / px)) / Math.max(1, nKey));
    for (let p = 0; p < nKey; p++) {
      const y = top - bh * ((p + rand()) / nKey);
      spark.push(kx + (rand() - 0.5) * lj, y, 0, enterKey(rowOf(y)), RAMP.ember, aKey, rowFrac(y), Role.EDGE, G_STRUCT, rowFrac(y));
    }
  },
};

/** Point at arc length s along a rounded rect's perimeter (centre cx, cy; half sizes hx, hy; radius r). */
function roundRectAt(
  s: number,
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  r: number,
  out: [number, number],
): [number, number] {
  const ex = 2 * (hx - r);
  const ey = 2 * (hy - r);
  const arc = (Math.PI / 2) * r;
  // Top edge (left → right), corner, right edge (down), corner, bottom (right → left), corner, left (up), corner.
  const parts = [ex, arc, ey, arc, ex, arc, ey, arc];
  let i = 0;
  while (i < parts.length - 1 && s > parts[i]) s -= parts[i++];
  const t = parts[i] > 0 ? s / parts[i] : 0;
  const ix = hx - r;
  const iy = hy - r;
  const corner = (ccx: number, ccy: number, a0: number) => {
    const a = a0 - t * (Math.PI / 2);
    out[0] = cx + ccx + r * Math.cos(a);
    out[1] = cy + ccy + r * Math.sin(a);
  };
  switch (i) {
    case 0:
      out[0] = cx - ix + t * ex;
      out[1] = cy + hy;
      break;
    case 1:
      corner(ix, iy, Math.PI / 2);
      break;
    case 2:
      out[0] = cx + hx;
      out[1] = cy + iy - t * ey;
      break;
    case 3:
      corner(ix, -iy, 0);
      break;
    case 4:
      out[0] = cx + ix - t * ex;
      out[1] = cy - hy;
      break;
    case 5:
      corner(-ix, -iy, -Math.PI / 2);
      break;
    case 6:
      out[0] = cx - hx;
      out[1] = cy - iy + t * ey;
      break;
    default:
      corner(-ix, iy, Math.PI);
      break;
  }
  return out;
}
