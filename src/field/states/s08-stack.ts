/**
 * S8 STACK — What I do (SPEC §3.10 S8, §5 C4): four isometric plates, one
 * per capability. Anchor: the S8 box of layout.ts — desktop 36vw × 64svh
 * centred at (70vw, 54svh); mobile the capabilities slot box, 84vw × 40svh.
 * The stack is sized like the DOM stand-in in chapters/Capabilities.tsx:
 * s = min(boxW, boxH) / STACK_FIT (drawn true-isometric the plates span
 * ≈ 1.05s, and the pulled drawer needs room).
 *
 * Plates: rounded rects in the XZ plane, W .9s × D .6s, radius .06s, at
 * y = +.27s, +.09s, −.09s, −.27s; the group is rotated 45° about Y, then
 * 35.264° about X (true isometric; the same projection as the stand-in's
 * iso()). Depth is then flattened ×Z_FLAT: under the perspective camera the
 * full ±.6s depth would magnify the near corner by ≈ 19% and break the
 * isometric read; ×.3 keeps a little parallax and depth of field.
 *
 * Each plate takes 25% of M (group g = plate index, top first):
 * - Perimeter 40%: the rounded outline (stratified arc length, ±.004s), plus
 *   a dimmer copy .022s below it (PERIM.under of the perimeter) so each plate
 *   reads as a thin slab rather than a wire.
 * - Motif 60% (plate-local a along x, b = −z toward the plate's far edge,
 *   h up off the plate):
 *   - g0 Product Design: a header strip (fill + outline), two content blocks
 *     (one filled like an image), three text lines broken into words.
 *   - g1 Data Visualization: the 7-point polyline [.2, .45, .35, .7, .55, .85,
 *     .75] standing off the plate by value × .08s along a fence across the
 *     plate's middle, with dotted stems, a faint area curtain, its baseline
 *     and two dotted floor gridlines.
 *   - g2 Design Systems: a 6 × 4 grid of rounded squares; tile (2, 1) filled.
 *   - g3 Prototyping: three screen nodes (with header rules), two arrows
 *     (a straight one and an elbow), and a pointer glyph clicking node 3.
 * - Sparks (ember): 40% on the filled tile, 40% on the 7 chart markers, 20%
 *   on the cursor tip (each in its plate's group, so they travel with it).
 *
 * Live (shaders/live/s08.glsl): the active plate (uGroupW 1, weighted by
 * uFocusOn) lifts +.06s along its local y and slides +.08s along its local x
 * — a drawer pulled out; inactive plates turn p-steel. The shader already
 * applies α ×mix(.35, 1, w), +1.2 CoC for unfocused plates and the 70% ember
 * mix of the focused one (field.vert.glsl, K_STACK).
 *
 * Shader contracts (keep s08.glsl in sync):
 * - meta.b = s / STACK_S_UNIT for every particle (8-bit: ±.0025 su): the
 *   drawer offsets are fractions of s, and s changes with the viewport.
 * - Group = plate index 0–3 (the §5 C4 row index): the focus writer lights
 *   plate k with uGroupW[k] = 1, the others 0, and uFocusOn = 1 while C4
 *   is active; neutral (focus off) is uGroupW = 1, uFocusOn = 0.
 * - Z_FLAT and the rotation are baked into STACK_EX / STACK_EY in s08.glsl.
 *
 * Sort (§3.3): polar angle about the centre (spiral coherence with S7 → S8
 * → S9). Entering key (§3.9): .2·plate + .2·arc, top plate first, each
 * plate drawn along its perimeter / left → right across its motif.
 *
 * Reduced motion: S8 has no time-driven live motion (only the focus), so
 * POSTER_TIME[STACK] stays 0.
 */
import { StateId } from './ids.ts';
import { Polyline, RAMP, gauss, type Rand, type StateGenerator, type TargetList } from './common.ts';
import { STACK_FIT } from '../layout.ts';
import { Role } from '../uniforms.ts';

