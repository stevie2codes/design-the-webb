/**
 * S0 STATIC — the cold open (SPEC §3.10): a dark volume of out-of-focus
 * noise, the hero's rest state and the intro's destination.
 *
 * Anchor: the viewport, full bleed. Positions are in su about the viewport
 * centre, so the box scales with the canvas (A = canvas aspect).
 * - 64% uniform box: x ∈ [−1.35A, 1.35A], y ∈ [−1.3, 1.3], z ∈ [−4, 1.6].
 * - 36% in 6 Gaussian clumps, centres uniform in the inner 70% of the box,
 *   σ = (.5, .32, .9).
 * - Sparks: x ∈ [−A, A], y ∈ [−.8, .8], z ∈ ±.3 — the only near-focus points.
 * - Colour: 85% p-noise at α .30–.55; 15% p-steel at α .45; sparks ember α .9.
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
const BOX_SHARE = 0.64;

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
      shape.push(x, y, z, keyOf(x), ramp, alpha, 0, Role.FILL);
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

    while (!spark.full) {
      const x = (rand() * 2 - 1) * A;
      spark.push(x, (rand() * 2 - 1) * 0.8, (rand() * 2 - 1) * 0.3, 0, RAMP.ember, 0.9, 0, Role.SPARK);
    }
  },
};
