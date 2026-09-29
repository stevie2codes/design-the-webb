/**
 * S5 CIVIC LATTICE — Gov Data Generator: a civic building made of records
 * (SPEC §3.10). Project emblem, aspect-fit into the card box (layout.ts:
 * desktop card box left of centre, mobile project slot) at 90%.
 *
 * Geometry, built procedurally with point-in-shape tests (no canvas) in a
 * 640 × 520 unit space, y up, symmetric about x = 320, the building (452
 * units tall) centred (base at y = 34):
 * - 3 steps: 600 / 558 / 516 wide × 16 each;
 * - 6 columns 26 × 150, each with a 34 × 8 capital, centres 90 / 180 / 270 /
 *   370 / 460 / 550 (between lattice nodes, so every shaft is exactly 2
 *   nodes wide and its capital 4: the 92-unit spacing of the DOM outline
 *   would alias to 2- and 3-node shafts; the central bay is 100 wide);
 * - entablature 560 × 22; pediment: a triangle, base 560, height 64;
 * - drum 220 × 40 (seated 20 units into the pediment's apex); dome: a
 *   half-ellipse 220 × 110; lantern 24 × 30.
 *
 * Lattice: a strict 10-unit grid of nodes at (10i + 5, 10j + 5), 64 × 52:
 * 1,056 nodes inside the building (§3.10 estimates ≈ 1,900; its parts
 * cover ≈ 1,100 cells) on rows 3–48 of 52.
 * Lattice particles (90% of M) are dealt round-robin across the nodes; the
 * duplicates of a node stack backward in z at .018 su steps, 8 layers (a
 * node's 9th+ particles reuse its layers: 1–4 per layer depending on the
 * tier, α divided by that count so every tier prints equally bright).
 * Layers with z < −.05 (layers 3–7) are p-steel, the rest p-signal. The
 * write-head registers a printed node's stack onto its line of sight
 * (live), so printed records are crisp dots and unprinted ones keep the
 * stack's perspective spread.
 * Halo 10%. Sparks: every node, row-tagged; live() shows the write-head
 * row's only.
 *
 * Shader contract (shaders/live/s05.glsl): meta.b = row / 51 for every
 * lattice particle and spark (8-bit exact: byte = 5·row); row 0 is the
 * bottom row. The halo carries row 0 and is left alone by live().
 *
 * Live, the write-head: the head sweeps rows bottom → top in LATTICE.sweep s,
 * then holds LATTICE.hold s (fully printed; the last LATTICE.reset s dissolve
 * the print back to "not yet" before the next sweep). Rows below the head:
 * printed, crisp (the stack registered, drawn ×1.35); the head row: ember,
 * +80% brightness, sparks; rows above: dim (×.5, §3.10 says α .22 of .85 —
 * tuned, the spread stack is thin) with ±.01 su jitter ("not yet
 * generated"). Under the C3 curtain the records grow ×1.5 and gain ×1.9 α.
 *
 * DOM sync: `latticeRow(t)` below is the CPU twin of the shader's head (same
 * formula, same clock) for the aria-hidden "ROWS nn/52" counter.
 *
 * Sort (§3.3): row bottom → top, then x. Stagger key (§3.9): .75·row/rows +
 * .25·rand, bottom first; the DIGITIZE path quantises the flight (§3.6).
 *
 * Reduced-motion poster (§3.10 "fully printed"): uTime frozen at
 * LATTICE_POSTER_T, inside the hold.
 */
import { StateId } from './ids.ts';
import { RAMP, fitScale, gauss, type StateGenerator } from './common.ts';
import { Role } from '../uniforms.ts';

// ---------------------------------------------------------------------------
// Write-head timing: shared with shaders/live/s05.glsl and the DOM counter.

export const LATTICE = {
  /** Unit space. */
  w: 640,
  h: 520,
  /** Lattice pitch (units). */
  cell: 10,
  /** Rows of the lattice (the counter's denominator). */
  rows: 52,
  /** z layers and their step (su). */
  layers: 8,
  zStep: 0.018,
  /** Write-head sweep and hold (s). */
  sweep: 3.2,
  hold: 0.8,
  /** The hold's last `reset` s dissolve the print back to "not yet" (inside the hold). */
  reset: 0.3,
} as const;