type Pt = readonly [number, number];

/** Plate geometry in units of s (§3.10). */
export const PLATE = { w: 0.9, d: 0.6, r: 0.06 } as const;
export const PLATE_Y = [0.27, 0.09, -0.09, -0.27] as const;
/** Drawer pull of the active plate (units of s, §3.10). Mirrors s08.glsl. */
export const DRAWER = { slide: 0.08, lift: 0.06 } as const;
/** Depth flattening after the isometric rotation (see the file comment). Mirrors s08.glsl. */
export const Z_FLAT = 0.3;
/** meta.b = s / STACK_S_UNIT (s ≤ ≈ 1.12 su on every layout). Mirrors s08.glsl. */
export const STACK_S_UNIT = 1.25;
/** Chart values and their stand-off (units of s, §3.10). */
export const CHART_VALUES = [0.2, 0.45, 0.35, 0.7, 0.55, 0.85, 0.75] as const;
const CHART_RISE = 0.08;

/** Perimeter: the top outline and the dimmer slab edge beneath it. */
const PERIM = { under: 0.22, thickness: 0.022, jitter: 0.004 } as const;

/**
 * α before density (.5) × FIELD_GAIN (3), tuned on 1440 × 900 High and
 * 390 × 844 Low (§3.10 gives none): lines read as fine light, fills as tint.
 */
export const STACK_ALPHA = {
  perimeter: 0.42,
  under: 0.16,
  stroke: 0.4,
  text: 0.38,
  fill: 0.1,
  tile: 0.28,
  chart: 0.42,
  stem: 0.2,
  curtain: 0.08,
  floor: 0.16,
  cursor: 0.46,
  spark: 0.7,
  sparkTile: 0.45,
} as const;

/** Ramp of the filled tile (warmer than bone: the selected token). */
const TILE_RAMP = 0.6;
/** Motif stroke jitter (units of s). */
const JIT = 0.0035;

const SQ = Math.SQRT1_2;
const COS_X = 0.816496580927726;
const SIN_X = 0.5773502691896258;

type V3 = [number, number, number];

/** Rotate 45° about Y, then 35.264° about X, then flatten depth ×Z_FLAT. */
function iso(x: number, y: number, z: number, out: V3): V3 {
  const x1 = (x + z) * SQ;
  const z1 = (z - x) * SQ;
  out[0] = x1;
  out[1] = y * COS_X - z1 * SIN_X;
  out[2] = (y * SIN_X + z1 * COS_X) * Z_FLAT;
  return out;
}

