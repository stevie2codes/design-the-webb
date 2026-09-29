/**
 * S10 FLATLINE — the 404 (SPEC §3.10 S10, §6 404): a lost signal, a flat
 * trace that sharpens as you head home. Generated lazily, only when the 404
 * route's frame first needs it (engine requestLazy; director route mode shows
 * { a: FLATLINE, b: FLATLINE }).
 *
 * Anchor: the S10 box of layout.ts (viewport frame) — desktop a line from 8vw
 * to 92vw at 68svh; mobile gutter to gutter at 70svh. Local su about the
 * line's centre, x along it (L = the box width), y up.
 *
 * | Element  | Share | Role  | Recipe                                                          |
 * |----------|-------|-------|-----------------------------------------------------------------|
 * | Line     | 70%   | flow  | x stratified along L, y σ .003 su; p-signal, tapered at both ends |
 * | Ghosts   | 12%   | ghost | three copies (group 4 + k, k = 1..3), wider, α .5 / .25 / .12 (×2, tuned) |
 * | Halo     | 18%   | halo  | p-steel band, σ .05 su across the line                          |
 * | Sparks   |  S    | spark | the scan head: an ember core + a comet tail (live() sweeps it)  |
 *
 * Depth: the page's resting aperture is .5 (§3.9: the lost signal is out of
 * focus; the CTA's hover racks it to .04), so the line and halo carry a z
 * spread (σ DEPTH) for the circle of confusion to act on. The positions are
 * written FLAT (screen-registered); live() divides each particle's anchored
 * position by its perspective, so depth blurs the line without spreading it
 * (and a Canvas2D fallback can draw these positions as they are).
 *
 * Live (shaders/live/s10.glsl): the line is flat. `uBeat` (0 → 1 → 0,
 * 600 ms) fires one heartbeat, centred on screen: y += uBeat·.14·ECG(x), the
 * §3.10 sum of five Gaussians with its R wave at the line's centre; heat rises
 * to ember where abs(ECG) > .5. The ghosts echo it at lower amplitudes and,
 * between beats, glow as the phosphor trail behind the scan head, which
 * crosses the line every 3.2 s (brightening the trace as it passes).
 *
 * Shader contracts (keep s10.glsl in sync):
 * - meta.b = ln(L / L_MIN) / ln(L_MAX / L_MIN) for every particle (8-bit,
 *   ±.7% of L — a uniform scale error, so the trace never steps): live()
 *   recovers the line length to place the ECG and the head.
 * - Ghost group = 4 + k. Line, halo and sparks use group 7. Groups ≥ 5 are
 *   never lit or dimmed by a focus writer (S2: 0–4, S8: 0–3).
 * - Sparks sit about the line's centre (x = offset from the head); live()
 *   moves them to the head.
 *
 * Sort (§3.3): x. Entering key: left → right (the trace is drawn in like a
 * monitor coming on); halo .5·rand; sparks 1 (the head starts last).
 *
 * Reduced-motion poster (§3.10 "flat"): uBeat is 0 (no heartbeat fires under
 * reduced motion) and uTime is frozen at FLAT_POSTER_T, with the scan head at
 * FLAT_POSTER_HEAD of the line and its trail behind it.
 */
import { StateId } from './ids.ts';
import { RAMP, gauss, type StateGenerator } from './common.ts';
import { TIERS } from '../tiers.ts';
import { Role } from '../uniforms.ts';

/** Geometry and live constants (su unless noted). Mirrors shaders/live/s10.glsl. */
export const FLAT = {
  /** Line length encoding range (su), log scale. */
  lMin: 0.25,
  lMax: 8,
  /** Perpendicular σ of the line (§3.10) and of the halo band. */
  sigma: 0.003,
  haloSigma: 0.05,
  /** Scan head: period (s) and the margin (line fractions) it enters and leaves by. */
  period: 3.2,
  margin: 0.06,
  /** Heartbeat amplitude (§3.10) and where the R wave sits (line fraction: centred). */
  amp: 0.14,
  rAt: 0.5,
} as const;

/** Depth spread of the line / halo (su, clamped at ±DEPTH_MAX): what aperture .5 blurs. */
const DEPTH = 0.6;
const DEPTH_MAX = 1.0;
const HALO_DEPTH = 0.4;

/** Shares of M (§3.10); the halo takes the rest (18%). */
const SHARE = { line: 0.7, ghosts: 0.12 } as const;
/** Ghost k = 1..3: particle split, α (§3.10 gives the copies .5 / .25 / .12) and width. */
const GHOSTS = [
  { share: 0.45, alpha: 0.5, width: 1.9 },
  { share: 0.33, alpha: 0.25, width: 2.8 },
  { share: 0.22, alpha: 0.12, width: 3.8 },
] as const;

/**
 * α before density (.5) × FIELD_GAIN (3) (§3.10 gives none for the line).
 * The line and its ghosts are one-dimensional and additive, so their look is
 * set by the light per CSS px of line: FLAT_ALPHA.line is tuned at the
 * reference (High, 1440 × 900: ≈ 23 particles per px, High point sizes) and
 * lineAlphaK() rescales it for the tier's count per px and point area, so
 * Mid desktops, phones and narrow windows draw the same line.
 */