/** Loop period: sweep + hold (4 s). */
export const LATTICE_PERIOD = LATTICE.sweep + LATTICE.hold;

/**
 * Printed rows at clock `t` (s): the write-head row index, 0–52. It counts
 * the rows below the head: 0 when the head is on the bottom row, 52 through
 * the hold (fully printed). Same formula as `latticeHead()` in
 * shaders/live/s05.glsl, so the DOM counter and the field agree.
 *
 * For the "ROWS nn/52" counter (content/site.ts `rowsCounter(row)`), sample
 * at ≤ 30 Hz and write through a ref:
 *
 *   rowsEl.textContent = sideProjects.rowsCounter(latticeRow(frame.now));
 *
 * `t` must be the field's live clock: `frame.now` (gsap.ticker.time), which
 * the engine writes to uTimeA / uTimeB in full motion. Under reduced motion
 * the shader is frozen at LATTICE_POSTER_T, so show
 * `latticeRow(LATTICE_POSTER_T)` (= 52) once, with no sampling.
 */
export function latticeRow(t: number): number {
  const tau = t - LATTICE_PERIOD * Math.floor(t / LATTICE_PERIOD);
  return tau < LATTICE.sweep ? Math.min(LATTICE.rows, Math.floor((tau / LATTICE.sweep) * LATTICE.rows)) : LATTICE.rows;
}

/** Reduced-motion poster (§3.10 "fully printed"): mid-hold, before the reset fade. */
export const LATTICE_POSTER_T = 3.5;

// ---------------------------------------------------------------------------
// Building (units, y up).

const AXIS = 320;
/**
 * Base of the building (units): (520 − 452) / 2, centred. It also puts the
 * row centres at h ≡ 1 (mod 10) above the base, which keeps every element on
 * whole lattice rows: the 8-unit capitals get their row, the steps read
 * 2 / 2 / 1, the shafts 15.
 */
const BASE = 34;
const COLUMNS = [90, 180, 270, 370, 460, 550] as const;
/**
 * The drum rises from behind the pediment, seated 20 units into its apex
 * (§3.10 lists sizes, not the stacking): stacked on the apex point, the
 * pediment's sub-cell tip leaves an empty lattice row and a narrow neck, and
 * the dome floats above the portico.
 */
const DRUM_SEAT = 20;
const DRUM = 292 - DRUM_SEAT;
const DOME = DRUM + 40;
const LANTERN = DOME + 110;
/** Building height (units): 452. */
export const LATTICE_BUILDING_H = LANTERN + 30;

/** Point-in-building test (units, y up): a union of the §3.10 parts. */
export function inBuilding(x: number, y: number): boolean {
  const dx = Math.abs(x - AXIS);
  const h = y - BASE;
  if (h < 0 || h >= LATTICE_BUILDING_H) return false;
  if (h < 16) return dx <= 300; // step 1: 600 × 16
  if (h < 32) return dx <= 279; // step 2: 558 × 16
  if (h < 48) return dx <= 258; // step 3: 516 × 16
  if (h < 198) return COLUMNS.some((c) => Math.abs(x - c) <= 13); // shafts 26 × 150
  if (h < 206) return COLUMNS.some((c) => Math.abs(x - c) <= 17); // capitals 34 × 8
  if (h < 228) return dx <= 280; // entablature 560 × 22
  if (h < 292 && dx <= 280 * (1 - (h - 228) / 64)) return true; // pediment: base 560, height 64
  if (h >= DRUM && h < DOME) return dx <= 110; // drum 220 × 40
  if (h >= DOME && h < LANTERN) return dx * dx + (h - DOME) * (h - DOME) <= 110 * 110; // dome 220 × 110
  if (h >= LANTERN) return dx <= 12; // lantern 24 × 30
  return false;
}

export interface LatticeNode {
  readonly x: number;
  readonly y: number;
  readonly row: number;
}

