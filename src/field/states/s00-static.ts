/**
 * S0 STATIC — the cold open (SPEC §3.10): a dark volume of out-of-focus
 * noise, the hero's rest state and the intro's destination.
 *
 * Anchor: the viewport, full bleed. Positions are in su about the viewport
 * centre, so the box scales with the canvas (A = canvas aspect).
 * - 50% uniform box (§3.10: 64%, tuned): x ∈ [−1.35A, 1.35A], y ∈ [−1.3, 1.3], z ∈ [−4, 1.6].
 * - 50% (§3.10: 36%) in 6 Gaussian clumps, centres uniform in the inner 70% of the box,
 *   σ = (.5, .32, .9).
 * - Sparks: x ∈ [−A, A], y ∈ [−.8, .8], z ∈ ±.3 — the only near-focus points.
 * - Colour: 85% p-noise at α .30–.55; 15% p-steel at α .45 (box particles
 *   × .6, tuned); sparks ember
 *   α .2–.9 (steep: a few flare; tuned from §3.10's flat .9).
 * - Live: none (drift only). Sort: 64 column bins, then y (shared with S1/S2).
 *
 * S0 is never a pair's B side on the home film (the intro plays S0 → S1 in
 * reverse, using S1's keys); its own key follows S1's formula for route use.
 */
import { StateId } from './ids.ts';
import { COLUMNS_64, RAMP, gauss, type StateGenerator } from './common.ts';
import { Role } from '../uniforms.ts';

const BOX = { x: 1.35, y: 1.3, z0: -4, z1: 1.6 } as const;
const CLUMPS = 6;
const CLUMP_SIGMA = [0.5, 0.32, 0.9] as const;
/** §3.10 says 64% box / 36% clumps; tuned toward the clumps for nebula-like depth. */
const BOX_SHARE = 0.5;
/**
 * The uniform box draws at this fraction of §3.10's α (tuning): the clumps
 * glow as nebulae in a darker volume — depth and composition instead of an
 * even carpet of grain.
 */
const BOX_DIM = 0.6;
/** Spark α: min, max, exponent of the uniform draw (tuning, CONTRACTS.md). */
const SPARK_ALPHA = [0.2, 0.9, 4] as const;

export const generator: StateGenerator = {
  id: StateId.STATIC,
  sort: COLUMNS_64,
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const A = ctx.view.A;
    const hx = BOX.x * A;
    const zMid = (BOX.z0 + BOX.z1) / 2;
    const zHalf = (BOX.z1 - BOX.z0) / 2;
    const keyOf = (x: number) => 0.15 + 0.6 * Math.min(1, Math.max(0, (x + hx) / (2 * hx))) + 0.25 * rand();

    const colour = (): [number, number] =>
      rand() < 0.85 ? [RAMP.noise, 0.3 + 0.25 * rand()] : [RAMP.steel, 0.45];

    const nBox = Math.round(shape.capacity * BOX_SHARE);
    for (let i = 0; i < nBox; i++) {
      const x = (rand() * 2 - 1) * hx;
      const y = (rand() * 2 - 1) * BOX.y;
      const z = BOX.z0 + rand() * (BOX.z1 - BOX.z0);
      const [ramp, alpha] = colour();
      shape.push(x, y, z, keyOf(x), ramp, alpha * BOX_DIM, 0, Role.FILL);
    }

    const centres: number[] = [];
    for (let c = 0; c < CLUMPS; c++) {
      centres.push((rand() * 2 - 1) * 0.7 * hx, (rand() * 2 - 1) * 0.7 * BOX.y, zMid + (rand() * 2 - 1) * 0.7 * zHalf);
    }
    for (let i = 0; !shape.full; i++) {
      const c = (i % CLUMPS) * 3;
      const x = centres[c] + gauss(rand) * CLUMP_SIGMA[0];
      const y = centres[c + 1] + gauss(rand) * CLUMP_SIGMA[1];
      const z = Math.min(BOX.z1, Math.max(BOX.z0, centres[c + 2] + gauss(rand) * CLUMP_SIGMA[2]));
      const [ramp, alpha] = colour();
      shape.push(x, y, z, keyOf(x), ramp, alpha, 0, Role.FILL);
    }

    // Sparks: α .9 per §3.10 for the brightest; tuned to a steep spread
    // (most smoulder at .2–.35, a few flare to .9) so the embers read as
    // sparse sparks in the haze rather than an even pepper.
    while (!spark.full) {
      const x = (rand() * 2 - 1) * A;
      const a = SPARK_ALPHA[0] + (SPARK_ALPHA[1] - SPARK_ALPHA[0]) * rand() ** SPARK_ALPHA[2];
      spark.push(x, (rand() * 2 - 1) * 0.8, (rand() * 2 - 1) * 0.3, 0, RAMP.ember, a, 0, Role.SPARK);
    }
  },
};