export const FLAT_ALPHA = { line: 0.12, ghost: 2, halo: 0.1, spark: 0.4 } as const;
const REF_PER_PX = 23.3;

/** Mean drawn point area of a tier relative to High (§3.2 sizes, aSeed.x² → E = 1/3). */
function tierArea(N: number): number {
  const mean = (t: { sizeMin: number; sizeMax: number }) => t.sizeMin + (t.sizeMax - t.sizeMin) / 3;
  const t = Object.values(TIERS).find((x) => x.N === N) ?? TIERS.high;
  return (mean(t) / mean(TIERS.high)) ** 2;
}

/** Line α scale for `perPx` line particles per CSS px on a tier with N particles (clamped ×.4–2). */
const lineAlphaK = (perPx: number, N: number): number =>
  Math.min(2, Math.max(0.4, REF_PER_PX / Math.max(1, perPx) / tierArea(N)));
const GHOST_RAMP = 0.58;
/** Line ends fade over this share of the line. */
const TAPER = 0.07;

export const G_FLAT = 7;

/** Scan head sparks: the core's share, and the comet tail's mean length (su). */
const HEAD = { core: 0.35, tail: 0.035 } as const;

/** Reduced-motion poster: the scan head at this fraction of the line. */
export const FLAT_POSTER_HEAD = 0.72;
/** uTime for FLAT_POSTER_HEAD (≈ 2.229 s). */
export const FLAT_POSTER_T = (FLAT.period * (FLAT_POSTER_HEAD + FLAT.margin)) / (1 + 2 * FLAT.margin);

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const taper = (xf: number): number => smooth(0, TAPER, xf) * smooth(1, 1 - TAPER, xf);

export const generator: StateGenerator = {
  id: StateId.FLATLINE,
  sort: { kind: 'x' },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const L = ctx.su(ctx.anchor.w > 0 ? ctx.anchor.w : 0.84 * ctx.view.W);
    const param = Math.min(1, Math.max(0, Math.log(L / FLAT.lMin) / Math.log(FLAT.lMax / FLAT.lMin)));
    const depth = (sigma: number) => Math.max(-DEPTH_MAX, Math.min(DEPTH_MAX, gauss(rand) * sigma));

    // Line 70%.
    const nLine = Math.round(M * SHARE.line);
    const k = lineAlphaK(nLine / Math.max(1, L / ctx.su(1)), ctx.layout.N);
    for (let i = 0; i < nLine; i++) {
      const xf = (i + rand()) / nLine;
      const key = 0.05 + 0.85 * xf + 0.1 * rand();
      shape.push((xf - 0.5) * L, gauss(rand) * FLAT.sigma, depth(DEPTH), key, RAMP.signal, FLAT_ALPHA.line * k * taper(xf), param, Role.FLOW, G_FLAT);
    }

    // Ghosts 12%: three copies, wider and dimmer (group 4 + k).
    const nGhosts = Math.round(M * SHARE.ghosts);
    let done = 0;
    GHOSTS.forEach((g, gi) => {
      const n = gi === GHOSTS.length - 1 ? nGhosts - done : Math.round(nGhosts * g.share);
      for (let i = 0; i < n; i++) {
        const xf = (i + rand()) / n;
        const key = 0.05 + 0.85 * xf + 0.1 * rand();
        const a = FLAT_ALPHA.ghost * g.alpha * k * taper(xf);
        shape.push((xf - 0.5) * L, gauss(rand) * FLAT.sigma * g.width, depth(DEPTH), key, GHOST_RAMP, a, param, Role.GHOST, 4 + gi + 1);
      }
      done += n;
    });

    // Halo band 18% (the rest): p-steel, σ .05 su across, a little past the ends.
    while (!shape.full) {
      const xf = -0.03 + rand() * 1.06;
      const a = FLAT_ALPHA.halo * smooth(-0.03, 0.12, xf) * smooth(1.03, 0.88, xf);
      shape.push((xf - 0.5) * L, gauss(rand) * FLAT.haloSigma, depth(HALO_DEPTH), 0.5 * rand(), RAMP.steel, a, param, Role.HALO, G_FLAT);
    }

    // Sparks: the scan head about the centre (live() moves it along the
    // line): a hot core (HEAD.core of them) and a comet tail trailing to the
    // left, fading with distance, so the sweep reads as motion even in a still.
    while (!spark.full) {
      if (rand() < HEAD.core) {
        const a = FLAT_ALPHA.spark * (0.4 + 0.6 * rand());
        spark.push(gauss(rand) * 0.004, gauss(rand) * 0.003, gauss(rand) * 0.01, 1, rand() < 0.3 ? 0.9 : RAMP.ember, a, param, Role.SPARK, G_FLAT);
      } else {
        const d = -Math.log(Math.max(1e-6, rand())) * HEAD.tail;
        const a = FLAT_ALPHA.spark * 0.7 * Math.exp(-d / HEAD.tail) * (0.4 + 0.6 * rand());
        spark.push(-d, gauss(rand) * FLAT.sigma, gauss(rand) * 0.01, 1, RAMP.ember, a, param, Role.SPARK, G_FLAT);
      }
    }
  },
};