/** Lattice nodes inside the building, row-major bottom → top, then x. */
function buildNodes(): LatticeNode[] {
  const out: LatticeNode[] = [];
  const { cell, rows, w } = LATTICE;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < w / cell; i++) {
      const x = cell * i + cell / 2;
      const y = cell * j + cell / 2;
      if (inBuilding(x, y)) out.push({ x, y, row: j });
    }
  }
  return out;
}

/**
 * The lattice nodes (1,056), built on first use: the DOM counter imports
 * `latticeRow` from this module on the main thread, so nothing here runs at
 * import time.
 */
let nodeCache: LatticeNode[] | null = null;
export function latticeNodes(): readonly LatticeNode[] {
  if (!nodeCache) nodeCache = buildNodes();
  return nodeCache;
}

// ---------------------------------------------------------------------------
// Tuning (α before density .55 × FIELD_GAIN 3).

const LATTICE_SHARE = 0.9;
/**
 * α per z layer (front → back), divided by the tier's duplicates per layer.
 * §3.10's "α .85" is one particle per record; here a printed node is its
 * whole registered stack (8+ particles on one screen point), so the α is
 * spread over the layers: the p-signal front (layers 0–2) carries most of
 * it, the p-steel back (3–7) a cool fringe (tuned; judged at 1440 × 900 Mid
 * and 390 × 844 Low).
 */
const LAYER_ALPHA = [0.85, 0.6, 0.42, 0.26, 0.2, 0.16, 0.12, 0.09] as const;
const HALO_ALPHA = 0.06;
const SPARK_ALPHA = 0.8;

export const generator: StateGenerator = {
  id: StateId.LATTICE,
  sort: { kind: 'custom' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const { w, h, rows, layers, zStep } = LATTICE;
    const s = fitScale(ctx, w, h, 0.9);
    const lx = (x: number) => (x - w / 2) * s;
    const ly = (y: number) => (y - h / 2) * s;
    const rowParam = (row: number) => row / (rows - 1);
    const sortOf = (row: number, x: number) => row + Math.min(Math.max(x / w, 0), 1) * 0.999;
    const keyOf = (row: number) => 0.75 * (row / (rows - 1)) + 0.25 * rand();

    // Lattice 90%: round-robin over the nodes; layer = deal round mod 8.
    const NODES = latticeNodes();
    const n = NODES.length;
    const total = Math.round(shape.capacity * LATTICE_SHARE);
    const perLayer = Math.max(1, total / (n * layers));
    for (let i = 0; i < total; i++) {
      const node = NODES[i % n];
      const layer = Math.floor(i / n) % layers;
      const z = -layer * zStep;
      const back = z < -0.05;
      const a = LAYER_ALPHA[layer] / perLayer;
      shape.push(
        lx(node.x),
        ly(node.y),
        z,
        keyOf(node.row),
        back ? RAMP.steel : RAMP.signal,
        a,
        rowParam(node.row),
        Role.FILL,
        0,
        sortOf(node.row, node.x),
      );
    }

    // Halo 10%: a dim Gaussian about the building (row by height, for the sort).
    const cy = BASE + LATTICE_BUILDING_H * 0.42;
    while (!shape.full) {
      const x = w / 2 + gauss(rand) * 150;
      const y = cy + gauss(rand) * 105;
      const row = Math.min(rows - 1, Math.max(0, Math.floor(y / LATTICE.cell)));
      shape.push(lx(x), ly(y), gauss(rand) * 0.12, keyOf(row), RAMP.steel, HALO_ALPHA, 0, Role.HALO, 0, sortOf(row, x));
    }

    // Sparks: dealt over the nodes (a spread of ≈ 1.4 / node on High, .4 on
    // Low), a hair in front of the lattice; live() lights the head row's.
    while (!spark.full) {
      const node = NODES[Math.floor(rand() * n)];
      const x = node.x + (rand() * 2 - 1) * 1.5;
      const y = node.y + (rand() * 2 - 1) * 1.5;
      const a = SPARK_ALPHA * (0.6 + 0.4 * rand());
      spark.push(lx(x), ly(y), 0.01, keyOf(node.row), RAMP.ember, a, rowParam(node.row), Role.SPARK, 0, sortOf(node.row, x));
    }
  },
};