function arc(out: Pt[], cx: number, cy: number, r: number, a0: number, a1: number, n = 8): void {
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

/** Closed rounded rect (a0, b0)–(a1, b1), radius r, counter-clockwise from the bottom-left corner. */
function roundRect(a0: number, b0: number, a1: number, b1: number, r: number): Polyline {
  const p: Pt[] = [];
  arc(p, a0 + r, b0 + r, r, Math.PI, 1.5 * Math.PI);
  arc(p, a1 - r, b0 + r, r, 1.5 * Math.PI, 2 * Math.PI);
  arc(p, a1 - r, b1 - r, r, 0, 0.5 * Math.PI);
  arc(p, a0 + r, b1 - r, r, 0.5 * Math.PI, Math.PI);
  return new Polyline(p, true);
}

const seg = (a0: number, b0: number, a1: number, b1: number): Polyline =>
  new Polyline([
    [a0, b0],
    [a1, b1],
  ]);

/** An arrow: the shaft through `pts`, a head of two strokes at the last point. */
function arrow(pts: Pt[], head = 0.03, spread = 0.5): Polyline[] {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const l = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dx = (x1 - x0) / l;
  const dy = (y1 - y0) / l;
  const c = Math.cos(spread);
  const s = Math.sin(spread);
  const wing = (sg: number): Polyline =>
    seg(x1, y1, x1 - head * (dx * c - sg * dy * s), y1 - head * (dy * c + sg * dx * s));
  return [new Polyline(pts), wing(1), wing(-1)];
}

/** Emits one plate-local point (a, b, h) with its look; `arc` ∈ [0, 1] feeds the entering key. */
type Emit = (a: number, b: number, h: number, alpha: number, ramp: number, role: Role, arc: number) => void;

/** n particles along `paths` (split by length), stratified, jittered in the plate plane. */
function strokes(emit: Emit, rand: Rand, paths: readonly Polyline[], n: number, alpha: number, ramp: number = RAMP.signal, role: Role = Role.EDGE): void {
  const total = paths.reduce((s, p) => s + p.length, 0) || 1;
  const pt: [number, number] = [0, 0];
  let done = 0;
  paths.forEach((path, k) => {
    const m = k === paths.length - 1 ? n - done : Math.round((n * path.length) / total);
    for (let i = 0; i < m; i++) {
      path.at((i + rand()) / m, pt);
      const a = pt[0] + gauss(rand) * JIT;
      emit(a, pt[1] + gauss(rand) * JIT, 0, alpha, ramp, role, (a + PLATE.w / 2) / PLATE.w);
    }
    done += m;
  });
}

/** n particles stratified over the rect (a0, b0)–(a1, b1), rounded by r. */
function fill(emit: Emit, rand: Rand, a0: number, b0: number, a1: number, b1: number, n: number, alpha: number, ramp: number = RAMP.signal, r = 0): void {
  const w = a1 - a0;
  const h = b1 - b0;
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const outside = (a: number, b: number): boolean => {
    const qa = Math.max(0, Math.abs(a - (a0 + a1) / 2) - (w / 2 - r));
    const qb = Math.max(0, Math.abs(b - (b0 + b1) / 2) - (h / 2 - r));
    return r > 0 && qa * qa + qb * qb > r * r;
  };
  for (let i = 0; i < n; i++) {
    let a = a0 + (((i % cols) + rand()) / cols) * w;
    let b = b0 + ((Math.floor(i / cols) % rows) + rand()) / rows * h;
    // Keep the rounded corners empty: a sample outside them is redrawn anywhere.
    while (outside(a, b)) {
      a = a0 + rand() * w;
      b = b0 + rand() * h;
    }
    emit(a, b, 0, alpha, ramp, Role.FILL, (a + PLATE.w / 2) / PLATE.w);
  }
}

// ---------------------------------------------------------------------------
// Motifs (plate-local units of s: a ∈ [−.45, .45], b ∈ [−.3, .3]).

/** g0 Product Design: header strip, two content blocks, three text lines. */
function motifDesign(emit: Emit, rand: Rand, n: number): void {
  const A = STACK_ALPHA;
  const header = [-0.39, 0.155, 0.39, 0.235] as const;
  fill(emit, rand, header[0], header[1], header[2], header[3], Math.round(n * 0.2), A.fill * 2.2, RAMP.signal, 0.02);
  strokes(emit, rand, [roundRect(header[0], header[1], header[2], header[3], 0.02)], Math.round(n * 0.1), A.stroke);
  const blocks = [roundRect(-0.39, -0.035, -0.025, 0.115, 0.02), roundRect(0.025, -0.035, 0.39, 0.115, 0.02)];
  strokes(emit, rand, blocks, Math.round(n * 0.22), A.stroke);
  fill(emit, rand, -0.39, -0.035, -0.025, 0.115, Math.round(n * 0.08), A.fill * 1.4, RAMP.signal, 0.02);
  // Text: words (widths in s) separated by .018 gaps.
  const lines: Array<[number, number[]]> = [
    [-0.095, [0.12, 0.08, 0.16, 0.1, 0.14, 0.09]],
    [-0.155, [0.1, 0.15, 0.07, 0.17]],
    [-0.215, [0.14, 0.09, 0.12, 0.1, 0.15]],
  ];
  const words: Polyline[] = [];
  for (const [b, widths] of lines) {
    let a = -0.39;
    for (const w of widths) {
      words.push(seg(a, b, a + w, b));
      a += w + 0.018;
    }
  }
  const used = Math.round(n * 0.2) + Math.round(n * 0.1) + Math.round(n * 0.22) + Math.round(n * 0.08);
  strokes(emit, rand, words, n - used, A.text);
}

/** g1 Data Visualization: the standing polyline, stems, curtain, baseline, floor grid. */
function motifChart(emit: Emit, rand: Rand, n: number, markers: Pt[]): void {
  const A = STACK_ALPHA;
  const pts: Pt[] = CHART_VALUES.map((v, i) => [-0.36 + 0.12 * i, v * CHART_RISE]);
  for (const p of pts) markers.push(p);
  const line = new Polyline(pts);
  const hAt = (a: number): number => {
    const i = Math.min(pts.length - 2, Math.max(0, Math.floor((a + 0.36) / 0.12)));
    const t = (a - pts[i][0]) / 0.12;
    return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
  };
  const arcOf = (a: number) => (a + PLATE.w / 2) / PLATE.w;
  const pt: [number, number] = [0, 0];

  // The polyline (42%): in the fence plane b = 0, h = value × .08s.
  const nLine = Math.round(n * 0.42);
  for (let i = 0; i < nLine; i++) {
    line.at((i + rand()) / nLine, pt);
    emit(pt[0] + gauss(rand) * JIT * 0.6, gauss(rand) * JIT * 0.6, pt[1] + gauss(rand) * JIT * 0.6, A.chart, RAMP.signal, Role.EDGE, arcOf(pt[0]));
  }
  // Stems (10%): dotted drops from each vertex to the plate.
  const nStem = Math.round(n * 0.1);
  for (let i = 0; i < nStem; i++) {
    const [a, h] = pts[i % pts.length];
    const f = rand();
    const q = Math.floor(f * 7) / 7 + 0.03 * rand();
    emit(a + gauss(rand) * JIT * 0.4, gauss(rand) * JIT * 0.4, h * q, A.stem, RAMP.signal, Role.FILL, arcOf(a));
  }
  // Curtain (20%): a faint area fill under the line, denser toward the line.
  const nCurtain = Math.round(n * 0.2);
  for (let i = 0; i < nCurtain; i++) {
    const a = -0.36 + ((i + rand()) / nCurtain) * 0.72;
    const h = hAt(a) * Math.sqrt(rand());
    emit(a, gauss(rand) * JIT * 0.5, h, A.curtain, RAMP.signal, Role.FILL, arcOf(a));
  }
  // Baseline (12%) under the fence, and two dotted floor gridlines (the rest).
  const nBase = Math.round(n * 0.12);
  strokes(emit, rand, [seg(-0.39, 0, 0.39, 0)], nBase, A.stroke * 0.9);
  const nFloor = n - nLine - nStem - nCurtain - nBase;
  for (let i = 0; i < nFloor; i++) {
    const b = i % 2 === 0 ? 0.15 : -0.15;
    let a: number;
    do a = -0.39 + rand() * 0.78;
    while ((((a + 0.39) * 40) % 1) > 0.42);
    emit(a, b + gauss(rand) * JIT * 0.5, 0, A.floor, RAMP.signal, Role.FILL, arcOf(a));
  }
}

/** Design-system grid: 6 × 4 rounded squares. */
const TILE = { side: 0.1, r: 0.022, pa: 0.128, pb: 0.124, cols: 6, rows: 4, filled: [2, 1] as const } as const;
const tileBox = (col: number, row: number): [number, number, number, number] => {
  const a0 = -0.37 + col * TILE.pa;
  const b1 = 0.236 - row * TILE.pb;
  return [a0, b1 - TILE.side, a0 + TILE.side, b1];
};

/** g2 Design Systems: 24 tile outlines, tile (2, 1) filled. */
function motifSystem(emit: Emit, rand: Rand, n: number): void {
  const tiles: Polyline[] = [];
  for (let r = 0; r < TILE.rows; r++) {
    for (let c = 0; c < TILE.cols; c++) {
      const [a0, b0, a1, b1] = tileBox(c, r);
      tiles.push(roundRect(a0, b0, a1, b1, TILE.r));
    }
  }
  const nOut = Math.round(n * 0.78);
  strokes(emit, rand, tiles, nOut, STACK_ALPHA.stroke);
  const [a0, b0, a1, b1] = tileBox(TILE.filled[0], TILE.filled[1]);
  fill(emit, rand, a0, b0, a1, b1, n - nOut, STACK_ALPHA.tile, TILE_RAMP, TILE.r);
}

/** Prototype flow: three screen nodes, two arrows, a pointer clicking node 3. */
const NODE = { w: 0.18, h: 0.13, r: 0.022 } as const;
const NODES: readonly Pt[] = [
  [-0.27, 0.11],
  [0.0, 0.11],
  [0.26, -0.07],
];
/** The pointer glyph (tip first), relative to its tip; b down is negative. */
const CURSOR: readonly Pt[] = [
  [0, 0],
  [0, -0.105],
  [0.027, -0.08],
  [0.048, -0.124],
  [0.064, -0.116],
  [0.043, -0.073],
  [0.077, -0.073],
];
const CURSOR_TIP: Pt = [0.3, -0.112];

/** g3 Prototyping. */
function motifPrototype(emit: Emit, rand: Rand, n: number): void {
  const A = STACK_ALPHA;
  const boxes = NODES.map(([a, b]) => roundRect(a - NODE.w / 2, b - NODE.h / 2, a + NODE.w / 2, b + NODE.h / 2, NODE.r));
  const nNodes = Math.round(n * 0.36);
  strokes(emit, rand, boxes, nNodes, A.stroke);
  // Header rules inside each node.
  const rules = NODES.map(([a, b]) => seg(a - NODE.w / 2 + 0.025, b + NODE.h / 2 - 0.032, a + NODE.w / 2 - 0.025, b + NODE.h / 2 - 0.032));
  const nRules = Math.round(n * 0.12);
  strokes(emit, rand, rules, nRules, A.text);
  // Arrows: node 1 → node 2 (straight), node 2 → node 3 (elbow).
  const [n1, n2, n3] = NODES;
  const arrows = [
    ...arrow([
      [n1[0] + NODE.w / 2 + 0.012, n1[1]],
      [n2[0] - NODE.w / 2 - 0.012, n2[1]],
    ]),
    ...arrow([
      [n2[0], n2[1] - NODE.h / 2 - 0.012],
      [n2[0], n3[1]],
      [n3[0] - NODE.w / 2 - 0.012, n3[1]],
    ]),
  ];
  const nArrows = Math.round(n * 0.24);
  strokes(emit, rand, arrows, nArrows, A.stroke);
  // The active screen (node 2) is tinted.
  const nFill = Math.round(n * 0.08);
  fill(emit, rand, n2[0] - NODE.w / 2, n2[1] - NODE.h / 2, n2[0] + NODE.w / 2, n2[1] + NODE.h / 2, nFill, A.fill, RAMP.signal, NODE.r);
  // The pointer, clicking node 3.
  const glyph = new Polyline(
    CURSOR.map(([a, b]) => [CURSOR_TIP[0] + a, CURSOR_TIP[1] + b] as const),
    true,
  );
  strokes(emit, rand, [glyph], n - nNodes - nRules - nArrows - nFill, A.cursor);
}

// ---------------------------------------------------------------------------

export const generator: StateGenerator = {
  id: StateId.STACK,
  sort: { kind: 'polar', cx: 0, cy: 0 },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const s = ctx.su(Math.min(ctx.anchor.w, ctx.anchor.h) / STACK_FIT);
    const param = Math.min(1, s / STACK_S_UNIT);
    const v: V3 = [0, 0, 0];

    const pushTo =
      (list: TargetList, g: number): Emit =>
      (a, b, h, alpha, ramp, role, arcU) => {
        iso(a * s, (PLATE_Y[g] + h) * s, -b * s, v);
        list.push(v[0], v[1], v[2], 0.2 * g + 0.2 * Math.min(1, Math.max(0, arcU)), ramp, alpha, param, role, g);
      };

    const markers: Pt[] = [];
    const perimeter = roundRect(-PLATE.w / 2, -PLATE.d / 2, PLATE.w / 2, PLATE.d / 2, PLATE.r);
    const pt: [number, number] = [0, 0];
    const perPlate = Math.floor(M / 4);

    for (let g = 0; g < 4; g++) {
      const emit = pushTo(shape, g);
      const nPlate = g === 3 ? M - 3 * perPlate : perPlate;
      const nPerim = Math.round(nPlate * 0.4);
      const nUnder = Math.round(nPerim * PERIM.under);
      // Perimeter 40%: the outline, stratified by arc length, and the slab edge beneath it.
      for (let i = 0; i < nPerim; i++) {
        const under = i < nUnder;
        const m = under ? nUnder : nPerim - nUnder;
        const k = under ? i : i - nUnder;
        const u = (k + rand()) / m;
        perimeter.at(u, pt);
        const j = PERIM.jitter;
        const h = under ? -PERIM.thickness : 0;
        iso((pt[0] + gauss(rand) * j) * s, (PLATE_Y[g] + h + gauss(rand) * j * 0.5) * s, -(pt[1] + gauss(rand) * j) * s, v);
        const alpha = under ? STACK_ALPHA.under : STACK_ALPHA.perimeter;
        shape.push(v[0], v[1], v[2], 0.2 * g + 0.2 * u, RAMP.signal, alpha, param, Role.EDGE, g);
      }
      // Motif 60%.
      const nMotif = nPlate - nPerim;
      if (g === 0) motifDesign(emit, rand, nMotif);
      else if (g === 1) motifChart(emit, rand, nMotif, markers);
      else if (g === 2) motifSystem(emit, rand, nMotif);
      else motifPrototype(emit, rand, nMotif);
    }

    // Sparks: 40% the filled tile (g2), 40% the 7 chart markers (g1), 20% the cursor tip (g3).
    const S = spark.capacity;
    const nTile = Math.round(S * 0.4);
    const nMark = Math.round(S * 0.4);
    const tileEmit = pushTo(spark, 2);
    const [ta0, tb0, ta1, tb1] = tileBox(TILE.filled[0], TILE.filled[1]);
    for (let i = 0; i < nTile; i++) {
      const a = ta0 + 0.012 + rand() * (ta1 - ta0 - 0.024);
      const b = tb0 + 0.012 + rand() * (tb1 - tb0 - 0.024);
      tileEmit(a, b, 0.004, STACK_ALPHA.sparkTile * (0.5 + 0.5 * rand()), RAMP.ember, Role.SPARK, (a + PLATE.w / 2) / PLATE.w);
    }
    const markEmit = pushTo(spark, 1);
    for (let i = 0; i < nMark; i++) {
      const [a, h] = markers[i % markers.length];
      markEmit(a + gauss(rand) * 0.006, gauss(rand) * 0.006, h + gauss(rand) * 0.006, STACK_ALPHA.spark, RAMP.ember, Role.SPARK, (a + PLATE.w / 2) / PLATE.w);
    }
    const tipEmit = pushTo(spark, 3);
    while (!spark.full) {
      const a = CURSOR_TIP[0] + gauss(rand) * 0.006;
      tipEmit(a, CURSOR_TIP[1] + gauss(rand) * 0.006, 0.003, STACK_ALPHA.spark, RAMP.ember, Role.SPARK, (a + PLATE.w / 2) / PLATE.w);
    }
  },
};
